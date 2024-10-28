<?php

namespace App\Controller;

use App\Config\DownloadSite;
use App\Config\DownloadStatus;
use App\Config\DownloadType;
use App\Entity\Main\Downloads;
use App\Entity\Main\ECO;
use App\Entity\Main\Group;
use App\Entity\Main\Analysis;
use App\Entity\Evaluations\Evaluation;
use App\Entity\Main\IgnoreList;
use App\Entity\Main\Opponent;
use App\Entity\Main\OpponentGame;
use App\Entity\Main\OpponentMove;
use App\Entity\Main\Repertoire;
use App\Entity\Main\RepertoireGroup;
use App\Entity\Main\Settings;
use App\Entity\Main\User;
use App\Library\ChessJs;
use App\Library\GameDownloader;
use App\Library\UCI;
use App\Repository\Main\OpponentMoveRepository;
use App\Service\MyPgnParser\MyGame;
use App\Service\MyPgnParser\MyPgnParser;
use DateTime;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Serializer\Encoder\JsonEncoder;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;

class ApiController extends AbstractController
{
    private $em;
    private $em2;
    private $myPgnParser;

    public function __construct(private Connection $conn, EntityManagerInterface $em, ManagerRegistry $doctrine, MyPgnParser $myPgnParser)
    {
        $this->em = $em;
        $this->myPgnParser = $myPgnParser;
        $this->em2 = $doctrine->getManager("evaluations");
    }

    #[Route('/api/find/similar', name: 'app_api_find_similar_positions')]
    public function apiFindSimilarFen(Request $request): JsonResponse
    {
        //dd($fen);
        $color = "white";
        //$fen = "rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 5";
        $fen = "rnbq1rk1/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR w KQ - 1 5";

        // 1st close to 2nd, but 3rd is found (also close, but would prefer 2nd to be found..)
        // rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 2 5
        // rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4
        // r1bqk2r/ppp2ppp/2n1pn2/3p4/QbPP4/2N2N2/PP2PPPP/R1B1KB1R w KQkq - 4 6

        $closest = -1;
        $matches = [];

        // get the fen without the move numbers
        $parts = explode(" ", $fen);
        $fenColor = $parts[1];
        $fenWithout = implode(" ", array_slice($parts, 0, 3));
        $fenWithout = $this->replaceFenEmptySquares($fenWithout);

        //dd($fenColor, $fenWithout);

        $repo = $this->em->getRepository(Repertoire::class);

        $res = $repo->findBy(['Color' => $color]);
        foreach ($res as $rec) {
            // skip if exactly the same
            if ($fen === $rec->getFenAfter()) {
                continue;
            }

            $parts = explode(" ", $rec->getFenAfter());
            $fenColor2 = $parts[1];
            $fenWithout2 = implode(" ", array_slice($parts, 0, 3));
            $fenWithout2 = $this->replaceFenEmptySquares($fenWithout2);

            if ($fenColor !== $fenColor2) {
                continue;
            }

            /*
            $lev = levenshtein($fenWithout, $fenWithout2);
            if ($lev < $closest || $closest < 0) {
                $closest = $lev;
                $matches = ["lev" => $lev, "rec" => $rec];
            } else if ($lev === $closest) {
                $matches[] = ["lev" => $lev, "rec" => $rec];
            }*/

            $sim = similar_text($fenWithout, $fenWithout2, $pct);
            if ($pct > $closest) {
                $closest = $pct;
                $matches = ["chars" => $sim, "percentage" => $pct, "rec" => $rec];
            } else if ($pct == $closest) {
                $matches[] = ["chars" => $sim, "percentage" => $pct, "rec" => $rec];
            }
        }

        dd($matches);
    }

    private function replaceFenEmptySquares($fen): string
    {
        for ($i = 1; $i < 9; $i++) {
            $fen = str_replace($i, str_pad("x", $i), $fen);
        }
        return $fen;
    }

    #[Route('/api/analyse/test', name: 'app_api_analyse_test')]
    public function apiTestAnalyseGame(Request $request): JsonResponse
    {
        // start the engine
        $uci = new UCI();

        // request the 3 best moves
        $uci->setOption("MultiPV", 3);
        // request only the best move
        //$uci->setOption("MultiPV", 1);

        $pgnText = '[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.01.16"]
[Round "?"]
[White "stadlile"]
[Black "avweije"]
[Result "1-0"]
[ECO "B45"]
[WhiteElo "1801"]
[BlackElo "2034"]
[TimeControl "180"]
[EndTime "10:52:55 PST"]
[Termination "stadlile won by checkmate"]

1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e6 7. f3 Be7 8. Qd2
Nc6 9. O-O-O O-O 10. Bg5 Bd7 11. Bxf6 Bxf6 12. Nxc6 Bxc6 13. Qxd6 Qb6 14. Qa3
Rad8 15. Bc4 Qe3+ 16. Kb1 Qf2 17. Rdf1 Qxg2 18. Rhg1 Qxh2 19. f4 Bd4 20. Rg4 Qh3
21. Be2 Bxc3 22. bxc3 Bxe4 23. Rfg1 g6 24. Bf1 Qe3 25. Kb2 Rd2 26. R4g3 Rxc2+
27. Kb3 Qb6+ 28. Qb4 Bd5+ 29. Kxc2 Qxb4 30. cxb4 Bxa2 31. Rc3 Bd5 32. Bg2 Rd8
33. Bxd5 Rxd5 34. Rc7 Rb5 35. Kb3 Kg7 36. Ra1 h5 37. Rd1 Rf5 38. Rd4 h4 39. Rxb7
h3 40. Rdd7 Rh5 41. Rxf7+ Kg8 42. Rfe7 Kf8 43. Rxe6 h2 44. Rxa6 h1=Q 45. Ra8#
1-0';

        $pgnText = '[Event "Rated blitz game"]
[Site "https://lichess.org/hz2XldTW"]
[Date "2024.10.09"]
[White "anonymouse123"]
[Black "JunMalate"]
[Result "0-1"]
[UTCDate "2024.10.09"]
[UTCTime "08:14:59"]
[WhiteElo "2090"]
[BlackElo "2130"]
[WhiteRatingDiff "-9"]
[BlackRatingDiff "+5"]
[Variant "Standard"]
[TimeControl "180+0"]
[ECO "A43"]
[Opening "Benoni Defense: Old Benoni"]
[Termination "Normal"]
[Annotator "lichess.org"]

1. d4 c5 2. d5 d6 { A43 Benoni Defense: Old Benoni } 3. c4 Nd7 4. Nc3 Ngf6 5. e4 g6 6. Nf3 Bg7 7. Be2 O-O 8. h4 h5 9. Ng5 Ne5 10. f3 Nh7 11. Be3 Nxg5 12. hxg5 e6 13. Qd2 exd5 14. Nxd5 Be6 15. O-O-O Bxd5 16. exd5 Rb8 17. g4 hxg4 18. fxg4 Re8 19. Bf4 b5 20. Bxe5 Bxe5 21. Bd3 bxc4 22. Bxc4 Rxb2 23. Qd3 Qxg5+ 24. Rd2 Rxd2 0-1';

        /*
        $pgnText = '[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.08.18"]
[Round "?"]
[White "ValenBik"]
[Black "avweije"]
[Result "1-0"]
[ECO "A84"]
[WhiteElo "1895"]
[BlackElo "1039"]
[TimeControl "60"]
[EndTime "14:37:35 PDT"]
[Termination "avweije won by checkmate"]

1. f3 e5 2. g4 Bc5 3. e3 Qh4+ 0-1';
*/

        // parse the game
        $game = $this->myPgnParser->parsePgnFromText($pgnText, true);

        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        // get the correct username
        $siteUsername = $settings->getSite() == DownloadSite::ChessDotCom ? $settings->getChessUsername() : $settings->getLichessUsername();

        $time = time();

        // analyse the game
        [$temp, $count] = $this->analyseGame($uci, $game, $siteUsername);

        $time = time() - $time;

        dd($temp, $count, $time);

        return new JsonResponse();
    }

    #[Route('/api/groups', name: 'app_api_groups')]
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

    #[Route('/api/repertoire/autoplay', methods: ['POST'], name: 'app_api_repertoire_autoplay')]
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

    #[Route('/api/repertoire/group', methods: ['POST'], name: 'app_api_repertoire_group_add')]
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

            $query = $qb->delete('App\Entity\Main\RepertoireGroup', 'rg')
                ->where('rg.Repertoire = :rep AND rg.Grp = :grp')
                ->setParameter('rep', $data["repertoire"])
                ->setParameter('grp', $grp->getId())
                ->getQuery();

            $query->execute();

