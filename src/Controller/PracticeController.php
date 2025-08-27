<?php

namespace App\Controller;

use App\Entity\Analysis;
use App\Entity\ECO;
use App\Entity\IgnoreList;
use App\Entity\Repertoire;
use App\Controller\ChessrAbstractController;
use App\Service\RepertoireService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\DBAL\Connection;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;

class PracticeController extends ChessrAbstractController
{
    public function __construct(
        private Connection $conn, 
        private EntityManagerInterface $em, 
        private ManagerRegistry $doctrine, 
        private RepertoireController $repertoire,
        private RepertoireService $repertoireService
        ) {}

    #[Route('/practice', methods: ['GET', 'POST'], name: 'app_practice')]
    /**
     * Renders the practice page. Passes along the repertoire type and ID in case a specific repertoire needs to be shown.
     *
     * @param  mixed $request
     * @return Response
     */
    public function index(Request $request): Response
    {
        // get the payload (if posted)
        $data = $request->getPayload()->all();

        // get the practice repertoire type
        $type = isset($data["type"]) ? $data["type"] : "all";
        // get the repertoire id (from the roadmap)
        $id = isset($data["id"]) ? $data["id"] : "";

        // the data to send to the page
        $data = [
            'repertoireType' => $id != "" ? "custom" : $type,
            'repertoireId' => $id
        ];

        return $this->render('practice/index.html.twig', $data);
    }

