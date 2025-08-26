<?php

namespace App\Controller;

use App\Entity\Evaluation;
use App\Entity\ECO;
use App\Entity\Group;
use App\Entity\Repertoire;
use App\Entity\RepertoireGroup;
use App\Library\ChessJs;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\DBAL\Connection;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class RepertoireController extends AbstractController
{
    public function __construct(private Connection $conn, private EntityManagerInterface $em, private ManagerRegistry $doctrine)
    {
    }

    #[Route(['/repertoire', '/repertoire/{color}'], methods: ['GET', 'POST'], name: 'app_repertoire')]
    /**
     * Renders the repertoire page. Passes along the repertoire color, FEN and line.
     *
     * @param  mixed $request
     * @param  mixed $color
     * @return Response
     */
    public function index(Request $request, ?string $color): Response
    {
        // get the payload (if posted)
        $data = $request->getPayload()->all();

        // get the color (not used?)
        $color = $color && $color == "black" ? $color : "white";

        // render the page, pass on parameters
        return $this->render('repertoire/index.html.twig', [
            'repertoireColor' => $data && isset($data["color"]) ? $data["color"] : $color,
            'repertoireFen' => $data && isset($data["fen"]) ? $data["fen"] : "",
            'repertoireLine' => $data && isset($data["line"]) ? join(",", $data["line"]) : ""
        ]);
    }

    #[Route('/api/repertoire/autoplay', methods: ['POST'], name: 'app_api_repertoire_autoplay')]
    /**
     * Updates the 'autoplay' boolean for a certain repertoire move.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiRepertoireAutoPlay(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        $message = "";

        $repo = $this->em->getRepository(Repertoire::class);
        $rep = $repo->findOneBy(['id' => $data["repertoire"]]);
        if ($rep) {
            // update the autoplay flag
            $rep->setAutoPlay($data["autoplay"]);

            $this->em->persist($rep);
            $this->em->flush();

            $message = "Repertoire autoplay updated.";
        } else {
            $message = "Repertoire not found.";
        }

        return new JsonResponse(["message" => $message]);
    }

    #[Route('/api/repertoire/exclude', methods: ['POST'], name: 'app_api_repertoire_exclude')]
    /**
     * Updates the 'exclude' boolean for a certain repertoire move.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiRepertoireExclude(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        $message = "";

        $repo = $this->em->getRepository(Repertoire::class);
        $rep = $repo->findOneBy(['id' => $data["repertoire"]]);
        if ($rep) {
            // update the exclude flag
            $rep->setExclude($data["exclude"]);

            $this->em->persist($rep);
            $this->em->flush();

            $message = "Repertoire exclude updated.";
        } else {
            $message = "Repertoire not found.";
        }

        return new JsonResponse(["message" => $message]);
    }

    #[Route('/api/repertoire/groups', name: 'app_api_get_repertoire_groups')]
    /**
     * Gets the repertoire groups for a certain user.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiGroups(Request $request): JsonResponse
    {
        // get the ECO codes for this position and the next move
        $repo = $this->em->getRepository(Group::class);

        $res = [];
        foreach ($repo->findBy(['User' => $this->getUser()], ['Name' => 'ASC']) as $rec) {
            $res[] = ["id" => $rec->getId(), "name" => $rec->getName()];
        }

        return new JsonResponse(["groups" => $res]);
    }

    #[Route('/api/repertoire/group', methods: ['POST'], name: 'app_api_repertoire_group_add')]
    /**
     * Add a repertoire move to a certain group.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiRepertoireGroupAdd(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        $message = "";

        $repo = $this->em->getRepository(Repertoire::class);
        $rep = $repo->findOneBy(['id' => $data["repertoire"]]);
        if ($rep) {
            $repo = $this->em->getRepository(Group::class);
            // find the group
            $grp = $repo->findOneBy(['User' => $this->getUser(), 'Name' => $data["group"]]);
            if ($grp) {
                // make sure this group isnt already linked to the repertoire
                $repo = $this->em->getRepository(RepertoireGroup::class);
                $repg = $repo->findOneBy(['Repertoire' => $data["repertoire"], 'Grp' => $grp->getId()]);
                if ($repg) {
                    $message = "Repertoire already part of group.";
                } else {
                    // save the move to the repertoire
                    $repg = new RepertoireGroup();
                    $repg->setRepertoire($rep);
                    $repg->setGrp($grp);

                    $this->em->persist($repg);
                    $this->em->flush();

                    $message = "Repertoire added to existing group.";
                }
            } else {
                // add the group
                $grp = new Group();
                $grp->setUser($this->getUser());
                $grp->setName($data["group"]);

                $this->em->persist($grp);
                $this->em->flush();

                // save the move to the repertoire
                $repg = new RepertoireGroup();
                $repg->setRepertoire($rep);
                $repg->setGrp($grp);

                $this->em->persist($repg);
                $this->em->flush();

                $message = "Repertoire added to new group.";
            }
        } else {
            $message = "Repertoire not found.";
        }

        return new JsonResponse(["message" => $message]);
    }

    #[Route('/api/repertoire/group', methods: ['DELETE'], name: 'app_api_repertoire_group_delete')]
    /**
     * Remove a repertoire move from a certain group.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiRepertoireGroupDelete(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        $repo = $this->em->getRepository(Group::class);
        $repo2 = $this->em->getRepository(RepertoireGroup::class);

        // find the group
        $res = $repo->findBy(['User' => $this->getUser(), 'Name' => $data["group"]]);
        foreach ($res as $grp) {

            $groups[] = $grp->getId();

            $qb = $this->em->createQueryBuilder();

            $query = $qb->delete('App\Entity\RepertoireGroup', 'rg')
                ->where('rg.Repertoire = :rep AND rg.Grp = :grp')
                ->setParameter('rep', $data["repertoire"])
                ->setParameter('grp', $grp->getId())
                ->getQuery();

            $query->execute();

            //
            $res = $repo2->findBy(['Grp' => $grp->getId()]);
            if (count($res) == 0) {
                $qb = $this->em->createQueryBuilder();

                $query = $qb->delete('App\Entity\Group', 'g')
                    ->where('g.id = :id')
                    ->setParameter('id', $grp->getId())
                    ->getQuery();

                $query->execute();
            }
        }

        return new JsonResponse(["message" => "Repertoire removed from group.", "repertoire" => $data["repertoire"], "groups" => $groups]);
    }

    #[Route('/api/repertoire', methods: ['POST'], name: 'app_api_repertoire_save')]
    /**
     * Save a repertoire move.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiRepertoireSave(Request $request): JsonResponse
    {
        // get the data
        $data = $request->getPayload()->all();
        // save the repertoire
        $saved = $this->saveRepertoire($data['color'], $data['initialFen'], $data['moves']);

        return new JsonResponse($saved);
    }

    #[Route('/api/repertoire', methods: ['DELETE'], name: 'app_api_repertoire_delete')]
    /**
     * Delete a repertoire move.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiRepertoireDelete(Request $request): JsonResponse
    {
        // get the data
        $data = $request->getPayload()->all();

        // delete the repertoire move
        $this->deleteRepertoire($data["color"], $data["fen"], $data["move"]);

        return new JsonResponse(["message" => "The move has been deleted from the repertoire."]);
    }

    #[Route('/api/repertoire/counters', methods: ['POST'], name: 'app_api_repertoire_counters')]
    /**
     * Update the practice counters for a repertoire move.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiRepertoireCounters(Request $request): JsonResponse
    {
        // get the data
        $data = $request->getPayload()->all();

        $repo = $this->em->getRepository(Repertoire::class);

        // loop through the moves
        foreach ($data["moves"] as $move) {

            //dd($move);

            // find this move
            $rec = $repo->findOneBy([
                'User' => $this->getUser(),
                'Color' => $move['color'],
                'FenBefore' => $move['fen'],
                'Move' => $move['move']
            ]);

            if ($rec) {
                // update the counters
                $rec->setPracticeCount($rec->getPracticeCount() + 1);

                if (isset($move["correct"]) && $move["correct"] == 1) {
                    $rec->setPracticeInARow($rec->getPracticeInARow() + 1);
                } else {
                    $rec->setPracticeInARow(0);
                }

                if (isset($move["failed"]) && $move["failed"] == 1) {
                    $rec->setPracticeFailed($rec->getPracticeFailed() + 1);
                }

                // get the days since last practice
                $daysSinceLastPractice = $rec->getLastUsed() ? (new DateTime('now'))->diff($rec->getLastUsed())->days : -1;
                // add to the deltas
                if ($daysSinceLastPractice >= 0) {
                    $rec->addDelta($daysSinceLastPractice);
                }

                // update the last used date
                $rec->setLastUsed(new DateTime('now'));

                // save the record
                $this->em->persist($rec);
            }
        }

        $this->em->flush();

        return new JsonResponse(["message" => "Counters updated."]);
    }

    #[Route('/api/repertoire/moves', name: 'app_api_moves')]
    /**
     * Gets the top engine evaluation moves, the most played moves and our own repertoire moves for a certain FEN position.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiMoves(Request $request): JsonResponse
    {

        $timers = [];
        $timers["all"] = hrtime(true);

        $data = $request->getPayload()->all();

        // get the FEN without the move numbers
        //$parts = explode(" ", $data["fen"]);
        $parts = explode(" ", $data["fen2"]);
        $fenWithout = join(" ", array_slice($parts, 0, 4));

        $chess = new ChessJs();
        $chess->load($data["fen"]);

        global $turn;
        $turn = $chess->turn();

        $evals = [];

        $timers["evals"] = hrtime(true);

        // get the evaluations for this position
        $rec = $this->em->getRepository(Evaluation::class)->findOneBy(["Fen" => $fenWithout]);
        //$rec = null;

        $timers["evals"] = (hrtime(true) - $timers["evals"]) / 1e+6;

        if ($rec) {
            //
            //$chess = new ChessJs();

            $timers["evals-get-san"] = hrtime(true);

            $temp = json_decode($rec->getEvals(), true);

            usort($temp, function ($a, $b) {
                if ($a["depth"] > $b["depth"]) return -1;
                if ($a["depth"] < $b["depth"]) return 1;
                return 0;
            });

            // load the FEN (adding the move counters manually)
            $chess->load($fenWithout . " 0 1");
            //
            foreach ($temp as $eval) {
                foreach ($eval["pvs"] as $pv) {


                    // get the moves
                    $move = explode(" ", $pv["line"]);

                    // get the move details
                    $fromSquare = substr($move[0], 0, 2);
                    $toSquare = substr($move[0], 2, 2);
                    $promotion = strlen($move[0] == 5) ? substr($move[0], 5) : "";
                    // make the move
                    $ret = $chess->move(["from" => $fromSquare, "to" => $toSquare, "promotion" => $promotion]);
                    if ($ret !== null) {
                        // get the last move
                        $history = $chess->history(['verbose' => true]);
                        $last = array_pop($history);
                        // undo the last move
                        $chess->undo();

                        // add the evaluation
                        $evals[] = [
                            "cp" => isset($pv["cp"]) ? $pv["cp"] : null,
                            "mate" => isset($pv["mate"]) ? $pv["mate"] : null,
                            "move" => $last["san"]
                        ];
                    }
                }
            }

            $timers["evals-get-san"] = (hrtime(true) - $timers["evals-get-san"]) / 1e+6;
        }

        $timers["get-pgn"] = hrtime(true);

        // get the ECO codes for this position and the next move
        $codes = $this->em->getRepository(ECO::class)->findByPgn($data['pgn']);

        $timers["get-pgn"] = (hrtime(true) - $timers["get-pgn"]) / 1e+6;

        $games = ['total' => 0, 'moves' => [], 'fen' => $data['fen']];

        /*

        $timers["get-moves-1"] = hrtime(true);

        $sql = 'SELECT * FROM moves WHERE fen = :fen ORDER BY wins+draws+losses DESC';
        $stmtFind = $this->conn->prepare($sql);
        $stmtFind->bindValue('fen', $data["fen"]);

        $result = $stmtFind->executeQuery();

        while (($mov = $result->fetchAssociative()) !== false) {
            // get the total
            $total = $mov["wins"] + $mov["draws"] + $mov["losses"];
            // add to grand total
            $games['total'] += $total;
            // add the move
            $games['moves'][] = [
                'move' => $mov["move"],
                'cp' => null,
                'mate' => null,
                'eco' => '',
                'name' => '',
                'repertoire' => 0,
                'percentage' => 0,
                'total' => $total,
                'wins' => $mov["wins"],
                'draws' => $mov["draws"],
                'losses' => $mov["losses"]
            ];
        }

        $timers["get-moves-1"] = (hrtime(true) - $timers["get-moves-1"]) / 1e+6;
        */

        $timers["get-moves-2"] = hrtime(true);

        // get the most played moves for this position
        $qb = $this->em->createQueryBuilder();
        $qb->select('m')
            ->from('App\Entity\Moves', 'm')
            ->where('m.Fen = :fen')
            ->orderBy('m.Wins + m.Draws + m.Losses', 'DESC')
            ->setParameter('fen', $data['fen']);

        $res = $qb->getQuery()->getResult();

        foreach ($res as $mov) {
            // get the total
            $total = $mov->getWins() + $mov->getDraws() + $mov->getLosses();
            // add to grand total
            $games['total'] += $total;
            // add the move
            $games['moves'][] = [
                'move' => $mov->getMove(),
                'cp' => null,
                'mate' => null,
                'eco' => '',
                'name' => '',
                'repertoire' => 0,
                'percentage' => 0,
                'total' => $total,
                'wins' => $mov->getWins(),
                'draws' => $mov->getDraws(),
                'losses' => $mov->getLosses()
            ];
        }

        // if we have moves
        if ($games['total'] > 0) {
            // set the percentage each move is played
            for ($i = 0; $i < count($games['moves']); $i++) {
                $games['moves'][$i]['percentage'] = (int) round(($games['moves'][$i]['total'] / $games['total']) * 100, 0);
            }
        }

        $timers["get-moves-2"] = (hrtime(true) - $timers["get-moves-2"]) / 1e+6;

        // get the current PGN
        $current = $codes['pgn'] . ($codes['pgn'] != "" ? " " : "");
        // if it's white to move
        if ($codes['halfmove'] % 2 == 1) {
            // add the move number to the PGN
            $current = $current . (($codes['halfmove'] + 1) / 2) . ". ";
        }

        //print "Pgn: " . $codes['pgn'] . "<br>";
        //print "Current: $current<br>";

        //dd($played);

        $timers["get-rep"] = hrtime(true);

        // get the repository
        $repository = $this->em->getRepository(Repertoire::class);

        // the groups for this repertoire
        $groups = [];

        // get the repertoire details, if we've saved it
        $repertoireId = 0;
        $repertoireAutoPlay = false;
        $repertoireExclude = false;
        $repertoireIncluded = true;

        if ($data['pgn'] != '') {
            $res = $repository->findOneBy([
                'User' => $this->getUser(),
                'Color' => $data['color'],
                'FenAfter' => $data['fen']
            ]);

            if ($res) {
                $repertoireId = $res->getId();
                $repertoireAutoPlay = $res->isAutoPlay();
                $repertoireExclude = $res->isExclude();
                $repertoireIncluded = $repository->isIncluded($res->getFenBefore());
                foreach ($res->getRepertoireGroups() as $grp) {
                    $groups[] = ["id" => $grp->getGrp()->getId(), "name" => $grp->getGrp()->getName()];
                }
            }
        }

        // find the saved repository moves from this position
        $res = $repository->findBy([
            'User' => $this->getUser(),
            'Color' => $data['color'],
            'FenBefore' => $data['fen']
        ]);

        $reps = [];
        foreach ($res as $rep) {
            $move = [
                'move' => $rep->getMove(),
                'cp' => null,
                'mate' => null,
                'eco' => '',
                'name' => '',
                'percentage' => 0,
                'total' => 0,
                'wins' => 0,
                'draws' => 0,
                'losses' => 0
            ];

            // find the ECO code for this move
            for ($i = 0; $i < count($codes['next']); $i++) {
                $temp = explode(' ', $codes['next'][$i]['PGN']);
                if (array_pop($temp) == $rep->getMove()) {
                    $move['eco'] = $codes['next'][$i]['Code'];
                    $move['name'] = $codes['next'][$i]['Name'];
                    $codes['next'][$i]['repertoire'] = 1;
                }
            }

            // find the move totals & percentage
            for ($i = 0; $i < count($games['moves']); $i++) {
                if ($games['moves'][$i]['move'] == $rep->getMove()) {
                    $move['percentage'] = $games['moves'][$i]['percentage'];
                    $move['total'] = $games['moves'][$i]['total'];
                    $move['wins'] = $games['moves'][$i]['wins'];
                    $move['losses'] = $games['moves'][$i]['losses'];
                    $move['losses'] = $games['moves'][$i]['losses'];

                    break;
                }
            }

            $reps[] = $move;
        }

        // find the ECO codes for the moves and see if we have them in our repertoire
        for ($i = 0; $i < count($games['moves']); $i++) {
            // find the ECO code
            foreach ($codes['next'] as $code) {
                if ($code['PGN'] == ($current . $games['moves'][$i]['move'])) {
                    $games['moves'][$i]['eco'] = $code['Code'];
                    $games['moves'][$i]['name'] = $code['Name'];
                }
            }
            // see if we have this move in our repertoire
            foreach ($res as $rep) {
                if ($rep->getMove() == $games['moves'][$i]['move']) {
                    $games['moves'][$i]['repertoire'] = 1;
                }
            }
        }

        $timers["get-rep"] = (hrtime(true) - $timers["get-rep"]) / 1e+6;

        // the initial starting positions we have for this color (only needed at top level)
        $initialFens = [];

        // if we are at top level
        if ($data['pgn'] == "") {
            // find the initial starting positions for this color
            $qb = $this->em->createQueryBuilder();
            $qb->select('r')
                ->from('App\Entity\Repertoire', 'r')
                ->where('r.User = :user AND r.Color = :color AND r.HalfMove = 1 AND r.InitialFen != \'\'')
                ->orderBy('r.InitialFen', 'ASC')
                ->setParameter('user', $this->getUser())
                ->setParameter('color', $data['color']);
            $res = $qb->getQuery()->getResult();
            foreach ($res as $rep) {
                $initialFens[] = $rep->getInitialFen();
            }
        }

        // add the evaluations
        foreach ($evals as $eval) {
            $found = false;
            // check the game moves
            for ($i = 0; $i < count($games["moves"]); $i++) {
                if ($eval["move"] == $games["moves"][$i]["move"]) {
                    $games["moves"][$i]["cp"] = $eval["cp"];
                    $games["moves"][$i]["mate"] = $eval["mate"];
                    $found = true;
                }
            }
            // check the repertoire moves
            for ($i = 0; $i < count($reps); $i++) {
                if ($eval["move"] == $reps[$i]["move"]) {
                    $reps[$i]["cp"] = $eval["cp"];
                    $reps[$i]["mate"] = $eval["mate"];
                    $found = true;
                }
            }
            // if the engine move is not found
            if (!$found) {
                $games['moves'][] = [
                    'move' => $eval["move"],
                    'cp' => $eval["cp"],
                    'mate' => $eval["mate"],
                    'eco' => '',
                    'name' => '',
                    'repertoire' => 0,
                    'percentage' => 0,
                    'total' => 0,
                    'wins' => 0,
                    'draws' => 0,
                    'losses' => 0
                ];
            }
        }

        // sort the repertoire moves by percentage / eval
        usort($reps, function ($a, $b) {
            global $turn;

            if ($a["total"] > $b["total"]) return -1;
            if ($a["total"] < $b["total"]) return 1;

            if ($a["mate"] !== null && $b["mate"] == null) return -1;
            if ($a["mate"] == null && $b["mate"] !== null) return 1;
            if ($a["mate"] !== null && $b["mate"] !== null) {
                if ($a["mate"] < $b["mate"]) return -1;
                if ($a["mate"] > $b["mate"]) return 1;
            }

            if ($a["cp"] > $b["cp"]) return ($turn == "w" ? -1 : 1);
            if ($a["cp"] < $b["cp"]) return ($turn == "w" ? 1 : -1);

            return 0;
        });

        // sort the game moves by percentage / eval
        usort($games['moves'], function ($a, $b) {
            global $turn;

            if ($a["total"] > $b["total"]) return -1;
            if ($a["total"] < $b["total"]) return 1;

            /*
            if ($a["mate"] !== null && $b["mate"] == null) {
                if ($a["mate"] > 0) return ($turn == "w" ? -1 : 1);
                return ($turn == "w" ? 1 : -1);
            }
            if ($a["mate"] == null && $b["mate"] !== null) {
                if ($a["mate"] > 0) return ($turn == "w" ? -1 : 1);
                return ($turn == "w" ? -1 : 1);
            }
                */
            if ($a["mate"] !== null && $b["mate"] == null) {
                if ($a["mate"] > 0) return ($turn == "w" ? -1 : 1);
                return ($turn == "w" ? 1 : -1);
            }
            if ($a["mate"] == null && $b["mate"] !== null) {
                if ($b["mate"] > 0) return ($turn == "w" ? 1 : -1);
                return ($turn == "w" ? -1 : 1);
            }
            if ($a["mate"] !== null && $b["mate"] !== null) {
                if ($a["mate"] < $b["mate"]) return ($turn == "w" ? -1 : 1);
                if ($a["mate"] > $b["mate"]) return ($turn == "w" ? 1 : -1);
            }

            if ($a["cp"] > $b["cp"]) return ($turn == "w" ? -1 : 1);
            if ($a["cp"] < $b["cp"]) return ($turn == "w" ? 1 : -1);

            return 0;
        });

        $timers["all"] = (hrtime(true) - $timers["all"]) / 1e+6;

        return new JsonResponse([
            'eco' => $codes,
            'turn' => $turn,
            'games' => $games,
            'repertoire' => $reps,
            'current' => [
                'id' => $repertoireId,
                'autoplay' => $repertoireAutoPlay,
                'exclude' => $repertoireExclude,
                'included' => $repertoireIncluded
            ],
            'initialFens' => $initialFens,
            'groups' => $groups,
            'timers' => $timers
        ]);
    }

    /**
     * Delete a repertoire move and it's descendants.
     *
     * @param  mixed $color
     * @param  mixed $fenAfter
     * @param  mixed $move
     * @param  mixed $isTop
     * @return void
     */
    private function deleteRepertoire(string $color, $fenAfter, $move, $isTop = true)
    {
        $repository = $this->em->getRepository(Repertoire::class);

        // get the moves that follow this move
        $res = $repository->findBy([
            'User' => $this->getUser(),
            'Color' => $color,
            'FenBefore' => $fenAfter
        ]);

        // delete the child moves
        foreach ($res as $rec) {
            $this->deleteRepertoire($color, $rec->getFenAfter(), $rec->getMove(), false);
        }

        // find this move
        $rec = $repository->findOneBy([
            'User' => $this->getUser(),
            'Color' => $color,
            'FenAfter' => $fenAfter,
            'Move' => $move
        ]);

        if ($rec) {
            // get the fen before
            $fenBefore = $rec->getFenBefore();
            // delete it
            $this->em->remove($rec);
            // delete the moves
            $this->em->flush();

            // remove the preceding move if no sibling moves remaining..
            if ($isTop) {
                // find sibling moves
                $rec = $repository->findBy([
                    'User' => $this->getUser(),
                    'Color' => $color,
                    'FenBefore' => $fenBefore
                ]);

                // if no sibling moves, we can remove the parent (white) move
                if (count($rec) == 0) {
                    $parent = $repository->findOneBy([
                        'User' => $this->getUser(),
                        'Color' => $color,
                        'FenAfter' => $fenBefore
                    ]);

                    if ($parent) {
                        // delete it
                        $this->em->remove($parent);
                    }
                }
            }
        }

        // delete the moves
        $this->em->flush();
    }

    /**
     * Save an array of repertoire moves.
     *
     * @param  mixed $color
     * @param  mixed $initialFen
     * @param  mixed $moves
     * @return bool
     */
    public function saveRepertoire(string $color, string $initialFen, array $moves): bool
    {
        $repository = $this->em->getRepository(Repertoire::class);

        // any saved?
        $saved = false;
        $halfMove = 1;

        // loop through the moves
        foreach ($moves as $m) {
            // the last array item could be an array of multiple moves (= engine moves, through analysis save)
            $temp = isset($m['moves']) ? $m['moves'] : [$m];
            foreach ($temp as $move) {
                // check to see if we already saved this move
                $data = $repository->findBy([
                    'User' => $this->getUser(),
                    'Color' => $color,
                    'FenBefore' => $move['before'],
                    'Move' => $move['san']
                ]);

                // skip this one if already saved
                if (count($data) > 0) continue;

                // save the move to the repertoire
                $rep = new Repertoire();
                $rep->setUser($this->getUser());
                $rep->setColor($color);
                $rep->setInitialFen($initialFen);
                $rep->setFenBefore($move['before']);
                $rep->setFenAfter($move['after']);
                $rep->setPgn(trim($move['pgn']));
                $rep->setMove($move['san']);
                $rep->setAutoPlay(isset($move['autoplay']) ? $move['autoplay'] : false);
                $rep->setExclude(isset($move['exclude']) ? $move['exclude'] : false);
                $rep->setHalfMove($halfMove);
                $rep->setPracticeCount(0);
                $rep->setPracticeFailed(0);
                $rep->setPracticeInARow(0);
                //$rep->setLastUsed(new DateTime());

                // tell Doctrine you want to (eventually) save the Product (no queries yet)
                $this->em->persist($rep);

                $saved = true;
            }

            // if this is not one of the multiple engine moves
            if (!isset($m['moves'])) {
                // increase the halfmove
                $halfMove++;
            }
        }

        // if we actually saved anything
        if ($saved) {
            // actually executes the queries (i.e. the INSERT query)
            $this->em->flush();
        }

        return $saved;
    }
}