            //
            $res = $repo2->findBy(['Grp' => $grp->getId()]);
            if (count($res) == 0) {
                $qb = $this->em->createQueryBuilder();

                $query = $qb->delete('App\Entity\Main\Group', 'g')
                    ->where('g.id = :id')
                    ->setParameter('id', $grp->getId())
                    ->getQuery();

                $query->execute();
            }
        }

        return new JsonResponse(["message" => "Repertoire removed from group.", "repertoire" => $data["repertoire"], "groups" => $groups]);
    }


    #[Route('/api/moves', name: 'app_api_moves')]
    public function apiMoves(Request $request): JsonResponse
    {
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

        $timers = [];
        $timers["evals"] = time();

        // get the evaluations for this position
        $rec = $this->em2->getRepository(Evaluation::class)->findOneBy(["Fen" => $fenWithout]);

        $timers["evals"] = time() - $timers["evals"];

        if ($rec) {
            //
            //$chess = new ChessJs();

            $temp = json_decode($rec->getEvals(), true);

            usort($temp, function ($a, $b) {
                if ($a["depth"] > $b["depth"]) return -1;
                if ($a["depth"] < $b["depth"]) return 1;
                return 0;
            });

            //
            foreach ($temp as $eval) {
                foreach ($eval["pvs"] as $pv) {

                    // load the FEN (adding the move counters manually)
                    $chess->load($fenWithout . " 0 1");

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
        }

        // get the ECO codes for this position and the next move
        $codes = $this->em->getRepository(ECO::class)->findByPgn($data['pgn']);

        // get the most played moves for this position
        $qb = $this->em->createQueryBuilder();
        $qb->select('m')
            ->from('App\Entity\Main\Moves', 'm')
            ->where('m.Fen = :fen')
            ->orderBy('m.Wins + m.Draws + m.Losses', 'DESC')
            ->setParameter('fen', $data['fen']);

        $res = $qb->getQuery()->getResult();

        $games = ['total' => 0, 'moves' => [], 'fen' => $data['fen']];

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

        // the initial starting positions we have for this color (only needed at top level)
        $initialFens = [];

        // if we are at top level
        if ($data['pgn'] == "") {
            // find the initial starting positions for this color
            $qb = $this->em->createQueryBuilder();
            $qb->select('r')
                ->from('App\Entity\Main\Repertoire', 'r')
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

    #[Route('/api/repertoire', methods: ['POST'], name: 'app_api_repertoire_save')]
    public function apiRepertoireSave(Request $request): JsonResponse
    {
        // get the data
        $data = $request->getPayload()->all();
        // save the repertoire
        $saved = $this->saveRepertoire($data['color'], $data['initialFen'], $data['moves']);

        return new JsonResponse($saved);
    }

    #[Route('/api/repertoire', methods: ['DELETE'], name: 'app_api_repertoire_delete')]
    public function apiRepertoireDelete(Request $request): JsonResponse
    {
        // get the data
        $data = $request->getPayload()->all();

        // delete the repertoire move
        $this->deleteRepertoire($data["color"], $data["fen"], $data["move"]);

        return new JsonResponse(["message" => "The move has been deleted from the repertoire."]);
    }

    #[Route('/api/repertoire/counters', methods: ['POST'], name: 'app_api_repertoire_counters')]
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

                // update the last used date
                $rec->setLastUsed(new DateTime('now'));

                // save the record
                $this->em->persist($rec);
            }
        }

        $this->em->flush();

        return new JsonResponse(["message" => "Counters updated."]);
    }

    // delete a move and it's children
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

    // save a repertoire
    private function saveRepertoire(string $color, string $initialFen, array $moves): bool
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

    #[Route('/api/settings', methods: ['GET'], name: 'app_api_get_settings')]
    public function apiGetSettings(Request $request): JsonResponse
    {
        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        //dd($settings, $user);

        if ($settings == null) {
            // create the settings
            $settings = new Settings();
            $settings->setUser($this->getUser());
            $settings->setAnimationDuration(300);
            $settings->setRepertoireEngineTime(30);
            $settings->setAnimateVariation(0);
            $settings->setAnalyseEngineTime(1000);
            $settings->setAnalyseIgnoreInaccuracy(false);

            // save the settings
            $this->em->persist($settings);
            $this->em->flush();
        }

        return new JsonResponse(["settings" => [
            "board" => $settings->getBoard(),
            "pieces" => $settings->getPieces(),
            "animation_duration" => $settings->getAnimationDuration(),
            "animate_variation" => $settings->getAnimateVariation(),
            "repertoire_engine_time" => $settings->getRepertoireEngineTime(),
            "analyse_engine_time" => $settings->getAnalyseEngineTime(),
            "analyse_ignore_inaccuracy" => $settings->isAnalyseIgnoreInaccuracy()
        ]]);
    }

    #[Route('/api/settings', methods: ['POST'], name: 'app_api_save_settings')]
    public function apiSaveSettings(Request $request): JsonResponse
    {
        // get the payload
        $payload = $request->getPayload()->all();

        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        if ($settings == null) {
            // create the settings
            $settings = new Settings();
            $settings->setUser($this->getUser());
            $settings->setAnimationDuration(300);
            $settings->setRepertoireEngineTime(30);
            $settings->setAnimateVariation(0);
            $settings->setAnalyseEngineTime(1000);
            $settings->setAnalyseIgnoreInaccuracy(false);
        }

        // update all the settings
        foreach ($payload["settings"] as $key => $value) {
            switch ($key) {
                case "board":
                    $settings->setBoard($value);
                    break;
                case "pieces":
                    $settings->setPieces($value);
                    break;
                case "animation_duration":
                    $settings->setAnimationDuration($value);
                    break;
                case "repertoire_engine_time":
                    $settings->setRepertoireEngineTime($value);
                    break;
                case "animate_variation":
                    $settings->setAnimateVariation($value);
                    break;
                case "analyse_engine_time":
                    $settings->setAnalyseEngineTime($value);
                    break;
                case "analyse_ignore_inaccuracy":
                    $settings->setAnalyseIgnoreInaccuracy($value);
                    break;
            }
        }

        // save the settings
        $this->em->persist($settings);
        $this->em->flush();

        return new JsonResponse(["message" => "Settings updated."]);
    }

    #[Route('/api/download/settings', methods: ['GET'], name: 'app_api_download_settings')]
    public function apiDownloaddSettings(Request $request): JsonResponse
    {
        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        if ($settings == null) {
            // create the settings
            $settings = new Settings();
            $settings->setUser($this->getUser());
            $settings->setAnimationDuration(300);
            $settings->setRepertoireEngineTime(30);
            $settings->setAnimateVariation(0);
            $settings->setAnalyseEngineTime(1000);
            $settings->setAnalyseIgnoreInaccuracy(false);

            // save the settings
            $this->em->persist($settings);
            $this->em->flush();
        }

        return new JsonResponse(["settings" => [
            "site" => $settings->getSite(),
            "chess_username" => $settings->getChessUsername(),
            "lichess_username" => $settings->getLichessUsername()
        ]]);
    }

    #[Route('/api/download/archives/{username}/{site}', methods: ['GET'], name: 'app_api_download_archives')]
    public function apiDownloadArchives(Request $request, $username, $site): JsonResponse
    {
        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        if ($settings == null) {
            // create the settings
            $settings = new Settings();
            $settings->setUser($this->getUser());
            $settings->setAnimationDuration(300);
        }

        // get the site
        $site = DownloadSite::tryFrom($site);

        // update the settings
        $settings->setSite($site);
        if ($site == DownloadSite::ChessDotCom) {
            $settings->setChessUsername($username);
        } else {
            $settings->setLichessUsername($username);
        }

        // save the settings
        $this->em->persist($settings);
        $this->em->flush();

        // update in the user (just in case)
        $user->setSettings($settings);

        // get the downloader
        $downloader = new GameDownloader($this->em, $this->getUser());

        // set the JSON response
        $resp = ['archives' => $downloader->getArchives()];

        return new JsonResponse($resp);
    }

    #[Route('/api/download/games/{year}/{month}', methods: ['GET'], name: 'app_api_download_games')]
    public function apiDownloadGames(Request $request, $year, $month): JsonResponse
    {
        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        // get the repository
        $repository = $this->em->getRepository(Downloads::class);

        // find the download record
        $rec = $repository->findOneBy([
            'User' => $this->getUser(),
            'Site' => $settings->getSite(),
            'Year' => $year,
            'Month' => $month
        ]);

        // if we already completed this download
        if ($rec && $rec->getStatus() == DownloadStatus::Completed) {
            $games = [];
        } else {
            $downloader = new GameDownloader($this->em, $this->getUser());
            $games = $downloader->getGames($year, $month);
        }

        // set the JSON response
        //$resp = ['games' => $downloader->xxgetTotals()];
        $resp = ['games' => $games];

        return new JsonResponse($resp);
    }

    #[Route('/api/analyse/download', methods: ['POST'], name: 'app_api_analyse_download')]
    public function apiAnalyseDownload(Request $request): JsonResponse
    {
        // get the payload
        $payload = $request->getPayload()->all();

        $data = [
            "site" => isset($payload["site"]) ? $payload["site"] : "",
            "username" => isset($payload["username"]) ? $payload["username"] : "",
            "type" => isset($payload["type"]) ? $payload["type"] : [],
            "period" => isset($payload["period"]) ? $payload["period"] : ["recent" => 0, "older" => 0]
        ];

        // get & validate the site
        $site = DownloadSite::tryFrom($data["site"]);
        // get the site username
        $siteUsername = $data["username"];

        // get recent and/or older
        $periodRecent = isset($data["period"]["recent"]) ? ($data["period"]["recent"] ? true : false) : false;
        $periodOlder = isset($data["period"]["older"]) ? ($data["period"]["older"] ? true : false) : false;
        // get & validate the types
        $types = [];
        $tps = is_array($data["type"]) ? $data["type"] : [$data["type"]];
        foreach ($tps as $tp) {
            $dtype = DownloadType::tryFrom(ucfirst($tp));
            if ($dtype !== null) {
                $types[$tp] = $dtype;
            }
        }

        // if the payload is invalid
        if ($site == null || $siteUsername == "" || (!$periodRecent && !$periodOlder) || count($types) == 0) {
            // set the error response
            $response = new JsonResponse(['error' => "Invalid payload."]);
            $response->setStatusCode(411);

            return $response;
        }

        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        if ($settings == null) {
            // create the settings
            $settings = new Settings();
            $settings->setUser($this->getUser());
            $settings->setAnimationDuration(300);
            $settings->setRepertoireEngineTime(30);
            $settings->setAnimateVariation(0);
            $settings->setAnalyseEngineTime(1000);
            $settings->setAnalyseIgnoreInaccuracy(false);
        }

        // update the settings
        $settings->setSite($site);
        if ($site == DownloadSite::ChessDotCom) {
            $settings->setChessUsername($siteUsername);
        } else {
            $settings->setLichessUsername($siteUsername);
        }

        // save the settings
        $this->em->persist($settings);
        $this->em->flush();

        // update in the user (just in case)
        $user->setSettings($settings);

        // check to see if any downloads are still in progress
        $repo = $this->em->getRepository(Downloads::class);

        $rec = $repo->findOneBy([
            'User' => $this->getUser(),
            'Status' => DownloadStatus::Downloading
        ]);

        // if there is a download in progress
        if ($rec !== null) {
            // check the datetime
            $now = new DateTime();

            $secs =  $now->getTimestamp() - $rec->getDateTime()->getTimestamp();
            $mins = floor($secs / 60);

            // if 5 minutes ago or more
            if ($mins > 4) {
                //if (true) {
                // update status for record
                $rec->setStatus(DownloadStatus::Partial);
                $rec->setDateTime(new DateTime());

                $this->em->persist($rec);
                $this->em->flush();
            } else {
                // send an error response
                $response = new JsonResponse(['error' => "Downloading already in progress, please try again later."]);
                $response->setStatusCode(409);

                return $response;
            }
        }

        // get the current year & month
        $today = new DateTime();
        $currentYear = intval($today->format('Y'));
        $currentMonth = intval($today->format('m'));

        // get the recent (from) year/month and the older (until) year/month
        $recent = new DateTime();
        $recent->modify("-11 months");
        $recentYear = intval($recent->format('Y'));
        $recentMonth = intval($recent->format('m'));

        $recent->modify("-1 months");
        $olderYear = intval($recent->format('Y'));
        $olderMonth = intval($recent->format('m'));

        // get the game downloader
        $downloader = new GameDownloader($this->em, $this->getUser());

        // get user - createdAt
        $createdAt = $downloader->getCreatedAt();

        // get the created year & month
        $created = new DateTime();
        $created->setTimestamp($createdAt / 1000);
        $createdYear = intval($created->format('Y'));
        $createdMonth = intval($created->format('m'));

        // get the year & month from & to
        $fromYear = $periodOlder ? $createdYear : $recentYear;
        $fromMonth = $periodOlder ? $createdMonth : $recentMonth;
        $toYear = $periodRecent ? $currentYear : $olderYear;
        $toMonth = $periodRecent ? $currentMonth : $olderMonth;

        // the max games to process
        $maxGames = 2; // 3
        $downloaded = 0;
        $completed = false;

        $games = [];

        // loop through the months
        $year = $toYear;
        $month = $toMonth;

        while ($year > $fromYear || $month >= $fromMonth) {
            // loop through the types
            foreach ($types as $type => $dtype) {
                // get the download record
                $rec = $this->getDownloadRecord($this->getUser(), null, $settings->getSite(), $year, $month, $dtype->value);
                if ($rec !== null) {
                    // if this download is completed, skip it
                    if ($rec->getStatus() == DownloadStatus::Completed) {
                        continue;
                    }

                    // get the last UUID
                    $lastUUID = $rec->getLastUUID() !== null ? $rec->getLastUUID() : "";

                    // download the games
                    $downloads = $downloader->downloadGames($year, $month, $type, $lastUUID, $maxGames);
                    $cnt = count($downloads);

                    // loop through the games
                    for ($i = 0; $i < $cnt; $i++) {
                        // process the game
                        $evals = $this->getGameEvaluations($downloads[$i], $siteUsername);

                        // add download info
                        $evals["site"] = $settings->getSite();
                        $evals["username"] = $siteUsername;
                        $evals["year"] = $year;
                        $evals["month"] = $month;
                        $evals["type"] = $dtype->value;

                        // add to the downloaded games
                        $games[] = $evals;

                        $downloaded++;

                        // stop when we've reached the max
                        if ($downloaded >= $maxGames) {
                            break;
                        }
                    }

                    // completed if no more games for this month (not if it's the current month)
                    $completed = count($downloads) == 0 && ($year != $currentYear || $month != $currentMonth);

                    // update the download record
                    $rec->setStatus($completed ? DownloadStatus::Completed : DownloadStatus::Partial);
                    //$rec->setStatus(DownloadStatus::Partial);
                    $rec->setDateTime(new DateTime());

                    $this->em->persist($rec);
                    $this->em->flush();
                }

                // stop when we've reached the max
                if ($downloaded >= $maxGames) {
                    break 2;
                }
            }

            // previous month
            if ($month > 1) {
                $month--;
            } else {
                $year--;
                $month = 12;
            }
        }

        return new JsonResponse([
            'message' => 'Download complete.',
            'downloaded' => $downloaded,
            'completed' => $downloaded == 0,
            'games' => $games,
            'period' => (new DateTime())->setDate($year, $month, 1)->format("F, Y")
        ]);
    }

    #[Route('/api/analyse/evaluate', methods: ['POST'], name: 'app_api_analyse_evaluate')]
    public function apiAnalyseEvaluate(Request $request): JsonResponse
    {
        // get the payload
        $payload = $request->getPayload()->all();

        // evaluate the game
        $mistakes = $this->evaluateGame($payload["game"]);
        // set the totals
        $totals = ["inaccuracies" => 0, "mistakes" => 0, "blunders" => 0];

        foreach ($mistakes as $mistake) {
            switch ($mistake["type"]) {
                case "inaccuracy":
                    $totals["inaccuracies"]++;
                    break;
                case "mistake":
                    $totals["mistakes"]++;
                    break;
                case "blunder":
                    $totals["blunders"]++;
                    break;
            }
        }

        //dd($totals, $mistakes, $payload["game"]);

        return new JsonResponse([
            'message' => 'Analysis done.',
            'totals' => $totals,
            'mistakes' => $mistakes
            //'period' => (new DateTime())->setDate($year, $month, 1)->format("F, Y")
        ]);

        dd($payload, $mistakes);

        // if there are any mistakes
        if (count($mistakes) > 0) {
            // get the initial fen
            $initialFen = $payload["game"]["fen"] !== null ? $payload["game"]["fen"] : "";
            // add them to the database
            foreach ($mistakes as $mistake) {
                // add the analysis
                $rc = new Analysis();

                $rc->setUser($this->getUser());
                $rc->setColor($payload["game"]["color"]);
                $rc->setWhite($payload["game"]["color"] == "white" ? $payload["username"] : $payload["game"]["opponent"]);
                $rc->setBlack($payload["game"]["color"] == "black" ? $payload["username"] : $payload["game"]["opponent"]);
                $rc->setLink($payload["game"]["link"]);
                $rc->setType($mistake["type"]);
                $rc->setInitialFen($initialFen);
                $rc->setFen($mistake["fen"]);
                $rc->setPgn(trim($mistake["line"]["pgn"]));
                $rc->setMove($mistake["move"]);
                $rc->setBestMoves(json_encode($mistake["bestmoves"]));

                // save it
                $this->em->persist($rc);
            }
        }

        // download record..
        // getDownloadRecord
        $rec = $this->getDownloadRecord($this->getUser(), null, $settings->getSite(), $year, $month, $dtype->value);
        if ($rec !== null) {
            // update the last UUID
            $rec->setDateTime(new DateTime());
            $rec->setLastUUID($payload["game"]["uuid"]);

            $this->em->persist($rec);
            $this->em->flush();
        }

        return $mistakes;


        return new JsonResponse([
            'message' => 'Download complete.'
        ]);
    }

    #[Route('/api/analyse/new', methods: ['GET', 'POST'], name: 'app_api_analyse_new')]
    public function apiAnalyseNewTest(Request $request): JsonResponse
    {
        // get the payload
        $payload = $request->getPayload()->all();

        $data = [
            "site" => isset($payload["site"]) ? $payload["site"] : "",
            "username" => isset($payload["username"]) ? $payload["username"] : "",
            "type" => isset($payload["type"]) ? $payload["type"] : [],
            "period" => isset($payload["period"]) ? $payload["period"] : ["recent" => 0, "older" => 0]
        ];

        // get & validate the site
        $site = DownloadSite::tryFrom($data["site"]);
        // get the site username
        $siteUsername = $data["username"];

        // get recent and/or older
        $periodRecent = isset($data["period"]["recent"]) ? ($data["period"]["recent"] ? true : false) : false;
        $periodOlder = isset($data["period"]["older"]) ? ($data["period"]["older"] ? true : false) : false;
        // get & validate the types
        $types = [];
        $tps = is_array($data["type"]) ? $data["type"] : [$data["type"]];
        foreach ($tps as $tp) {
            $dtype = DownloadType::tryFrom(ucfirst($tp));
            if ($dtype !== null) {
                $types[$tp] = $dtype;
            }
        }

        // if the payload is invalid
        if ($site == null || $siteUsername == "" || (!$periodRecent && !$periodOlder) || count($types) == 0) {
            // set the error response
            $response = new JsonResponse(['error' => "Invalid payload."]);
            $response->setStatusCode(411);

            return $response;
        }

        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        if ($settings == null) {
            // create the settings
            $settings = new Settings();
            $settings->setUser($this->getUser());
            $settings->setAnimationDuration(300);
        }

        // update the settings
        $settings->setSite($site);
        if ($site == DownloadSite::ChessDotCom) {
            $settings->setChessUsername($siteUsername);
        } else {
            $settings->setLichessUsername($siteUsername);
        }

        // save the settings
        $this->em->persist($settings);
        $this->em->flush();

        // update in the user (just in case)
        $user->setSettings($settings);

        // check to see if any downloads are still in progress
        $repo = $this->em->getRepository(Downloads::class);

        $rec = $repo->findOneBy([
            'User' => $this->getUser(),
            'Status' => DownloadStatus::Downloading
        ]);

        // if there is a download in progress
        if ($rec !== null) {
            // check the datetime
            $now = new DateTime();

            $secs =  $now->getTimestamp() - $rec->getDateTime()->getTimestamp();
            $mins = floor($secs / 60);

            // if 5 minutes ago or more
            if ($mins > 4) {
                //if (true) {
                // update status for record
                $rec->setStatus(DownloadStatus::Partial);
                $rec->setDateTime(new DateTime());

                $this->em->persist($rec);
                $this->em->flush();
            } else {
                // send an error response
                $response = new JsonResponse(['error' => "Downloading already in progress, please try again later."]);
                $response->setStatusCode(409);

                return $response;
            }
        }

        // get the current year & month
        $today = new DateTime();
        $currentYear = intval($today->format('Y'));
        $currentMonth = intval($today->format('m'));

        // get the recent (from) year/month and the older (until) year/month
        $recent = new DateTime();
        $recent->modify("-11 months");
        $recentYear = intval($recent->format('Y'));
        $recentMonth = intval($recent->format('m'));

        $recent->modify("-1 months");
        $olderYear = intval($recent->format('Y'));
        $olderMonth = intval($recent->format('m'));

        // get the game downloader
        $downloader = new GameDownloader($this->em, $this->getUser());

        // get user - createdAt
        $createdAt = $downloader->getCreatedAt();

        // get the created year & month
        $created = new DateTime();
        $created->setTimestamp($createdAt / 1000);
        $createdYear = intval($created->format('Y'));
        $createdMonth = intval($created->format('m'));

        // get the year & month from & to
        $fromYear = $periodOlder ? $createdYear : $recentYear;
        $fromMonth = $periodOlder ? $createdMonth : $recentMonth;
        $toYear = $periodRecent ? $currentYear : $olderYear;
        $toMonth = $periodRecent ? $currentMonth : $olderMonth;

        // start the engine
        $uci = new UCI();
        // request the 3 best moves
        $uci->setOption("MultiPV", 3);

        // the max games to process
        $maxGames = 3; // 4
        $processed = 0;
        $completed = false;

        // keep track of the mistakes per time control
        $mistakesPerType = [];
        foreach ($types as $type => $dtype) {
            $mistakesPerType[$type] = [];
        }

        // loop through the months
        $year = $toYear;
        $month = $toMonth;

        while ($year > $fromYear || $month >= $fromMonth) {

            //print $year . " - " . $month . "<br>";

            // loop through the types
            foreach ($types as $type => $dtype) {

                //print "download type: " . $type . "<br>";

                // get the download record
                $rec = $this->getDownloadRecord($this->getUser(), null, $settings->getSite(), $year, $month, $dtype->value);
                if ($rec !== null) {
                    // if this download is completed, skip it
                    if ($rec->getStatus() == DownloadStatus::Completed) {

                        //print "-- download completed, continue..<br>";

                        continue;
                    }

                    // get the last UUID
                    $lastUUID = $rec->getLastUUID() !== null ? $rec->getLastUUID() : "";

                    // download the games
                    $games = $downloader->downloadGames($year, $month, $type, $lastUUID, $maxGames);
                    $cnt = count($games);

                    // loop through the games
                    for ($i = 0; $i < $cnt; $i++) {
                        // process the game
                        $mistakes = $this->processGame($uci, $games[$i], $siteUsername, $rec);

                        if ($mistakes !== null) {
                            $mistakesPerType[$type] = array_merge($mistakesPerType[$type], $mistakes);
                        }

                        $processed++;

                        // update the last UUID
                        $rec->setDateTime(new DateTime());
                        $rec->setLastUUID($games[$i]["uuid"]);

                        $this->em->persist($rec);
                        $this->em->flush();

                        // stop when we've reached the max
                        if ($processed >= $maxGames) {
                            break;
                        }
                    }

                    // completed if no more games for this month (not if it's the current month)
                    $completed = count($games) == 0 && ($year != $currentYear || $month != $currentMonth);

                    //print count($games) . " games, completed = " . ($completed ? "yes" : "no") . "<br>";

                    // update the download record
                    $rec->setStatus($completed ? DownloadStatus::Completed : DownloadStatus::Partial);
                    $rec->setDateTime(new DateTime());

                    $this->em->persist($rec);
                    $this->em->flush();
                }

                // stop when we've reached the max
                if ($processed >= $maxGames) {
                    break 2;
                }
            }

            // previous month
            if ($month > 1) {
                $month--;
            } else {
                $year--;
                $month = 12;
            }
        }

        // set the totals
        $totals = ["inaccuracies" => 0, "mistakes" => 0, "blunders" => 0];

        foreach ($mistakesPerType as $type => $mistakes) {
            foreach ($mistakes as $mistake) {
                switch ($mistake["type"]) {
                    case "inaccuracy":
                        $totals["inaccuracies"]++;
                        break;
                    case "mistake":
                        $totals["mistakes"]++;
                        break;
                    case "blunder":
                        $totals["blunders"]++;
                        break;
                }
            }
        }

        return new JsonResponse([
            'message' => 'Analysis done.',
            'processed' => $processed,
            'completed' => $processed == 0,
            'totals' => $totals,
            'period' => (new DateTime())->setDate($year, $month, 1)->format("F, Y")
        ]);
    }

    #[Route('/api/analyse/opponent', methods: ['GET', 'POST'], name: 'app_api_analyse_opponent')]
    public function apiAnalyseOpponent(Request $request): JsonResponse
    {
        // get the payload
        $payload = $request->getPayload()->all();

        // set the data (with defaults for GET testing)
        $data = [
            "username" => isset($payload["username"]) ? $payload["username"] : "annacramling",
            "site" => isset($payload["site"]) ? $payload["site"] : "Chess.com",
            "type" => isset($payload["type"]) ? $payload["type"] : ["daily", "rapid", "blitz"]
        ];

        // recent and older games
        $periodRecent = true;
        $periodOlder = true;
        // get & validate the website
        $site = DownloadSite::tryFrom($data["site"]);
        // get & validate the types
        $types = [];
        $tps = is_array($data["type"]) ? $data["type"] : [$data["type"]];
        foreach ($tps as $tp) {
            $dtype = DownloadType::tryFrom(ucfirst($tp));
            if ($dtype !== null) {
                $types[$tp] = $dtype;
            }
        }

        // if the payload is invalid
        if ((!$periodRecent && !$periodOlder) || $site == null || count($types) == 0) {
            // set the error response
            $response = new JsonResponse(['error' => "Invalid payload."]);
            $response->setStatusCode(411);

            return $response;
        }

        //
        // - check to see if this opponent exists
        // - add the opponent if needed
        // - fetch opponent record
        //

        // check to see if opponent exists
        $repo = $this->em->getRepository(Opponent::class);

        $newOpponent = false;

        $opp = $repo->findOneBy([
            'Username' => $data["username"],
            'Site' => $site
        ]);
        if ($opp == null) {
            // add the opponent
            $opp = new Opponent();
            $opp->setUsername($data["username"]);
            $opp->setSite($site);
            $opp->setTotal(0);

            $this->em->persist($opp);
            $this->em->flush();

            $newOpponent = true;
        }

        // check to see if any downloads are still in progress
        $repo = $this->em->getRepository(Downloads::class);

        $rec = $repo->findOneBy([
            'Opponent' => $opp,
            'Status' => DownloadStatus::Downloading
        ]);

        // if there is a download in progress
        if ($rec !== null) {
            // check the datetime
            $now = new DateTime();

            $secs =  $now->getTimestamp() - $rec->getDateTime()->getTimestamp();
            $mins = floor($secs / 60);

            // if 5 minutes ago or more
            if ($mins > 4) {
                //if (true) {
                // update status for record
                $rec->setStatus(DownloadStatus::Partial);
                $rec->setDateTime(new DateTime());

                $this->em->persist($rec);
                $this->em->flush();
            } else {
                // send an error response
                $response = new JsonResponse(['error' => "Downloading already in progress, please try again later."]);
                $response->setStatusCode(409);

                return $response;
            }
        }

        // get the current year & month
        $today = new DateTime();
        $currentYear = intval($today->format('Y'));
        $currentMonth = intval($today->format('m'));

        // get the recent (from) year/month and the older (until) year/month
        $recent = new DateTime();
        $recent->modify("-11 months");
        $recentYear = intval($recent->format('Y'));
        $recentMonth = intval($recent->format('m'));

        $recent->modify("-1 months");
        $olderYear = intval($recent->format('Y'));
        $olderMonth = intval($recent->format('m'));

        // get the repertoire lines
        $repo = $this->em->getRepository(Repertoire::class);

        // get the repertoire lines and the group lines
        [$lines, $groups] = $repo->getLines();

        // get the game downloader
        $downloader = new GameDownloader($this->em, null, $opp);

        // get user - createdAt
        $createdAt = $downloader->getCreatedAt();

        // get the created year & month
        $created = new DateTime();
        $created->setTimestamp($createdAt / 1000);
        $createdYear = intval($created->format('Y'));
        $createdMonth = intval($created->format('m'));

        // get the year & month from & to
        $fromYear = $periodOlder ? $createdYear : $recentYear;
        $fromMonth = $periodOlder ? $createdMonth : $recentMonth;
        $toYear = $periodRecent ? $currentYear : $olderYear;
        $toMonth = $periodRecent ? $currentMonth : $olderMonth;

        // start the engine
        $uci = new UCI();
        // request the 3 best moves
        $uci->setOption("MultiPV", 3);

        // the max games to process
        $maxGames = 100;
        //$maxDownload = $site == DownloadSite::ChessDotCom ? 100 : 10;
        $maxDownload = 100;
        $processed = 0;
        $matches = 0;
        $completed = false;

        // keep track of the mistakes per time control
        $mistakesPerType = [];
        foreach ($types as $type => $dtype) {
            $mistakesPerType[$type] = [];
        }

        // keep track of the opponent move totals (to limit the amount of updates)
        $oppMoves = ["white" => [], "black" => []];

        // loop through the months
        $year = $toYear;
        $month = $toMonth;

        while ($year > $fromYear || $month >= $fromMonth) {

            //print $year . " - " . $month . "<br>";

            // loop through the types
            foreach ($types as $type => $dtype) {

                //print "download type: " . $type . "<br>";

                // get the download record
                $rec = $this->getDownloadRecord(null, $opp, $site, $year, $month, $dtype->value);
                if ($rec !== null) {
                    // if this download is completed, skip it
                    if ($rec->getStatus() == DownloadStatus::Completed) {

                        //print "-- download completed, continue..<br>";

                        continue;
                    }

                    // get the last UUID
                    $lastUUID = $rec->getLastUUID() !== null ? $rec->getLastUUID() : "";

                    // download the games
                    $games = $downloader->downloadGames($year, $month, $type, $lastUUID, $maxDownload);
                    $cnt = count($games);

                    //dd($games);

                    // loop through the games
                    for ($i = 0; $i < $cnt; $i++) {

                        /*

                    - "initial_setup" => only if empty
                    - "rules" => [chess, ?]
                    - 

                    */

                        // don't analyse games with an initial position - [Chess.com]
                        if (isset($games[$i]["initial_setup"]) && $games[$i]["initial_setup"] !== "") {
                            continue;
                        }

                        // make sure it's a regular chess game (skip crazyhouse, bughouse, etc) - [Chess.com]
                        if (isset($games[$i]["rules"]) && $games[$i]["rules"] !== "chess") {
                            continue;
                        }
                        // [Lichess]
                        if (isset($games[$i]["variant"]) && $games[$i]["variant"] !== "standard") {
                            continue;
                        }

                        // process the game
                        $oppGame = $this->analyseOpponentGame($games[$i], $opp, $lines);
                        // if no game or no moves, skip it
                        if ($oppGame === false || count($oppGame["moves"]) == 0) {
                            continue;
                        }

                        if ($oppGame["match"]) {
                            $matches++;
                        }

                        $processed++;

                        // add the opponent game
                        $oppg = new OpponentGame();
                        $oppg->setOpponent($opp);
                        $oppg->setColor($oppGame["color"]);
                        $oppg->setResult($oppGame["result"]);
                        $oppg->setPgn($oppGame["pgn"]);

                        $this->em->persist($oppg);

                        //dd($oppGame);

                        // keep track of the move totals
                        foreach ($oppGame["moves"] as $move) {
                            // if we don't have this position yet
                            if (!isset($oppMoves[$oppGame["color"]][$move["before"]])) {
                                $oppMoves[$oppGame["color"]][$move["before"]] = [];
                            }
                            // if we don't have this move yet
                            if (!isset($oppMoves[$oppGame["color"]][$move["before"]][$move["move"]])) {
                                $oppMoves[$oppGame["color"]][$move["before"]][$move["move"]] = [
                                    "pgn" => $move["pgn"],
                                    "matches" => $move["match"],
                                    "wins" => 0,
                                    "draws" => 0,
                                    "losses" => 0
                                ];
                            }

                            switch ($oppGame["result"]) {
                                case "win":
                                    $oppMoves[$oppGame["color"]][$move["before"]][$move["move"]]["wins"]++;
                                    break;
                                case "draw":
                                    $oppMoves[$oppGame["color"]][$move["before"]][$move["move"]]["draws"]++;
                                    break;
                                case "loss":
                                    $oppMoves[$oppGame["color"]][$move["before"]][$move["move"]]["losses"]++;
                                    break;
                            }
                        }

                        // update the last UUID
                        $rec->setDateTime(new DateTime());
                        $rec->setLastUUID($games[$i]["uuid"]);

                        $this->em->persist($rec);

                        //$this->em->flush();

                        // stop when we've reached the max
                        if ($processed >= $maxGames) {
                            break;
                        }
                    }

                    // completed if no more games for this month (not if it's the current month)
                    $completed = count($games) == 0 && ($year != $currentYear || $month != $currentMonth);

                    //print count($games) . " games, completed = " . ($completed ? "yes" : "no") . "<br>";

                    // update the download record
                    $rec->setStatus($completed ? DownloadStatus::Completed : DownloadStatus::Partial);
                    $rec->setDateTime(new DateTime());

                    $this->em->persist($rec);
                    //$this->em->flush();
                }

                // stop when we've reached the max
                if ($processed >= $maxGames) {
                    break;
                }
            }

            // stop when we've reached the max
            if ($processed >= $maxGames) {
                break;
            }

            // previous month
            if ($month > 1) {
                $month--;
            } else {
                $year--;
                $month = 12;
            }
        }

        // save the opponent moves
        $this->saveOpponentMoves($opp, $oppMoves);

        // update the totals for the opponent
        $opp->setTotal($opp->getTotal() + $processed);

        $this->em->persist($opp);
        $this->em->flush();

        // set the totals
        $totals = ["inaccuracies" => 0, "mistakes" => 0, "blunders" => 0];

        foreach ($mistakesPerType as $type => $mistakes) {
            foreach ($mistakes as $mistake) {
                switch ($mistake["type"]) {
                    case "inaccuracy":
                        $totals["inaccuracies"]++;
                        break;
                    case "mistake":
                        $totals["mistakes"]++;
                        break;
                    case "blunder":
                        $totals["blunders"]++;
                        break;
                }
            }
        }

        return new JsonResponse([
            'message' => 'Analysis done.',
            'opponent' => [
                'id' => $opp->getId(),
                'username' => $opp->getUsername(),
                'site' => $opp->getSite()->value,
                'total' => $opp->getTotal(),
                'new' => $newOpponent
            ],
            'processed' => $processed,
            'completed' => $processed == 0,
            'matches' => $matches,
            'period' => (new DateTime())->setDate($year, $month, 1)->format("F, Y")
        ]);
    }

    //
    private function saveOpponentMoves($opponent, $oppMoves)
    {
        // get the opponent move repository
        $repo = $this->em->getRepository(OpponentMove::class);

        // save the opponent moves
        foreach ($oppMoves as $color => $fens) {
            foreach ($fens as $fen => $moves) {
                foreach ($moves as $move => $details) {
                    // find the opponent move
                    $rec = $repo->findOneBy([
                        'Opponent' => $opponent,
                        'Color' => $color,
                        //'Fen' => $fen,
                        'Pgn' => $details["pgn"],
                        'Move' => $move
                    ]);

                    // if found
                    if ($rec) {
                        // update the totals
                        $rec->setWins($rec->getWins() + $details["wins"]);
                        $rec->setDraws($rec->getDraws() + $details["draws"]);
                        $rec->setLosses($rec->getLosses() + $details["losses"]);
                    } else {
                        // add the move
                        $rec = new OpponentMove();
                        $rec->setOpponent($opponent);
                        $rec->setColor($color);
                        $rec->setFen($fen);
                        $rec->setPgn($details["pgn"]);
                        $rec->setMove($move);
                        $rec->setMatches($details["matches"]);
                        $rec->setWins($details["wins"]);
                        $rec->setDraws($details["draws"]);
                        $rec->setLosses($details["losses"]);
                    }

                    $this->em->persist($rec);
                }
            }
        }

        $this->em->flush();
    }

    #[Route('/api/opponent/{id}', methods: ['GET'], name: 'app_api_opponent_get')]
    public function apiGetOpponent(Request $request, $id): JsonResponse
    {
        // the response
        $resp = [];

        // find the opponent
        $repo = $this->em->getRepository(Opponent::class);

        $opp = $repo->find($id);
        if ($opp) {
            // get the opponent lines for white & black
            $resp = $this->getOpponentLines($opp);
        } else {
            $resp = [
                "message" => "Opponent not found.",
                "white" => [],
                "black" => []
            ];
        }

        return new JsonResponse($resp);
    }

    // get the opponent lines
    private function getOpponentLines($opponent, $color = "", $pgn = "")
    {
        $moves = [
            "white" => ["moves" => [], "suggestions" => []],
            "black" => ["moves" => [], "suggestions" => []]
        ];

        $ecos = [];
        $hasMore = true;

        // in case an opponent move is now in our repertoire, we need to fetch the lines to get the new opponent moves
        $linesFetched = false;
        $lines = [];
        $newRepertoireMoves = 0;

        // in case we are getting a specific line, we need to skip the PGN moves
        $skip = [];
        if ($color !== "" && $pgn !== "") {
            $temp = explode(" ", $pgn);
            for ($i = 0; $i < count($temp); $i++) {
                // if this is not a move number
                if (preg_match('/^\\d+\\./', $temp[$i]) !== 1 && trim($temp[$i]) != "") {
                    $skip[] = $temp[$i];
                }
            }
        }

        $repoRep = $this->em->getRepository(Repertoire::class);

        // get the opponent moves
        $qb = $this->em->createQueryBuilder('OpponentMove');
        $query = $qb->select('om')
            ->from('App\Entity\Main\OpponentMove', 'om')
            ->where('om.Opponent = :opp')
            ->setParameter('opp', $opponent);

        // if we need to fetch a specific line
        if ($color !== "" && $pgn !== "") {
            $query = $query->andWhere('om.Color = :color')
                ->andWhere($qb->expr()->like('om.Pgn', 'CONCAT(:pgn, \' %\')'))
                ->setParameter('color', $color)
                ->setParameter('pgn', $pgn);
        }

        $query = $query->addOrderBy('om.Color', 'ASC')
            ->addOrderBy('om.Pgn', 'ASC')->getQuery();

        $res = $query->getResult();

        foreach ($res as $rec) {
            // find the ECO from the parent moves
            $eco = null;
            $hasMore = true;
            if ($rec->getPgn() !== "") {
                foreach ($ecos as $parent) {
                    if (substr($rec->getPgn(), 0, strlen($parent["pgn"])) == $parent["pgn"]) {
                        $eco = $parent["eco"];
                        //$eco = ["code" => "parent", "name" => $parent];
                        $hasMore = $parent["hasMore"];

                        if (!$hasMore) {
                            break;
                        }
                    }
                }
            }

            // find the ECO for this move
            if ($rec->getPgn() !== "" && $hasMore) {

                $thisEco = $this->em->getRepository(ECO::class)->findCode($rec->getPgn());
                if ($thisEco) {
                    $eco = $thisEco;
                    $eco["pgn"] = $rec->getPgn();

                    $hasMore = $this->em->getRepository(ECO::class)->hasMore($rec->getPgn());

                    $ecos[] = [
                        "pgn" => $rec->getPgn(),
                        "eco" => $eco,
                        "hasMore" => $hasMore
                    ];
                }
            }

            // the new child moves, in case we are adding new opponent moves based off this one (see below)
            $newChildMoves = [];

            // if this move wasn't matched earlier, check to see if we have it in our repertoire now
            $rep = null;
            // only if we are doing a top level call (not a specific line, that's called from the top level call only)
            if ($color == "" && $pgn == "" && !$rec->isMatches()) {
                // find the move in our repository (opposite color)
                $rep = $repoRep->findOneBy([
                    'Color' => $rec->getColor() == "white" ? "black" : "white",
                    'FenBefore' => $rec->getFen(),
                    'Move' => $rec->getMove()
                ]);

                // if we now have this move in our repertoire
                if ($rep) {

                    //dd($rec, $rep);

                    $newRepertoireMoves++;

                    // if we haven't fetched the lines yet
                    if (!$linesFetched) {
                        // get the repertoire lines
                        [$lines, $groups] = $repoRep->getLines();

                        $linesFetched = true;
                    }

                    $oppMoves = [];

                    // get the opponent games
                    $games = $this->getOpponentGames($opponent, $rec->getColor(), $rec->getPgn());
                    foreach ($games as $game) {
                        // get the new opponent moves
                        $newMoves = $this->getOpponentMoves($rec->getColor(), $lines, $game["moves"]);

                        // filter the moves based on the PGN (those opponent moves already exist)
                        $filtered = [];
                        foreach ($newMoves as $move) {
                            if (strlen($move["pgn"]) > strlen($rec->getPgn())) {
                                $filtered[] = $move;
                            }
                        }

                        // keep track of the move totals
                        foreach ($filtered as $move) {
                            // if we don't have this position yet
                            if (!isset($oppMoves[$rec->getColor()][$move["before"]])) {
                                $oppMoves[$rec->getColor()][$move["before"]] = [];
                            }
                            // if we don't have this move yet
                            if (!isset($oppMoves[$rec->getColor()][$move["before"]][$move["move"]])) {
                                $oppMoves[$rec->getColor()][$move["before"]][$move["move"]] = [
                                    "pgn" => $move["pgn"],
                                    "matches" => $move["match"],
                                    "wins" => 0,
                                    "draws" => 0,
                                    "losses" => 0
                                ];
                            }

                            switch ($game["result"]) {
                                case "win":
                                    $oppMoves[$rec->getColor()][$move["before"]][$move["move"]]["wins"]++;
                                    break;
                                case "draw":
                                    $oppMoves[$rec->getColor()][$move["before"]][$move["move"]]["draws"]++;
                                    break;
                                case "loss":
                                    $oppMoves[$rec->getColor()][$move["before"]][$move["move"]]["losses"]++;
                                    break;
                            }
                        }
                    }

                    // save the opponent moves
                    $this->saveOpponentMoves($opponent, $oppMoves);

                    // get the newly added moves for this line
                    $newChildMoves = $this->getOpponentLines($opponent, $rec->getColor(), $rec->getPgn());

                    // this move now matches, update it
                    $rec->setMatches(true);

                    $this->em->persist($rec);
                    $this->em->flush();
                }
            }

            // get the moves for this line
            $line = [];
            $idx = 0;
            $temp = explode(" ", $rec->getPgn());
            for ($i = 0; $i < count($temp); $i++) {
                // if this is not a move number
                if (preg_match('/^\\d+\\./', $temp[$i]) !== 1 && trim($temp[$i]) != "") {
                    // if we can add this move
                    if ($idx >= count($skip)) {
                        //if (count($line) )
                        $line[] = $temp[$i];
                    }
                    $idx++;
                }
            }

            // remove the current move from the line
            array_pop($line);

            // get the correct moves array in the tree
            $_moves = &$moves[$rec->getColor()]["moves"];
            foreach ($line as $move) {
                // safety, should not happen..
                if (!isset($_moves[$move])) {
                    $_moves[$move] = [
                        "id" => -1,
                        "wins" => 0,
                        "draws" => 0,
                        "losses" => 0,
                        "matches" => 0,
                        "fetched" => 1,
                        "moves" => []
                    ];
                }
                $_moves = &$_moves[$move]["moves"];
            }

            // add the move
            $_moves[$rec->getMove()] = [
                "fen" => $rec->getFen(),
                "pgn" => $rec->getPgn(),
                "id" => $rec->getId(),
                "eco" => $eco,
                "wins" => $rec->getWins(),
                "draws" => $rec->getDraws(),
                "losses" => $rec->getLosses(),
                "matches" => $rec->isMatches(),
                "fetched" => $rec->isMatches() ? 1 : 0,
                "moves" => $newChildMoves
            ];
        }

        $moves["newRepertoireMoves"] = $newRepertoireMoves;


        /*

        - if matches = 0 (not in our repertoire)
        - check percentage played ?
        - if high enough (> 10 ??)
        - add to list of suggestions (to add to our repertoire)
        - up to move 15?

        */

        // get the suggestions
        if ($color == "") {

            //dd($moves["white"]["moves"]);

            // 1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 a6 5. c5 b5

            //dd($moves["white"]["moves"]["d4"]["moves"]["d5"]["moves"]["c4"]["moves"]["c6"]["moves"]["Nf3"]["moves"]["Nf6"]);

            //$this->getOpponentSuggestions($moves["white"]["moves"]);

            //dd("after white");

            $moves["white"]["suggestions"] = $this->getOpponentSuggestions("white", $moves["white"]["moves"]);
            $moves["black"]["suggestions"] = $this->getOpponentSuggestions("black", $moves["black"]["moves"]);
        }


        return $color == "" ? $moves : $moves[$color]["moves"];
    }

    // get suggestions based on the opponent moves (to add to our repertoire)
    private function getOpponentSuggestions($color, $moves, $halfmove = 1)
    {
        $suggestions = [];

        // keep track of the total for all moves
        $total = 0;
        // we don't have to check percentage played if all moves are already in our repertoire
        $matchAll = true;

        // get the total of these moves and get the child moves suggestions
        foreach ($moves as $move => $details) {
            // if we have this move in our repertoire, check the child moves
            if ($details["matches"]) {
                $sugg = $this->getOpponentSuggestions($color, $details["moves"], $halfmove + 1);
                foreach ($sugg as $s) {
                    $suggestions[] = $s;
                }
            } else {
                $matchAll = false;
            }

            $sub = $details["wins"] + $details["draws"] + $details["losses"];

            $total += $sub;
        }

        // if this is the opponent's move and we need to check for suggestions (at least 10 games for this position)
        if ((($color == "white" && $halfmove % 2 !== 0) || ($color == "black" && $halfmove % 2 == 0)) && !$matchAll && $total > 10) {
            //
            $repo = $this->em->getRepository(Repertoire::class);
            //
            foreach ($moves as $move => $details) {
                if ($details["matches"]) {
                    continue;
                }

                $sub = $details["wins"] + $details["draws"] + $details["losses"];

                $pctPlayed = $total == 0 ? 100 : ($sub / $total) * 100;

                // if this move is played 25% of the time or more
                if ($pctPlayed >= 30) {
                    // see if we have other moves for this position
                    $res = $repo->findBy([
                        'User' => $this->getUser(),
                        'Color' => $color == "white" ? "black" : "white",
                        'FenBefore' => $details["fen"]
                    ]);

                    // only add the suggestion if we have other moves here (not for end of line positions)
                    if (count($res) > 0) {
                        // get the line
                        $line = [];
                        $temp = explode(" ", $details["pgn"]);
                        for ($i = 0; $i < count($temp); $i++) {
                            // if this is not a move number
                            if (preg_match('/^\\d+\\./', $temp[$i]) !== 1 && trim($temp[$i]) != "") {
                                $line[] = $temp[$i];
                            }
                        }
                        // add the suggestion
                        $suggestions[] = [
                            'halfmove' => $halfmove,
                            'move' => $move,
                            'eco' => $details["eco"],
                            'pgn' => $details["pgn"],
                            'line' => $line,
                            'percentage' => $pctPlayed . "%"
                        ];
                    }
                }
            }
        }

        return $suggestions;
    }

    #[Route('/api/opponent/moves', methods: ['POST'], name: 'app_api_opponent_get_moves')]
    public function apiGetOpponentMoves(Request $request): JsonResponse
    {
        // get the payload (if posted)
        $data = $request->getPayload()->all();

        $oppId = isset($data["id"]) ? $data["id"] : null;
        $color = isset($data["color"]) ? $data["color"] : null;
        $pgn = isset($data["pgn"]) ? $data["pgn"] : null;

        // get the line
        $line = [];
        $temp = explode(" ", $pgn);
        for ($i = 0; $i < count($temp); $i++) {
            // if this is not a move number
            if (preg_match('/^\\d+\\./', $temp[$i]) !== 1 && trim($temp[$i]) != "") {
                $line[] = $temp[$i];
            }
        }

        // the response
        $resp = [];

        // find the opponent
        $repo = $this->em->getRepository(Opponent::class);

        $opp = $repo->find($oppId);
        if ($opp) {

            $moves = [
                "pgn" => $pgn,
                "move" => end($line),
                "moves" => []
            ];

            // get the ECO for this move
            $rootEco = $this->em->getRepository(ECO::class)->findCode($pgn);
            $rootMore = $rootEco == null ? false : $this->em->getRepository(ECO::class)->hasMore($pgn);

            // get the opponent games
            $games = $this->getOpponentGames($opp, $color, $pgn);
            foreach ($games as $rec) {
                // follow the games 5 moves deep
                $slice = array_slice($rec["moves"], count($line), 5);

                // set the parent ECO to the root ECO
                $eco = $rootEco;
                $hasMore = $rootMore;

                // get the move pgn
                $movePgn = "";
                $moveIdx = 0;
                foreach ($line as $mv) {
                    $movePgn .= ($movePgn !== "" ? " " : "") . ($moveIdx % 2 == 0 ? ($moveIdx / 2 + 1) . ". " : "") . $mv;
                    $moveIdx++;
                }

                // get the correct moves array in the tree
                $_moves = &$moves["moves"];

                // add the moves
                $cnt = 0;
                foreach ($slice as $move) {
                    // add to the pgn
                    $movePgn .= ($movePgn !== "" ? " " : "") . ($moveIdx % 2 == 0 ? ($moveIdx / 2 + 1) . ". " : "") . $move;
                    $moveIdx++;
                    // add the move if it doesn't exist yet
                    if (!isset($_moves[$move])) {
                        // get the ECO for this move
                        if ($hasMore) {
                            $thisEco = $this->em->getRepository(ECO::class)->findCode($movePgn);
                            if ($thisEco) {
                                $eco = $thisEco;
                                $hasMore = $this->em->getRepository(ECO::class)->hasMore($movePgn);
                            } else {
                                $hasMore = false;
                            }
                        }

                        $_moves[$move] = [
                            "pgn" => $movePgn,
                            "eco" => $eco,
                            "wins" => 0,
                            "draws" => 0,
                            "losses" => 0,
                            "matches" => 0,
                            "fetched" => $cnt == 4 ? 0 : 1,
                            "moves" => []
                        ];
                    }

                    // add the totals
                    switch ($rec["result"]) {
                        case "win":
                            $_moves[$move]["wins"]++;
                            break;
                        case "draw":
                            $_moves[$move]["draws"]++;
                            break;
                        case "loss":
                            $_moves[$move]["losses"]++;
                            break;
                    }

                    $_moves = &$_moves[$move]["moves"];
                    $cnt++;
                }
            }

            return new JsonResponse($moves);
        } else {
            return new JsonResponse([
                "message" => "Opponent not found.",
                "color" => $color,
                "moves" => []
            ]);
        }
    }

    // get the opponent games for a certain PGN, adding an array with the moves
    private function getOpponentGames($opponent, $color, $pgn)
    {
        $games = [];

        $qb = $this->em->createQueryBuilder();
        $query = $qb->select('og')
            ->from('App\Entity\Main\OpponentGame', 'og')
            ->where('og.Opponent = :opp')
            ->andWhere('og.Color = :color')
            ->andWhere($qb->expr()->like('og.Pgn', 'CONCAT(:pgn, \'%\')'))
            ->setParameter('opp', $opponent)
            ->setParameter('color', $color)
            ->setParameter('pgn', $pgn)
            ->orderBy('og.Pgn', 'ASC')
            ->getQuery();

        $res = $query->getArrayResult();

        foreach ($res as $rec) {
            // get the game moves
            $moves = [];
            $temp = explode(" ", $rec["Pgn"]);
            for ($i = 0; $i < count($temp); $i++) {
                // if this is not a move number
                if (preg_match('/^\\d+\\./', $temp[$i]) !== 1 && trim($temp[$i]) != "") {
                    $moves[] = $temp[$i];
                }
            }

            $games[] = [
                "id" => $rec["id"],
                "result" => $rec["Result"],
                "pgn" => $rec["Pgn"],
                "moves" => $moves
            ];
        }

        return $games;
    }

    //
    private function getDownloadRecord(?UserInterface $user, ?Opponent $opponent, $site, $year, $month, $type): mixed
    {
        // get the repository
        $repository = $this->em->getRepository(Downloads::class);

        // set the criteria
        $crit = [
            'Type' => $type,
            'Year' => $year,
            'Month' => $month
        ];

        if ($user) {
            $crit['User'] = $user;
        } else {
            $crit['Opponent'] = $opponent;
        }

        // find the download record
        $rec = $repository->findOneBy($crit);

        // if there is a download record
        if ($rec !== null) {
            // depending the status
            switch ($rec->getStatus()) {
                case DownloadStatus::Downloading:
                    break;
                case DownloadStatus::Completed:
                    break;
                case DownloadStatus::Partial:
                    // update the status
                    $rec->setStatus(DownloadStatus::Downloading);
                    $rec->setDateTime(new DateTime());

                    $this->em->persist($rec);
                    $this->em->flush();

                    break;
            }
        } else {
            // add download record
            $rec = new Downloads();
            if ($user) {
                $rec->setUser($this->getUser());
            } else {
                $rec->setOpponent($opponent);
            }
            $rec->setSite($site);
            $rec->setYear($year);
            $rec->setMonth($month);
            $rec->setType($type);
            $rec->setStatus(DownloadStatus::Downloading);
            $rec->setDateTime(new DateTime());

            $this->em->persist($rec);
            $this->em->flush();
        }

        return $rec;
    }

    // parse & analyse an opponent game
    private function analyseOpponentGame($data, $opponent, $lines): array
    {
        // make sure we have a PGN
        if (!isset($data["pgn"])) {
            return false;
        }

        // parse the game
        $game = $this->myPgnParser->parsePgnFromText($data["pgn"], true);

        // get the color
        $color = strtolower($game->getWhite()) == strtolower($opponent->getUsername()) ? "white" : "black";
        // get the result
        $result = '';
        switch ($game->getResult()) {
            case '1-0':
                $result = $color == "white" ? "win" : "loss";
                break;
            case '0-1':
                $result = $color == "black" ? "win" : "loss";
                break;
            case '1/2-1/2':
                $result = 'draw';
                break;
        }

        // get the opponent moves for our repertoire
        $moves = $this->getOpponentMoves($color, $lines, $game->getMovesArray());

        $oppGame = [
            "color" => $color,
            "result" => $result,
            "pgn" => $game->getMovesPgn(),
            "match" => $moves !== false ? true : false,
            "moves" => $moves !== false ? $moves : []
        ];

        return $oppGame;
    }

    // get the opponent moves for a game, based off our repertoire
    private function getOpponentMoves($color, $lines, $gameMoves)
    {
        $oppMoves = [];
        $gameMatch = false;

        foreach ($lines as $line) {
            // we need the opposite color lines to check our own repertoire moves
            if ($line["color"] !== $color) {
                // keep track of the pgn
                $pgn = "";
                $idx = 0;
                // loop through opponent moves until it stops matching
                foreach ($gameMoves as $move) {
                    // get the moves for this line
                    $moves = isset($line["moves"]) ? $line["moves"] : [];
                    // get the FEN after
                    $after = $line["after"];
                    // see if we have this move in our repertoire
                    $match = false;
                    foreach ($moves as $mov) {
                        if ($mov["move"] == $move) {
                            // we have a match, get the next line
                            $match = true;
                            $gameMatch = true;
                            $line = $mov;
                            break;
                        }
                    }

                    // set the pgn for the next moves
                    $pgn .= ($idx > 0 ? " " : "") . ($idx % 2 == 0 ? ($idx / 2 + 1) . ". " : "") . $move;

                    // add to the opponent moves
                    $oppMoves[] = [
                        "before" => $after,
                        "pgn" => $pgn,
                        "move" => $move,
                        "match" => $match
                    ];

                    // if this move was a match
                    if ($match) {
                        $idx++;
                    } else {
                        break;
                    }
                }
            }

            // if we have a game match, stop the loop
            if ($gameMatch) {
                break;
            }
        }

        return $gameMatch ? $oppMoves : false;
    }

    private function processGame($uci, $game, $siteUsername, $drec)
    {
        if (!isset($game["pgn"])) {
            return null;
        }

        // parse the game
        $parsed = $this->myPgnParser->parsePgnFromText($game["pgn"], true);

        // analyse the game
        [$mistakes, $count] = $this->analyseGame($uci, $parsed, $siteUsername);

        // if there are any mistakes
        if (count($mistakes) > 0) {
            // get the initial fen
            $initialFen = $parsed->getFen() !== null ? $parsed->getFen() : "";
            // add them to the database
            foreach ($mistakes as $mistake) {
                // add the analysis
                $rc = new Analysis();

                $rc->setUser($this->getUser());
                $rc->setColor($parsed->getWhite() == $siteUsername ? "white" : "black");
                $rc->setWhite($parsed->getWhite());
                $rc->setBlack($parsed->getBlack());
                $rc->setLink($parsed->getLink());
                $rc->setType($mistake["type"]);
                $rc->setInitialFen($initialFen);
                $rc->setFen($mistake["fen"]);
                $rc->setPgn(trim($mistake["line"]["pgn"]));
                $rc->setMove($mistake["move"]);
                $rc->setBestMoves(json_encode($mistake["bestmoves"]));

                // save it
                $this->em->persist($rc);
            }
        }

        // update the last UUID
        $drec->setDateTime(new DateTime());
        $drec->setLastUUID($game["uuid"]);

        $this->em->persist($drec);
        $this->em->flush();

        return $mistakes;
    }

    #[Route('/api/analyse/{type}/{year}/{month}', methods: ['GET'], name: 'app_api_analyse')]
    public function apiAnalyseGames(Request $request, $type, $year, $month): JsonResponse
    {

        // validate the type - return error
        $downloadType = DownloadType::tryFrom(ucfirst($type));

        $resp = ['type' => $type, 'year' => $year, 'month' => $month];

        if ($downloadType == null) {

            $resp['test'] = 'testing 411 response with symfony';

            // testing..

            $jsonResponse = new JsonResponse(['error' => "Invalid type given."]);

            $jsonResponse->setStatusCode(411);

            return $jsonResponse;
        }


        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        // get the correct username
        $siteUsername = $settings->getSite() == DownloadSite::ChessDotCom ? $settings->getChessUsername() : $settings->getLichessUsername();

        // get the repository
        $repository = $this->em->getRepository(Downloads::class);

        // find the download record
        $rec = $repository->findOneBy([
            'User' => $this->getUser(),
            'Type' => $type,
            'Year' => $year,
            'Month' => $month
        ]);

        // the UUID of the last game we processed
        $lastUUID = "";

        // if there is a download record
        if ($rec !== null) {
            // depending the status
            switch ($rec->getStatus()) {
                case DownloadStatus::Downloading:
                    // check the datetime
                    $now = new DateTime();

                    $secs =  $now->getTimestamp() - $rec->getDateTime()->getTimestamp();
                    $mins = floor($secs / 60);

                    // if 5 minutes ago or more
                    if ($mins > 4) {
                        //if (true) {
                        // update status for record
                        $rec->setStatus(DownloadStatus::Partial);
                        $rec->setDateTime(new DateTime());

                        $this->em->persist($rec);
                        $this->em->flush();
                    } else {
                        // send an error response
                        $jsonResponse = new JsonResponse(['error' => "Downloading already in progress, please try again later."]);
                        $jsonResponse->setStatusCode(409);

                        return $jsonResponse;
                    }

                    break;
                case DownloadStatus::Completed:
                    // send an error response
                    $jsonResponse = new JsonResponse(['error' => "Download already completed."]);
                    $jsonResponse->setStatusCode(409);

                    return $jsonResponse;

                    break;
                case DownloadStatus::Partial:
                    // update the status
                    $rec->setStatus(DownloadStatus::Downloading);
                    $rec->setDateTime(new DateTime());

                    $this->em->persist($rec);
                    $this->em->flush();

                    break;
            }

            // get the last UUID
            $lastUUID = $rec->getLastUUID();
            if ($lastUUID == null) {
                $lastUUID = "";
            }
        } else {

            // add download record
            $rec = new Downloads();
            $rec->setUser($this->getUser());
            $rec->setSite($settings->getSite());
            $rec->setYear($year);
            $rec->setMonth($month);
            $rec->setType($downloadType->value);
            $rec->setStatus(DownloadStatus::Downloading);
            $rec->setDateTime(new DateTime());

            $this->em->persist($rec);
            $this->em->flush();
        }

        // get the game downloader
        $downloader = new GameDownloader($this->em, $this->getUser());

        // download the games
        $games = $downloader->downloadGames($year, $month, $type, $lastUUID);

        // old = ->xxdownloadGames($year, $month)
        // get the games of the right type
        //$games = $downloader->xxgetGames($type);

        // start the engine
        $uci = new UCI();

        // request the 3 best moves
        $uci->setOption("MultiPV", 3);
        // request only the best move
        //$uci->setOption("MultiPV", 1);

        // keep track of the duration
        $time = microtime(true);

        $lastUUIDFound = false;

        if ($settings->getSite() == DownloadSite::Lichess) {
            $lastUUID = "";
        }

        // the max games to process
        $maxGames = 4;
        //$maxGames = 1;
        $processed = 0;
        $completed = false;

        $mistakes = [];

        $cnt = count($games);

        for ($i = 0; $i < $cnt; $i++) {
            // if we can process this game
            if ($lastUUID == "" || $lastUUIDFound) {

                // safety check..
                if (!isset($games[$i]["pgn"])) {
                    continue;
                }

                // parse the game
                $game = $this->myPgnParser->parsePgnFromText($games[$i]["pgn"], true);

                // analyse the game
                [$temp, $count] = $this->analyseGame($uci, $game, $siteUsername);

                // if there are any mistakes
                if (count($temp) > 0) {
                    // add them to the array
                    $mistakes[] = [
                        "white" => $game->getWhite(),
                        "black" => $game->getBlack(),
                        "link" => $game->getLink(),
                        "mistakes" => $temp
                    ];

                    // get the initial fen
                    $initialFen = $game->getFen() !== null ? $game->getFen() : "";

                    // add them to the database
                    foreach ($temp as $mistake) {
                        // add the analysis
                        $rc = new Analysis();

                        $rc->setUser($this->getUser());
                        $rc->setColor($game->getWhite() == $siteUsername ? "white" : "black");
                        $rc->setWhite($game->getWhite());
                        $rc->setBlack($game->getBlack());
                        $rc->setLink($game->getLink());
                        $rc->setType($mistake["type"]);
                        $rc->setInitialFen($initialFen);
                        $rc->setFen($mistake["fen"]);
                        $rc->setPgn(trim($mistake["line"]["pgn"]));
                        $rc->setMove($mistake["move"]);

                        /*
                        $bms = [];
                        foreach ($mistake["bestmoves"] as $bm) {
                            $bms[] = $bm["san"];
                        }
                        $rc->setBestMoves(join(" ", $bms));
                        */
                        $rc->setBestMoves(json_encode($mistake["bestmoves"]));

                        // save it
                        $this->em->persist($rc);
                    }
                }

                $processed++;

                // update the last UUID
                $rec->setDateTime(new DateTime());
                $rec->setLastUUID($games[$i]["uuid"]);

                $this->em->persist($rec);
                $this->em->flush();
            } else if ($lastUUID != "") {
                // match the last UUID we processed
                $lastUUIDFound = $lastUUID == $games[$i]["uuid"];
            }

            // completed all games
            $completed = $i + 1 >= $cnt;

            // stop when we've reached the max
            if ($processed >= $maxGames) {
                break;
            }
        }

        $completed = $settings->getSite() == DownloadSite::ChessDotCom ? $completed : $processed < $maxGames;

        // update the status
        $rec->setStatus($completed ? DownloadStatus::Completed : DownloadStatus::Partial);
        $rec->setDateTime(new DateTime());

        $this->em->persist($rec);
        $this->em->flush();

        // set the totals
        $totals = ["inaccuracies" => 0, "mistakes" => 0, "blunders" => 0];

        foreach ($mistakes as $mistake) {
            foreach ($mistake["mistakes"] as $mis) {
                switch ($mis["type"]) {
                    case "inaccuracy":
                        $totals["inaccuracies"]++;
                        break;
                    case "mistake":
                        $totals["mistakes"]++;
                        break;
                    case "blunder":
                        $totals["blunders"]++;
                        break;
                }
            }
        }

        return new JsonResponse([
            'message' => 'Analysis done.',
            'processed' => $processed,
            'completed' => $completed,
            'totals' => $totals
        ]);
    }

    #[Route('/api/analysis', methods: ['DELETE'], name: 'app_api_analysis_delete')]
    public function apiAnalysisDelete(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        $qb = $this->em->createQueryBuilder();

        // delete the analysis for this user, fen & move
        $query = $qb->delete('App\Entity\Main\Analysis', 'a')
            ->where('a.User = :user AND a.Fen = :fen AND a.Move = :move')
            ->setParameter('user', $this->getUser())
            ->setParameter('fen', $data["fen"])
            ->setParameter('move', $data["move"])
            ->getQuery();

        $ret = $query->execute();

        return new JsonResponse(["message" => "Analysis deleted.", "ret" => $ret]);
    }

    #[Route('/api/analysis/save', methods: ['POST'], name: 'app_api_analysis_save')]
    public function apiAnalysisSave(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        $message = "";

        // save the repertoire
        $saved = $this->saveRepertoire($data['color'], $data["initialFen"], $data['moves']);

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

    #[Route('/api/roadmap', methods: ['GET'], name: 'app_api_roadmap')]
    public function apiRoadmap(Request $request): JsonResponse
    {
        return $this->apiPractice($request, true);
    }

    #[Route('/api/statistics', methods: ['GET'], name: 'app_api_statistics')]
    public function apiStatistics(Request $request, bool $isRoadmap = false): JsonResponse
    {
        return $this->apiPractice($request, false, true);
    }

    #[Route('/api/practice', methods: ['GET', 'POST'], name: 'app_api_practice')]
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
            $repertoireItem = $repoRep->getLines($repertoireId);

            return new JsonResponse([
                "custom" => $repertoireItem,
                "eco" => json_decode($jsonEco)
            ]);
        }

        // get the repertoire lines and the group lines
        [$lines, $groups] = $repoRep->getLines(null, $isRoadmap, $statisticsOnly);

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
            $resp['white'] = $repoRep->getWhiteLines($lines);
            // get the black lines
            $resp['black'] = $repoRep->getBlackLines($lines);

            // not needed for the roadmap
            if (!$isRoadmap) {
                // find the new lines
                $resp['new'] = $repoRep->getNewLines($lines);
                // find the recommended lines
                $resp['recommended'] = $repoRep->getRecommendedLines($lines);
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
            $repoRep->addRoadmap($resp['white']);
            $repoRep->addRoadmap($resp['black']);

            //dd($resp['black']);

            // get the roadmap
            $roadmap = [
                'white' => $repoRep->getRoadmapFor($resp['white'], true),
                'black' => $repoRep->getRoadmapFor($resp['black'], true)
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
            $move = $repoRep->findPosition($rec->getFen(), $resp[$rec->getColor()]);
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

    // get all the database evaluations for a game
    private function getGameEvaluations($data, string $siteUsername): array
    {
        if (!isset($data["pgn"])) {
            return null;
        }

        // parse the game
        $game = $this->myPgnParser->parsePgnFromText($data["pgn"], true);

        // create a new game
        $chess = new ChessJs($game->getFen());

        // add te moves
        foreach ($game->getMovesArray() as $move) {
            $chess->move($move);
        }
        // get the UCI moves
        $uciMoves = $chess->getUciMoves();

        // set the current moves & pgn
        $halfMove = 1;
        $pgn = "";
        $sanLine = [];
        $uciLine = [];

        // the game moves & evaluations
        $evals = [
            "uuid" => $data["uuid"],
            "color" => $game->getWhite() == $siteUsername ? "white" : "black",
            "opponent" => $game->getWhite() == $siteUsername ? $game->getBlack() : $game->getWhite(),
            "result" => $game->getResult(),
            "fen" => $game->getFen(),
            "link" => $game->getLink(),
            "evaluations" => 0,
            "engine" => 0,
            "moves" => []
        ];

        // reset the game
        $chess->reset();
        // if we have an initial position for this game (moves already played)
        if ($game->getFen()) {
            $chess->load($game->getFen());
        }

        // white to move
        $whiteToMove = true;

        // need to change this to user setting?
        $analyseForBlack = $game->getBlack() == $siteUsername;

        // get the ignore list repo
        $repo = $this->em->getRepository(IgnoreList::class);

        // stop analysing when we exceed the limit
        $maxMoves = 15; // 15

        foreach ($uciMoves as $move) {
            // get the FEN before this move
            $fen = $chess->fen();

            // play the move
            $chess->move($move["san"]);
            // if the game is over, we can stop the analysis
            if ($chess->gameOver()) {
                break;
            }

            // get the database evaluations for this position
            $bestMoves = $this->getEvaluationBestMoves($chess->fen(), 3);
            if ($bestMoves == null) {
                $evals["engine"]++;
            } else {
                $evals["evaluations"]++;
            }

            // if this is our move, check if it's on the ignore list
            $ignore = false;
            if ((!$whiteToMove && !$analyseForBlack) || ($whiteToMove && $analyseForBlack)) {
                $ignore = $repo->isOnIgnoreList($this->getUser(), $fen, $move["san"]);
            }

            // add to the moves
            $evals["moves"][] = [
                "san" => $move["san"],
                "uci" => $move["uci"],
                "ignore" => $ignore,
                "bestmoves" => $bestMoves,
                "fen" => $fen,
                "line" => [
                    "pgn" => $pgn,
                    "san" => $sanLine,
                    "uci" => $uciLine,
                ]
            ];

            $whiteToMove = !$whiteToMove;

            $pgn .= ($pgn != "" ? " " : "") . ($halfMove % 2 == 1 ? ceil($halfMove / 2) . ". " : "") . $move['san'];

            $sanLine[] = $move['san'];
            $uciLine[] = $move['uci'];

            // increase the halfmove
            $halfMove++;
            // if we need to stop analysing
            if ($halfMove >= $maxMoves * 2) {
                break;
            }
        }

        return $evals;
    }

    // evaluate a game
    private function evaluateGame($game): array
    {
        // create a new game
        $chess = new ChessJs($game["fen"]);

        // set the current moves & pgn
        $moves = [];
        $halfMove = 1;
        $linePgn = "";
        $lineMoves = [];

        // reset the game
        //$chess->reset();
        // if we have an initial position for this game (moves already played)
        //if ($game->getFen()) {
        //$chess->load($game->getFen());
        //}

        // get the FEN
        $fen = $chess->fen();

        //dd($fen, $game["fen"]);

        // always just use the 1st move ??
        $bestMoves = $game["moves"][0]["bestmoves"];

        // get the current best move
        $bestCp = $bestMoves[0]["cp"];
        $bestMate = $bestMoves[0]["mate"];

        // white to move
        $whiteToMove = true;

        // need to change this to user setting?
        $analyseForBlack = $game["color"] == "black";

        // get the intial win percentage
        if ($bestMate !== null) {
            $prevWinPct = 100;
        } else {
            $prevWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $bestCp)) - 1));
        }

        $accuracy = [];
        $mistakes = [];

        // need to add this to settings?
        $includeInnacuracies = true;

        // stop analysing when we exceed the limit
        $mistakesTotal = 0;
        $mistakesLimit = 9;
        $mistakesPoints = ["inaccuracy" => 1.5, "mistake" => 2, "blunder" => 3];

        foreach ($game["moves"] as $move) {
            // get the FEN before this move
            $fenBefore = $chess->fen();

            // remember the best moves for this move
            $bestMovesBefore = [...$bestMoves];

            //print "move(1): " . $move["san"] . "--";

            // play the move
            $ret = $chess->move($move["san"]);

            // if the game is over, we can stop the analysis
            if ($chess->gameOver()) {
                break;
            }

            $bestMoves = $move["bestmoves"];
            // ??
            //$bestMovesBefore = $move["bestmoves"];

            $whiteToMove = !$whiteToMove;

            // get the current best move centipawn value
            $moveCp = $bestMoves[0]["cp"];
            $moveMate = $bestMoves[0]["mate"];

            // if we need to check the CP loss
            if ((!$whiteToMove && !$analyseForBlack) || ($whiteToMove && $analyseForBlack)) {

                //print "evaluating move: ".$move["san"]."<br>";

                //if ($move["san"] == "e3") {
                //dd($bestMovesBefore);
                //}

                // get the current win percentage
                if ($moveMate !== null) {
                    $winPct = 100;
                } else {
                    $winPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $moveCp)) - 1));
                    if ($analyseForBlack) {
                        $winPct = 100 - $winPct;
                    }
                }

                // calculate the percentage loss for this move
                $pctLoss = $prevWinPct == -1 ? 0 : max(0, ($prevWinPct - $winPct) / 100);

                // calculate the accuracy for this move (not used for now, but keep it in)
                $acc = 103.1668 * exp(-0.04354 * ($prevWinPct - min($prevWinPct, $winPct))) - 3.1669;
                $accuracy[] = $acc;

                // set the mistake array
                $mistake = [
                    "move" => $move["san"],
                    "moveCp" => $moveCp,
                    "type" => "",
                    "bestmoves" => [],
                    "fen" => $fenBefore,
                    "line" => ["pgn" => $linePgn, "moves" => $lineMoves]
                ];

                /*

                - in case of mistake: check to see if move is on ignored list
                - if it is, do not add as mistake.

                - in case of mistake (and not on ignored list): check to see if that move is in our repertoire
                - if it is, do not add as mistake. you played according to repertoire.

                - at what point do we stop analysing?
                - if we have 3 blunders? 5 mistakes? if eval is below 5?

                */

                // check the move quality
                if ($pctLoss == 0) {
                    // best move
                } else if ($pctLoss < .02) {
                    // excellent move
                } else if ($pctLoss < .05) {
                    // good move
                } else if ($pctLoss < .1) {
                    // inaccuracy
                    if ($includeInnacuracies) {
                        $mistake["type"] = "inaccuracy";
                    }
                } else if ($pctLoss < .2) {
                    // mistake
                    $mistake["type"] = "mistake";
                } else {
                    // blunder
                    $mistake["type"] = "blunder";
                }

                // if we have a mistake
                if ($mistake["type"] !== "" && !$move["ignore"]) {
                    // add to the mistakes total
                    $mistakesTotal = $mistakesTotal + $mistakesPoints[$mistake["type"]];

                    //print "undo move " . $move["san"] . "-(1)--";

                    // undo the current move so we can test the best moves
                    $chess->undo();

                    // make sure the best moves are sorted according to color
                    if ($analyseForBlack) {
                        usort($bestMovesBefore, function ($a, $b) {
                            if ($a["mate"] !== null && $b["mate"] == null) return -1;
                            if ($a["mate"] == null && $b["mate"] !== null) return 1;
                            if ($a["mate"] !== null && $b["mate"] !== null) {
                                if ($a["mate"] < $b["mate"]) return -1;
                                if ($a["mate"] > $b["mate"]) return 1;
                            }
                            if ($a["cp"] > $b["cp"]) return 1;
                            if ($a["cp"] < $b["cp"]) return -1;
                            return 0;
                        });
                    } else {
                        usort($bestMovesBefore, function ($a, $b) {
                            if ($a["mate"] !== null && $b["mate"] == null) return -1;
                            if ($a["mate"] == null && $b["mate"] !== null) return 1;
                            if ($a["mate"] !== null && $b["mate"] !== null) {
                                if ($a["mate"] < $b["mate"]) return -1;
                                if ($a["mate"] > $b["mate"]) return 1;
                            }
                            if ($a["cp"] > $b["cp"]) return -1;
                            if ($a["cp"] < $b["cp"]) return 1;
                            return 0;
                        });
                    }

                    foreach ($bestMovesBefore as $bm) {

                        //print "BestMove: " . $bm["move"] . "<br>";

                        // get the move details
                        $fromSquare = substr($bm["move"], 0, 2);
                        $toSquare = substr($bm["move"], 2, 2);
                        $promotion = strlen($bm["move"] == 5) ? substr($bm["move"], 5) : "";

                        //print "move(2): " . $bm["move"] . "--";

                        // make the move
                        $ret = $chess->move(["from" => $fromSquare, "to" => $toSquare, "promotion" => $promotion]);
                        if ($ret == null) {

                            print "Invalid move: " . $bm['move'] . "<br>";

                            dd($chess->fen(), $chess->history(), $moves);

                            // invalid move.. ? do something.. ?

                        } else {
                            // get the last move
                            $history = $chess->history(['verbose' => true]);
                            $last = array_pop($history);

                            //print "undo move(2)--";

                            // undo the last move
                            $chess->undo();

                            /*

                            For 2nd and 3rd best moves:
                            
                            - we need to check if the move itself is not a mistake... 
                            - if it is, we would be suggesting a slightly worse mistake instead of the mistake made
                            - check using win pct??

                            */

                            // if this is the move we made (2nd or 3rd best)
                            if ($move["san"] == $last["san"]) {
                                // we have all the better moves, exit foreach
                                break;
                            }

                            // add the move
                            $add = true;

                            // if this is not the 1st best move
                            if (count($mistake["bestmoves"]) > 0) {
                                // calculate the win percentage for this move
                                if ($bm["mate"] !== null) {
                                    $moveWinPct = 100;
                                } else {
                                    $moveWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $bm["cp"])) - 1));
                                    if ($analyseForBlack) {
                                        $moveWinPct = 100 - $moveWinPct;
                                    }
                                }

                                // calculate the move percentage loss
                                $movePctLoss = $prevWinPct == -1 ? 0 : max(0, ($prevWinPct - $moveWinPct) / 100);

                                // add if not an inaccuracy or worse
                                $add = $movePctLoss < .1;
                            }

                            // add to the bestmoves
                            if ($add) {
                                // get the san moves from the uci moves..
                                foreach ($bm["line"] as $lmove) {
                                    // get the move details
                                    $fromSquare = substr($lmove, 0, 2);
                                    $toSquare = substr($lmove, 2, 2);
                                    $promotion = strlen($lmove == 5) ? substr($lmove, 5) : "";
                                    // make the move
                                    $ret = $chess->move(["from" => $fromSquare, "to" => $toSquare, "promotion" => $promotion]);
                                    if ($ret == null) {
                                        print "move is null?<br>";
                                        dd($lmove, $chess->history(['verbose' => true]));
                                    }
                                }

                                $sanMoves = [];
                                foreach ($bm["line"] as $lmove) {
                                    // get the last move
                                    $history = $chess->history(['verbose' => true]);
                                    $last = array_pop($history);
                                    array_unshift($sanMoves, $last["san"]);
                                    // undo the last move
                                    $chess->undo();
                                }

                                $mistake["bestmoves"][] = [
                                    "move" => $bm["move"],
                                    "san" => $last["san"],
                                    "cp" => $bm["cp"],
                                    "mate" => $bm["mate"],
                                    //"line" => $bm["line"],
                                    "line" => $sanMoves
                                ];

                                // if we have 3 best moves, break the loop (lichess evals sometimes has more than 3)
                                if (count($mistake["bestmoves"]) == 3) {
                                    break;
                                }
                            }
                        }
                    }

                    //print "move(3): " . $move["san"] . "--";

                    // redo the current move
                    $chess->move($move["san"]);

                    /*

                    If no best moves known, do we need to add?
                    Not sure how this could happen, but as safety measure perhaps.. ?

                    */

                    // add the mistake
                    if (count($mistake["bestmoves"]) > 0) {
                        $mistakes[] = $mistake;
                    }
                }
            } else {
                // calculate the win percentage for the previous move (for next loop)
                if ($moveMate !== null) {
                    $prevWinPct = 100;
                } else {
                    $prevWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $moveCp)) - 1));
                    if ($analyseForBlack) {
                        $prevWinPct = 100 - $prevWinPct;
                    }
                }
            }

            $bestCp = $moveCp;

            $linePgn .= ($linePgn != "" ? " " : "") . ($halfMove % 2 == 1 ? ceil($halfMove / 2) . ". " : "") . $move['san'];
            $lineMoves[] = $move['san'];

            // increase the halfmove
            $halfMove++;

            // if we exceeded the mistakes limit
            if ($mistakesTotal >= $mistakesLimit) {
                break;
            }
        }

        return $mistakes;
    }

    // analyse a game
    private function analyseGame($uci, MyGame $game, string $siteUsername): array
    {
        // create a new game
        $chess = new ChessJs($game->getFen());
        // add te moves
        foreach ($game->getMovesArray() as $move) {
            $chess->move($move);
        }
        // get the UCI moves
        $uciMoves = $chess->getUciMoves();

        // set the current moves & pgn
        $moves = [];
        $halfMove = 1;
        $linePgn = "";
        $lineMoves = [];
        $count = ["evaluation" => 0, "engine" => 0];

        // reset the game
        $chess->reset();
        // if we have an initial position for this game (moves already played)
        if ($game->getFen()) {
            $chess->load($game->getFen());

            // get the moves from the pgn
            //dd($game);
        }
        // get the FEN
        $fen = $chess->fen();

        // start a new UCI game
        $uci->newGame();

        // get the game downloader
        //$downloader = new GameDownloader($this->em, $this->getUser());

        //
        // temporarily disable: 429 - too many requests..
        //

        //$eval = $downloader->getEvaluation($fen);
        $eval = null;

        if ($eval !== null) {
            $bestMoves = [];
            //for ($i = 0; $i < 3; $i++) {
            $pv = explode(" ", $eval["pvs"][0]["moves"]);
            $bestMoves[] = ["move" => $pv[0], "cp" => $eval["pvs"][0]["cp"], "line" => $pv];
            //}
        } else {
            // set the initial position and get the best moves from the engine
            $bestMoves = $this->getEvaluationBestMoves($chess->fen(), 3);
            if ($bestMoves == null) {
                $bestMoves = $uci->setPosition($fen);

                $count["engine"]++;
            } else {
                $count["evaluation"]++;
            }
        }

        // get the current best move
        $bestCp = $bestMoves[0]["cp"];
        $bestMate = $bestMoves[0]["mate"];

        // white to move
        $whiteToMove = true;

        // need to change this to user setting?
        $analyseForBlack = $game->getBlack() == $siteUsername;

        //print "Analyse for black (" . $game->getBlack() . " / " . $siteUsername . ") = " . ($analyseForBlack ? "Yes" : "No") . "\n";

        // get the ignore list repo
        $repo = $this->em->getRepository(IgnoreList::class);

        //print "Players: " . $game->getWhite() . " vs " . $game->getBlack() . "<br>";
        //print "Analysing for: " . ($analyseForBlack ? "Black" : "White") . "<br>";

        // get the intial win percentage
        if ($bestMate !== null) {
            $prevWinPct = 100;
        } else {
            $prevWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $bestCp)) - 1));
            $accuracy = [];
            $mistakes = [];
        }

        // need to add this to settings?
        $includeInnacuracies = true;

        // stop analysing when we exceed the limit
        $maxMoves = 15; // 15
        $mistakesTotal = 0;
        $mistakesLimit = 9;
        $mistakesPoints = ["inaccuracy" => 1.5, "mistake" => 2, "blunder" => 3];

        foreach ($uciMoves as $move) {
            // add the UCI move
            $moves[] = $move['uci'];
            // get the FEN before this move
            $fenBefore = $chess->fen();
            // remember the best moves for this move
            $bestMovesBefore = [...$bestMoves];

            //print "Move: " . $move["san"] . "<br>";

            // play the move
            $ret = $chess->move($move["san"]);

            // if the game is over, we can stop the analysis
            if ($chess->gameOver()) {
                break;
            }


            /*

            Stockfish returns CP based on the color:

            - White +.5 = 50
            - Black +.5 = 50

            Lichess evals returns CP for white:

            - White +.5 = 50
            - Black +.5 = -50

            We always want the CP for white. In case of stockfish we need to multiple with -1 for the black moves.

            */


            //
            // temporarily disable: 429 - too many requests..
            //

            $eval = null;
            //$eval = $downloader->getEvaluation($chess->fen());
            if ($eval !== null) {
                $bestMoves = [];
                //for ($i = 0; $i < 3; $i++) {
                $pv = explode(" ", $eval["pvs"][0]["moves"]);
                $bestMoves[] = ["move" => $pv[0], "cp" => $eval["pvs"][0]["cp"], "line" => $pv];
                //}
            } else {
                // set the position and get the best moves from the engine
                //$bestMoves = $uci->setPosition("", $moves);
                $bestMoves = $this->getEvaluationBestMoves($chess->fen(), 3);
                if ($bestMoves == null) {
                    $bestMoves = $uci->setPosition($fen, $moves);

                    $count["engine"]++;
                    //print "--engine<br>";

                    // if these evals are for a black move
                    if ($whiteToMove) {
                        // uno reverse the cp value
                        for ($i = 0; $i < count($bestMoves); $i++) {
                            if ($bestMoves[$i]["cp"] !== null) {
                                $bestMoves[$i]["cp"] = $bestMoves[$i]["cp"] * -1;
                            }
                        }
                    }
                } else {
                    $count["evaluation"]++;
                    //print "--eval<br>";
                }
            }

            $whiteToMove = !$whiteToMove;

            //print "-- bestMoves:\n";
            //print "<pre>";
            //print_r($bestMoves);
            //print "</pre>";

            // get the current best move centipawn value
            $moveCp = $bestMoves[0]["cp"];
            $moveMate = $bestMoves[0]["mate"];

            //print "CP: $moveCp<br>";

            // if we need to check the CP loss
            if ((!$whiteToMove && !$analyseForBlack) || ($whiteToMove && $analyseForBlack)) {

                // not using the centipawn for now, but keep it in..
                /*
                if ($analyseForBlack) {
                    $cpLoss = $bestCp < $moveCp ? max(0, abs($bestCp - $moveCp)) : 0;
                } else {
                    $cpLoss = $bestCp > $moveCp ? max(0, abs($bestCp - $moveCp)) : 0;
                }
                    */

                // get the current win percentage
                if ($moveMate !== null) {
                    $winPct = 100;
                } else {
                    $winPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $moveCp)) - 1));
                    if ($analyseForBlack) {
                        $winPct = 100 - $winPct;
                    }
                }

                // calculate the percentage loss for this move
                $pctLoss = $prevWinPct == -1 ? 0 : max(0, ($prevWinPct - $winPct) / 100);

                // calculate the accuracy for this move (not used for now, but keep it in)
                $acc = 103.1668 * exp(-0.04354 * ($prevWinPct - min($prevWinPct, $winPct))) - 3.1669;
                $accuracy[] = $acc;

                // set the mistake array
                $mistake = [
                    "move" => $move["san"],
                    "moveCp" => $moveCp,
                    "type" => "",
                    "bestmoves" => [],
                    "fen" => $fenBefore,
                    "line" => ["pgn" => $linePgn, "moves" => $lineMoves]
                ];

                /*

                - in case of mistake: check to see if move is on ignored list
                - if it is, do not add as mistake.

                - in case of mistake (and not on ignored list): check to see if that move is in our repertoire
                - if it is, do not add as mistake. you played according to repertoire.

                - at what point do we stop analysing?
                - if we have 3 blunders? 5 mistakes? if eval is below 5?

                */

                // check the move quality
                if ($pctLoss == 0) {
                    // best move
                } else if ($pctLoss < .02) {
                    // excellent move
                } else if ($pctLoss < .05) {
                    // good move
                } else if ($pctLoss < .1) {
                    // inaccuracy
                    if ($includeInnacuracies) {
                        $mistake["type"] = "inaccuracy";
                    }
                } else if ($pctLoss < .2) {
                    // mistake
                    $mistake["type"] = "mistake";
                } else {
                    // blunder
                    $mistake["type"] = "blunder";
                }

                // if we have a mistake
                if ($mistake["type"] !== "" && !$repo->isOnIgnoreList($this->getUser(), $fenBefore, $move["san"])) {
                    // add to the mistakes total
                    $mistakesTotal = $mistakesTotal + $mistakesPoints[$mistake["type"]];

                    // undo the current move so we can test the best moves
                    $chess->undo();

                    // make sure the best moves are sorted according to color
                    if ($analyseForBlack) {
                        usort($bestMovesBefore, function ($a, $b) {
                            if ($a["mate"] !== null && $b["mate"] == null) return -1;
                            if ($a["mate"] == null && $b["mate"] !== null) return 1;
                            if ($a["mate"] !== null && $b["mate"] !== null) {
                                if ($a["mate"] < $b["mate"]) return -1;
                                if ($a["mate"] > $b["mate"]) return 1;
                            }
                            if ($a["cp"] > $b["cp"]) return 1;
                            if ($a["cp"] < $b["cp"]) return -1;
                            return 0;
                        });
                    } else {
                        usort($bestMovesBefore, function ($a, $b) {
                            if ($a["mate"] !== null && $b["mate"] == null) return -1;
                            if ($a["mate"] == null && $b["mate"] !== null) return 1;
                            if ($a["mate"] !== null && $b["mate"] !== null) {
                                if ($a["mate"] < $b["mate"]) return -1;
                                if ($a["mate"] > $b["mate"]) return 1;
                            }
                            if ($a["cp"] > $b["cp"]) return -1;
                            if ($a["cp"] < $b["cp"]) return 1;
                            return 0;
                        });
                    }

                    foreach ($bestMovesBefore as $bm) {

                        //print "BestMove: " . $bm["move"] . "<br>";

                        // get the move details
                        $fromSquare = substr($bm["move"], 0, 2);
                        $toSquare = substr($bm["move"], 2, 2);
                        $promotion = strlen($bm["move"] == 5) ? substr($bm["move"], 5) : "";
                        // make the move
                        $ret = $chess->move(["from" => $fromSquare, "to" => $toSquare, "promotion" => $promotion]);
                        if ($ret == null) {

                            print "Invalid move: " . $bm['move'] . "<br>";

                            dd($chess->fen(), $chess->history(), $moves);

                            // invalid move.. ? do something.. ?

                        } else {
                            // get the last move
                            $history = $chess->history(['verbose' => true]);
                            $last = array_pop($history);
                            // undo the last move
                            $chess->undo();

                            /*

                            For 2nd and 3rd best moves:
                            
                            - we need to check if the move itself is not a mistake... 
                            - if it is, we would be suggesting a slightly worse mistake instead of the mistake made
                            - check using win pct??

                            */

                            // if this is the move we made (2nd or 3rd best)
                            if ($move["san"] == $last["san"]) {
                                // we have all the better moves, exit foreach
                                break;
                            }

                            // add the move
                            $add = true;

                            // if this is not the 1st best move
                            if (count($mistake["bestmoves"]) > 0) {
                                // calculate the win percentage for this move
                                if ($bm["mate"] !== null) {
                                    $moveWinPct = 100;
                                } else {
                                    $moveWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $bm["cp"])) - 1));
                                    if ($analyseForBlack) {
                                        $moveWinPct = 100 - $moveWinPct;
                                    }
                                }

                                // calculate the move percentage loss
                                $movePctLoss = $prevWinPct == -1 ? 0 : max(0, ($prevWinPct - $moveWinPct) / 100);

                                // add if not an inaccuracy or worse
                                $add = $movePctLoss < .1;
                            }

                            // add to the bestmoves
                            if ($add) {
                                // get the san moves from the uci moves..
                                foreach ($bm["line"] as $lmove) {
                                    // get the move details
                                    $fromSquare = substr($lmove, 0, 2);
                                    $toSquare = substr($lmove, 2, 2);
                                    $promotion = strlen($lmove == 5) ? substr($lmove, 5) : "";
                                    // make the move
                                    $ret = $chess->move(["from" => $fromSquare, "to" => $toSquare, "promotion" => $promotion]);
                                    if ($ret == null) {
                                        print "move is null?<br>";
                                        dd($lmove, $chess->history(['verbose' => true]));
                                    }
                                }

                                $sanMoves = [];
                                foreach ($bm["line"] as $lmove) {
                                    // get the last move
                                    $history = $chess->history(['verbose' => true]);
                                    $last = array_pop($history);
                                    array_unshift($sanMoves, $last["san"]);
                                    // undo the last move
                                    $chess->undo();
                                }

                                $mistake["bestmoves"][] = [
                                    "move" => $bm["move"],
                                    "san" => $last["san"],
                                    "cp" => $bm["cp"],
                                    "mate" => $bm["mate"],
                                    //"line" => $bm["line"],
                                    "line" => $sanMoves
                                ];

                                // if we have 3 best moves, break the loop (lichess evals sometimes has more than 3)
                                if (count($mistake["bestmoves"]) == 3) {
                                    break;
                                }
                            }
                        }
                    }

                    // redo the current move
                    $chess->move($move["san"]);

                    /*

                    If no best moves known, do we need to add?
                    Not sure how this could happen, but as safety measure perhaps.. ?

                    */

                    // add the mistake
                    if (count($mistake["bestmoves"]) > 0) {
                        $mistakes[] = $mistake;
                    }
                }
            } else {
                // calculate the win percentage for the previous move (for next loop)
                if ($moveMate !== null) {
                    $prevWinPct = 100;
                } else {
                    $prevWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $moveCp)) - 1));
                    if ($analyseForBlack) {
                        $prevWinPct = 100 - $prevWinPct;
                    }
                }
            }

            $bestCp = $moveCp;

            $linePgn .= ($linePgn != "" ? " " : "") . ($halfMove % 2 == 1 ? ceil($halfMove / 2) . ". " : "") . $move['san'];
            $lineMoves[] = $move['san'];

            // increase the halfmove
            $halfMove++;
            // if we need to stop analysing
            if ($halfMove >= $maxMoves * 2) {
                break;
            }

            // if we exceeded the mistakes limit
            if ($mistakesTotal >= $mistakesLimit) {
                break;
            }
        }

        return [$mistakes, $count];
    }

    private function getEvaluationBestMoves(string $fen, $max = 5): ?array
    {
        $parts = explode(" ", $fen);
        // the fen without the move numbers
        $fenWithout = implode(" ", array_slice($parts, 0, 4));
        // the 2nd with the en-passant square as -
        $fenWithout2 = implode(" ", array_slice($parts, 0, 3)) . " -";

        $repo = $this->em2->getRepository(Evaluation::class);

        // find the evaluation
        $rec = $repo->findOneBy(['Fen' => $fenWithout]);
        // if not found, try with 2nd FEN
        if ($rec == null && $fenWithout != $fenWithout2) {
            $rec = $repo->findOneBy(['Fen' => $fenWithout2]);
        }

        if ($rec) {
            /*
            $evals = [];
            foreach (json_decode($rec->getPvs(), true) as $eval) {
                $line = explode(" ", $eval["line"]);
                $evals[] = [
                    "depth" => $rec->getDepth(),
                    "cp" => isset($eval["cp"]) ? intval($eval["cp"]) : null,
                    "mate" => isset($eval["mate"]) ? intval($eval["mate"]) : null,
                    "move" => $line[0],
                    "line" => $line
                ];
            }
                */

            // new version - get up to 3 lines across all depth pvs (to ensure more than 1 line)
            $evals = json_decode($rec->getEvals(), true);

            usort($evals, function ($a, $b) {
                if ($a["depth"] > $b["depth"]) return -1;
                if ($a["depth"] < $b["depth"]) return 1;
                return 0;
            });

            $pvs = [];
            $firstmoves = [];
            $evcnt = 0;
            foreach ($evals as $eval) {
                foreach ($eval["pvs"] as $pv) {
                    $line = explode(" ", $pv["line"]);
                    $firstmove = $line[0];
                    if (!in_array($firstmove, $firstmoves)) {
                        $firstmoves[] = $firstmove;
                        //$pvs[] = $pv;
                        $pvs[] = [
                            "depth" => $eval["depth"],
                            "cp" => isset($pv["cp"]) ? intval($pv["cp"]) : null,
                            "mate" => isset($pv["mate"]) ? intval($pv["mate"]) : null,
                            "move" => $line[0],
                            "line" => $line
                        ];

                        // if we have 3 lines from the top eval or 5 lines from the top 2
                        if (count($pvs) >= $max) {
                            break 2;
                        }
                    }
                }
                $evcnt++;

                // only take lines from the top 2 evals
                if ($evcnt >= 2) {
                    break;
                }
            }

            return $pvs;
        }

        return null;
    }

    // check if a move is on the ignore list or not
    private function isOnIgnoreList($fen, $move, $ignoreList): bool
    {
        foreach ($ignoreList as $ignore) {
            if ($ignore["fen"] == $fen && $ignore["move"] == $move) {
                return true;
            }
        }

        return false;
    }
}