    #[Route('/api/practice', methods: ['GET', 'POST'], name: 'app_api_practice')]
    /**
     * Returns all practice lines. Optionally can return the roadmap (based on the practice lines) or just get the lines in
     * order to get the statistics.
     * 
     * This method is used by the roadmap controller and the home controller.
     *
     * @param  mixed $request
     * @param  mixed $isRoadmap
     * @param  mixed $statisticsOnly
     * @return JsonResponse
     */
    public function apiPractice(Request $request, bool $isRoadmap = false, bool $statisticsOnly = false): JsonResponse
    {
        // get the payload (if posted)
        $data = $request->getPayload()->all();

        // get the repertoire id (from the roadmap)
        $repertoireId = isset($data["id"]) ? intval($data["id"]) : null;

        // get the repertoire repository
        $repoRep = $this->em->getRepository(Repertoire::class);

        // get the ECO codes
        $ecoResult = $this->em->getRepository(ECO::class)->findAll();

        // encode to JSON
        $encoders = [new JsonEncoder()];
        $normalizers = [new ObjectNormalizer()];
        $serializer = new Serializer($normalizers, $encoders);

        $jsonEco = $serializer->serialize($ecoResult, 'json');

        // if we need a specific repertoire line
        if ($repertoireId != null) {
            // get the lines
            $repertoireItem = $this->repertoireService->getLines($repertoireId);

            return new JsonResponse([
                "custom" => $repertoireItem,
                "eco" => json_decode($jsonEco)
            ]);
        }

        // get the repertoire lines and the group lines
        [$lines, $groups] = $this->repertoireService->getLines(null, $isRoadmap, $statisticsOnly);

        //return new JsonResponse(["test" => true]);

        // the response
        $resp = [
            'white' => [],
            'black' => [],
            'new' => [],
            'recommended' => [],
            "analysis" => [],
            "groups" => $groups,
            "eco" => json_decode($jsonEco)
        ];

        // if we have a repertoire
        if (count($lines) > 0) {
            // get the white lines
            $resp['white'] = $this->repertoireService->getWhiteLines($lines);
            // get the black lines
            $resp['black'] = $this->repertoireService->getBlackLines($lines);

            //dd($resp["black"][2]);
            //dd("lines:", $lines[1]["moves"][2]);

            // not needed for the roadmap
            if (!$isRoadmap) {
                // find the new lines
                $resp['new'] = $this->repertoireService->getNewLines($lines);
                // find the recommended lines
                $resp['recommended'] = $this->repertoireService->getRecommendedLines($lines);
            }
        }

        //dd($resp["white"]);

        /*

        - optionally add failPercentage totals to white/black reps
        - optionally add ECO to white/black reps

        */

        // only for the roadmap
        if ($isRoadmap) {
            // add the roadmap values (ECO & fail totals)
            $this->repertoireService->addRoadmap($resp['white']);
            $this->repertoireService->addRoadmap($resp['black']);

            //dd($resp['black']);

            // get the roadmap
            $roadmap = [
                'white' => $this->repertoireService->getRoadmapFor("white", $resp['white'], true),
                'black' => $this->repertoireService->getRoadmapFor("black", $resp['black'], true)
            ];

            return new JsonResponse($roadmap);
        }

        // get the analysis repository
        $repository = $this->em->getRepository(Analysis::class);
        // get the mistakes for this user
        $res = $repository->findBy(['User' => $this->getUser()], ['Link' => 'ASC', 'Pgn' => 'ASC']);
        // add them
        foreach ($res as $rec) {
            $moves = [];
            $multiple = [];
            // get the best moves json (new)
            $json = json_decode($rec->getBestMoves(), true);
            if ($json == null) {
                // get the best moves array (old)
                $bm = explode(" ", $rec->getBestMoves());
                //dd($rec->getBestMoves());
                foreach ($bm as $move) {
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
                                'User' => $this->getUser(),
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

                            $rs = $repoRep->findOneBy($vars);

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
            $move = $this->repertoireService->findPosition($rec->getFen(), $resp[$rec->getColor()]);
            if ($move !== false) {
                $analysis["repertoire"] = $move["multiple"];
            }

            // add the analysis record
            $resp["analysis"][] = $analysis;
        }

        // sort by color, link, pgn
        usort($resp["analysis"], function ($a, $b) {
            $ret = $b['color'] <=> $a['color'];
            if ($ret == 0) {
                $ret = $a['link'] <=> $b['link'];
            }
            if ($ret == 0) {
                $ret = $a['pgn'] <=> $b['pgn'];
            }

            return $ret;
        });

        // if we need the statistics only
        if ($statisticsOnly) {
            $stats = ["white" => 0, "black" => 0, "new" => 0, "recommended" => 0, "analysis" => 0];
            foreach (array_keys($stats) as $key) {
                $tot = 0;
                foreach ($resp[$key] as $line) {
                    if ($key == "analysis") {
                        $tot++;
                    } else if (isset($line["ourMoveCount"])) {
                        $tot = $tot + $line["ourMoveCount"];
                    }
                }
                $stats[$key] = $tot;
            }

            return new JsonResponse($stats);
        } else {
            return new JsonResponse($resp);
        }
    }

    #[Route('/api/analysis', methods: ['DELETE'], name: 'app_api_analysis_delete')]
    /**
     * Delete a certain analysis record.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiAnalysisDelete(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        $qb = $this->em->createQueryBuilder();

        // delete the analysis for this user, fen & move
        $query = $qb->delete('App\Entity\Analysis', 'a')
            ->where('a.User = :user AND a.Fen = :fen AND a.Move = :move')
            ->setParameter('user', $this->getUser())
            ->setParameter('fen', $data["fen"])
            ->setParameter('move', $data["move"])
            ->getQuery();

        $ret = $query->execute();

        return new JsonResponse(["message" => "Analysis deleted.", "ret" => $ret]);
    }

    #[Route('/api/analysis/save', methods: ['POST'], name: 'app_api_analysis_save')]
    /**
     * Save an analysis record to our repertoire.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiAnalysisSave(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        $message = "";

        // save the repertoire
        $saved = $this->repertoire->saveRepertoire($data['color'], $data["initialFen"], $data['moves']);
        //$saved = $this->saveRepertoire($data['color'], $data["initialFen"], $data['moves']);

        if ($saved) {
            $message = "Move saved to your repertoire.";
        } else {
            $message = "Move not saved to your repertoire.";
        }

        // delete the analysis move
        $resp = $this->apiAnalysisDelete($request);

        // set the JSON response data
        $resp->setData(["message" => $message . " Analysis deleted.", "data" => $data]);

        return $resp;
    }

    #[Route('/api/analysis/ignore', methods: ['POST'], name: 'app_api_analysis_ignore')]
    /**
     * Add an analysis record to our ignore list and delete the analysis record.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiAnalysisIgnore(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        $message = "";

        $repo = $this->em->getRepository(IgnoreList::class);
        // make sure we don't already have this move on our ignore list
        $res = $repo->findOneBy([
            'User' => $this->getUser(),
            'Fen' => $data["fen"],
            'Move' => $data["move"]
        ]);

        if ($res) {
            $message = "Move already on the ignore list.";
        } else {
            // add the move to the ignore list
            $rec = new IgnoreList();
            $rec->setUser($this->getUser());
            $rec->setFen($data["fen"]);
            $rec->setMove($data["move"]);

            $this->em->persist($rec);
            $this->em->flush();

            $message = "Move added to the ignore list.";
        }

        // delete the analysis move
        $resp = $this->apiAnalysisDelete($request);

        // set the JSON response data
        $resp->setData(["message" => $message . " Analysis deleted."]);

        return $resp;
    }
}
