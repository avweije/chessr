<?php

namespace App\Service;

use App\Entity\User;
use App\Library\Debugger;
use App\Repository\AnalysisRepository;
use App\Repository\RepertoireRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bundle\SecurityBundle\Security;

class AnalysisService
{
    private $user = null;
    private $settings = null;
    private $repertoireService;
    private $analysisRepo;
    private $repertoireRepo;

    public function __construct(
        ManagerRegistry $registry,
        private Security $security,
        RepertoireService $repertoireService,
        AnalysisRepository $analysisRepo,
        RepertoireRepository $repertoireRepo
    ) {
        $this->user = $security->getUser();
        if ($this->user instanceof User) {
            $this->settings = $this->user->getSettings();
        }
        $this->repertoireService = $repertoireService;
        $this->analysisRepo = $analysisRepo;
        $this->repertoireRepo = $repertoireRepo;
    }

    public function getAnalysisLines(array $lines): array
    {
        $result = [];
        // get the mistakes for this user
        $res = $this->analysisRepo->findBy(['User' => $this->user], ['Link' => 'ASC', 'Pgn' => 'ASC']);
        // add them
        foreach ($res as $rec) {
            $moves = [];
            $multiple = [];
            $used = [];
            // get the best moves json (new)
            $json = json_decode($rec->getBestMoves(), true);
            if ($json == null) {
                // get the best moves array (old)
                $bm = explode(" ", $rec->getBestMoves());
                //dd($rec->getBestMoves());
                foreach ($bm as $move) {
                    // Make sure it's not a double
                    if (in_array($move, $used)) continue;
                    $used[] = $move;
                    // Add the move
                    $moves[] = ["move" => $move];
                    $multiple[] = [
                        "move" => $move,
                        "cp" => null,
                        "mate" => null,
                        "pv" => null
                    ];
                }
            } else {
                foreach ($json as $move) {
                    // Make sure it's not a double
                    if (in_array($move['san'], $used)) continue;
                    $used[] = $move['san'];
                    // Add the move
                    $moves[] = [
                        "move" => $move["san"],
                        "cp" => isset($move['cp']) ? $move['cp'] : null,
                        "mate" => isset($move['mate']) ? $move['mate'] : null,
                        "pv" => $move["line"]
                    ];
                    $multiple[] = [
                        "move" => $move['san'],
                        "cp" => isset($move['cp']) ? $move['cp'] : null,
                        "mate" => isset($move['mate']) ? $move['mate'] : null,
                        "pv" => isset($move['line']) ? $move['line'] : null
                    ];
                }
            }


            // get the line up to this move
            $line = [];
            // get the suggestion, based off our repertoire (1st move not in our repertoire)
            $suggestion = null;
            $fenBefore = $rec->getInitialFen();
            $temp = explode(" ", $rec->getPgn());
            for ($i = 0; $i < count($temp); $i++) {
                // if this is not a move number
                if (preg_match('/^\\d+\\./', $temp[$i]) !== 1) {
                    if (trim($temp[$i]) != "") {
                        $line[] = $temp[$i];

                        // if no suggestion yet
                        if ($suggestion == null) {
                            // find this move in our repertoire
                            $vars = [
                                'User' => $this->user,
                                'Color' => $rec->getColor(),
                                'Move' => $temp[$i]
                            ];

                            if ($fenBefore != "") {
                                //$parts = explode(" ", $fenBefore);
                                //$fenBefore2 = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];
                                //$vars['FenBefore'] = [$fenBefore, $fenBefore2];
                                $vars['FenBefore'] = $fenBefore;
                            } else {
                                $vars['HalfMove'] = 1;
                            }

                            $rs = $this->repertoireRepo->findOneBy($vars);

                            // if found, get the FEN, otherwise add as suggestion
                            if ($rs) {
                                $fenBefore = $rs->getFenAfter();
                            } else {

                                //
                                // if opponent move, make move in Chess() object to get fen after
                                // then get the eval from db
                                // add to the suggestion (= cp)
                                //

                                // add the suggestion
                                $suggestion = [
                                    'move' => $temp[$i],
                                    'display' => ceil(count($line) / 2) . (count($line) % 2 == 0 ? ".." : "") . ". " . $temp[$i],
                                    'before' => $fenBefore,
                                    'cp' => 0,
                                    'line' => $line
                                ];
                            }
                        }
                    }
                }
            }

            // the analysis record
            $analysis = [
                "color" => $rec->getColor(),
                "white" => $rec->getWhite(),
                "black" => $rec->getBlack(),
                "link" => $rec->getLink(),
                "type" => $rec->getType(),
                "initialFen" => $rec->getInitialFen(),
                "fen" => $rec->getFen(),
                "pgn" => $rec->getPgn(),
                "move" => $rec->getMove(),
                "line" => $line,
                "moves" => $moves,
                "multiple" => $multiple,
                "suggestion" => $suggestion
            ];

            // check to see if this position is in our repertoire
            $move = $this->repertoireService->findPosition($rec->getFen(), $lines);
            if ($move !== false) {
                $analysis["repertoire"] = $move["multiple"];
            }

            // add the analysis record
            $result[] = $analysis;
        }

        // sort by color, link, pgn
        usort($result, function ($a, $b) {
            $ret = $b['color'] <=> $a['color'];
            if ($ret == 0) {
                $ret = $a['link'] <=> $b['link'];
            }
            if ($ret == 0) {
                $ret = $a['pgn'] <=> $b['pgn'];
            }

            return $ret;
        });

        return $result;
    }
}
