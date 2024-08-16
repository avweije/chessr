<?php

namespace App\Controller;

use App\Config\DownloadSite;
use App\Config\DownloadStatus;
use App\Config\DownloadType;
use App\Entity\Downloads;
use App\Entity\ECO;
use App\Entity\Group;
use App\Entity\Analysis;
use App\Entity\Archives;
use App\Entity\IgnoreList;
use App\Entity\Repertoire;
use App\Entity\RepertoireGroup;
use App\Entity\Settings;
use App\Entity\User;
use App\Library\ChessJs;
use App\Library\GameDownloader;
use App\Library\GameDownloader\LichessInterface;
use App\Library\UCI;
use App\Service\MyPgnParser\MyGame;
use App\Service\MyPgnParser\MyPgnParser;
use DateTime;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpFoundation\Request;

class ApiController extends AbstractController
{
    private $em;
    private $myPgnParser;

    public function __construct(EntityManagerInterface $em, MyPgnParser $myPgnParser)
    {
        $this->em = $em;
        $this->myPgnParser = $myPgnParser;
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

        $pgnText = '[Event "Live Chess"]
[Site "Chess.com"]
[Date "2024.03.01"]
[Round "?"]
[White "avweije"]
[Black "noobchessplayer0809"]
[Result "1-0"]
[ECO "A40"]
[WhiteElo "2138"]
[BlackElo "979"]
[TimeControl "180"]
[EndTime "3:19:29 PST"]
[Termination "avweije won by resignation"]

1. d4 e5 2. c3 exd4 3. cxd4 Nf6 4. Nf3 Nc6 5. Nc3 d6 6. Bf4 Be7 7. e3 O-O 8. Bd3
Re8 9. O-O Be6 10. d5 Nxd5 11. Nxd5 Bxd5 12. Bxh7+ Kxh7 13. Qxd5 Nb4 14. Qxf7
Nc2 15. Qf5+ g6 16. Qxc2 c6 17. Bg3 Bf6 18. Rad1 Re6 19. Nd4 Re7 20. Rd2 c5 21.
Nf3 Qb6 22. b3 Rd8 23. Rfd1 Re6 24. Qc4 Re7 25. Qg4 Be5 26. Bxe5 dxe5 27. Rxd8
Qxd8 1-0';

        // parse the game
        $game = $this->myPgnParser->parsePgnFromText($pgnText, true);

        // get the settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

        // get the correct username
        $siteUsername = $settings->getSite() == DownloadSite::ChessDotCom ? $settings->getChessUsername() : $settings->getLichessUsername();

        // analyse the game
        $temp = $this->analyseGame($uci, $game, $siteUsername);

        dd($temp);

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


    #[Route('/api/moves', name: 'app_api_moves')]
    public function apiMoves(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        // get the ECO codes for this position and the next move
        $codes = $this->em->getRepository(ECO::class)->findByPgn($data['pgn']);

        // get the most played moves for this position
        $qb = $this->em->createQueryBuilder();
        $qb->select('m')
            ->from('App\Entity\Moves', 'm')
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
        if ($data['pgn'] != '') {
            $res = $repository->findOneBy([
                'User' => $this->getUser(),
                'Color' => $data['color'],
                'FenAfter' => $data['fen']
            ]);

            if ($res) {
                $repertoireId = $res->getId();
                $repertoireAutoPlay = $res->isAutoPlay();
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
            $move = ['move' => $rep->getMove(), 'eco' => '', 'name' => ''];
            // find the ECO code for this move
            for ($i = 0; $i < count($codes['next']); $i++) {
                $temp = explode(' ', $codes['next'][$i]['PGN']);
                if (array_pop($temp) == $rep->getMove()) {
                    $move['eco'] = $codes['next'][$i]['Code'];
                    $move['name'] = $codes['next'][$i]['Name'];
                    $codes['next'][$i]['repertoire'] = 1;
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

        return new JsonResponse([
            'eco' => $codes,
            'games' => $games,
            'repertoire' => $reps,
            'repertoireId' => $repertoireId,
            'repertoireAutoPlay' => $repertoireAutoPlay,
            'initialFens' => $initialFens,
            'groups' => $groups
        ]);
    }

    #[Route('/api/repertoire', methods: ['POST'], name: 'app_api_repertoire_save')]
    public function apiRepertoireSave(Request $request): JsonResponse
    {
        // get the data
        $data = $request->getPayload()->all();
        // save the repertoire
        $saved = $this->saveRepertoire($data['color'], "", $data['moves']);

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

                // save the record
                $this->em->persist($rec);
            }
        }

        $this->em->flush();

        return new JsonResponse(["message" => "Counters updated."]);
    }

    // delete a move and it's children
    private function deleteRepertoire(string $color, $fenAfter, $move)
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
            $this->deleteRepertoire($color, $rec->getFenAfter(), $rec->getMove());
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

            // if this is a black repertoire
            if ($color == "black") {
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
                $rep->setPgn($move['pgn']);
                $rep->setMove($move['san']);
                $rep->setAutoPlay(isset($move['autoplay']) ? $move['autoplay'] : false);
                $rep->setHalfMove($halfMove);
                $rep->setPracticeCount(0);
                $rep->setPracticeFailed(0);
                $rep->setPracticeInARow(0);

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
        $downloader = new GameDownloader($this->em, $this->getUser());

        //$archives = $downloader->downloadArchives();

        //$games = $downloader->xxdownloadGames($year, $month);
        $games = $downloader->getGames($year, $month);

        // set the JSON response
        //$resp = ['games' => $downloader->xxgetTotals()];
        $resp = ['games' => $games];

        return new JsonResponse($resp);
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
                $temp = $this->analyseGame($uci, $game, $siteUsername);

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
                        $rc->setPgn($mistake["line"]["pgn"]);
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

    #[Route('/api/practice', methods: ['GET'], name: 'app_api_practice')]
    public function apiPractice(Request $request): JsonResponse
    {
        // get the repertoire repository
        $repository = $this->em->getRepository(Repertoire::class);

        // get the saved repository moves for this user
        $res = $repository->findBy(['User' => $this->getUser()], ['HalfMove' => 'ASC']);

        // the lines
        /*
        $lines = [
            ['color' => 'white', 'before' => '', 'after' => '', 'new' => 1, 'recommended' => 1, 'moves' => []],
            ['color' => 'black', 'before' => '', 'after' => '', 'new' => 1, 'recommended' => 1, 'moves' => []]
        ];*/
        $lines = [];

        // the groups & lines per group
        $groups = [];

        // find the 1st moves
        foreach ($res as $rep) {
            // if this is a 1st move
            if ($rep->getHalfMove() == 1) {
                /*
                // see if we already have the starting position entry
                if (count($lines) == 0) {
                    //$lines[] = ['before' => $rep->getFenBefore(), 'after' => $rep->getFenAfter(), 'moves' => []];
                    $lines[] = ['before' => $rep->getFenBefore(), 'moves' => []];
                }
                */

                // see if we have this color / starting position already
                $idx = 0;
                foreach ($lines as $line) {
                    if ($line["color"] == $rep->getColor() && $line["before"] == $rep->getFenBefore()) {
                        break;
                    }
                    $idx++;
                }

                if ($idx >= count($lines)) {
                    $lines[] = [
                        'color' => $rep->getColor(),
                        'initialFen' => $rep->getInitialFen(),
                        'before' => $rep->getFenBefore(),
                        'after' => $rep->getFenBefore(),
                        'new' => 1,
                        'recommended' => 1,
                        'moves' => []
                    ];
                }

                // set the FEN before/after for white & black
                /*
                $lines[0]['before'] = $rep->getFenBefore();
                $lines[0]['after'] = $rep->getFenBefore();
                $lines[1]['before'] = $rep->getFenBefore();
                $lines[1]['after'] = $rep->getFenBefore();
                */

                // add the move
                //$lines[($rep->getColor() == 'white' ? 0 : 1)]['moves'][] = [
                $lines[$idx]['moves'][] = [
                    'color' => $rep->getColor(),
                    'initialFen' => $rep->getInitialFen(),
                    'move' => $rep->getMove(),
                    'autoplay' => $rep->isAutoPlay(),
                    'halfmove' => $rep->getHalfMove(),
                    'before' => $rep->getFenBefore(),
                    'after' => $rep->getFenAfter(),
                    'new' => $rep->getPracticeCount() == 0 ? 1 : 0,
                    'failPercentage' => $rep->getPracticeCount() < 5 ? 1 : $rep->getPracticeFailed() / $rep->getPracticeCount(),
                    'recommended' => $this->isRecommended($rep->getPracticeCount(), $rep->getPracticeFailed(), $rep->getPracticeInARow()) ? 1 : 0,
                    'practiceCount' => $rep->getPracticeCount(),
                    'practiceFailed' => $rep->getPracticeFailed(),
                    'practiceInARow' => $rep->getPracticeInARow(),
                    'line' => [],
                    'moves' => []
                ];
            }

            // if this move belongs to a group
            foreach ($rep->getRepertoireGroups() as $grp) {
                //
                $idx = -1;
                //
                for ($i = 0; $i < count($groups); $i++) {
                    if ($groups[$i]["id"] == $grp->getGrp()->getId()) {
                        $idx = $i;
                        break;
                    }
                }

                //
                if ($idx == -1) {
                    $idx = count($groups);

                    $groups[] = [
                        "id" => $grp->getGrp()->getId(),
                        "name" => $grp->getGrp()->getName(),
                        "lines" => []
                    ];
                }
                //
                $groups[$idx]["lines"][] = [
                    'color' => $rep->getColor(),
                    'initialFen' => $rep->getInitialFen(),
                    'move' => $rep->getMove(),
                    'autoplay' => $rep->isAutoPlay(),
                    'halfmove' => $rep->getHalfMove(),
                    'before' => $rep->getFenBefore(),
                    'after' => $rep->getFenAfter(),
                    'new' => $rep->getPracticeCount() == 0 ? 1 : 0,
                    'failPercentage' => $rep->getPracticeCount() < 5 ? 1 : $rep->getPracticeFailed() / $rep->getPracticeCount(),
                    'recommended' => $this->isRecommended($rep->getPracticeCount(), $rep->getPracticeFailed(), $rep->getPracticeInARow()) ? 1 : 0,
                    'practiceCount' => $rep->getPracticeCount(),
                    'practiceFailed' => $rep->getPracticeFailed(),
                    'practiceInARow' => $rep->getPracticeInARow(),
                    'line' => [],
                    'moves' => []
                ];
            }
        }

        //dd($groups);

        /*

        We need to disregard the opposite color moves in these filters..

        If it's a white repertoire, only white recommended/new/etc counts, not for the black moves..

        */

        // now add the lines based off the 1st moves (so we can have transpositions)
        for ($i = 0; $i < count($lines); $i++) {

            $lines[$i]['moves'] = $this->getLines($lines[$i]['color'], $lines[$i]['after'], $res, []);
            $lines[$i]['multiple'] = [];

            // if we have multiple moves here, add them to an array
            if (count($lines[$i]['moves']) > 1) {
                foreach ($lines[$i]['moves'] as $move) {
                    //$lines[$i]['multiple'][] = $move['move'];
                    $lines[$i]['multiple'][] = [
                        "move" => $move['move'],
                        "cp" => isset($move['cp']) ? $move['cp'] : null,
                        "eline" => isset($move['line']) ? $move['line'] : null
                    ];
                }
            }


            /*
            for ($x = 0; $x < count($lines[$i]['moves']); $x++) {
                $lines[$i]['moves'][$x]['moves'] = $this->getLines($lines[$i]['moves'][$x]['color'], $lines[$i]['moves'][$x]['after'], $res, [$lines[$i]['moves'][$x]['move']]);
            }
            */
        }

        // now add the group lines based off the 1st moves
        for ($i = 0; $i < count($groups); $i++) {
            for ($x = 0; $x < count($groups[$i]["lines"]); $x++) {

                $groups[$i]["lines"][$x]['moves'] = $this->getLines($groups[$i]["lines"][$x]['color'], $groups[$i]["lines"][$x]['after'], $res, []);
                $groups[$i]["lines"][$x]['multiple'] = [];

                // if we have multiple moves here, add them to an array
                if (count($groups[$i]["lines"][$x]['moves']) > 1) {
                    foreach ($groups[$i]["lines"][$x]['moves'] as $move) {
                        //$lines[$i]['multiple'][] = $move['move'];
                        $groups[$i]["lines"][$x]['multiple'][] = [
                            "move" => $move['move'],
                            "cp" => isset($move['cp']) ? $move['cp'] : null,
                            "eline" => isset($move['line']) ? $move['line'] : null
                        ];
                    }
                }
            }

            // group the lines per starting position / color
            $groups[$i]["lines"] = $this->groupByPosition($groups[$i]["lines"], $lines);
        }

        //dd($groups);

        //dd($lines[2]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]);

        // the response
        $resp = ['white' => [], 'black' => [], 'new' => [], 'recommended' => [], "analysis" => [], "groups" => $groups];

        // if we have a repertoire
        if (count($lines) > 0) {
            // get the white lines
            $resp['white'] = $this->findLines($lines, 'white', false, false);
            // get the black lines
            $resp['black'] = $this->findLines($lines, 'black', false, false);
            // find the new lines
            $resp['new'] = $this->findLines($lines, '', true, false);
            // find the recommended lines
            $resp['recommended'] = $this->findLines($lines, '', false, true);

            //dd($resp['recommended']);

            //dd($lines);

            //dd($resp['white'][1]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]["moves"][0]);

            // group the lines per starting position / color
            $resp['white'] = $this->groupByPosition($resp['white'], $lines);
            $resp['black'] = $this->groupByPosition($resp['black'], $lines);
            $resp['new'] = $this->groupByPosition($resp['new'], $lines);
            $resp['recommended'] = $this->groupByPosition($resp['recommended'], $lines);
        }

        //dd($resp['white']);

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
                foreach ($bm as $move) {
                    $moves[] = ["move" => $move];
                    $multiple[] = [
                        "move" => $move,
                        "cp" => null,
                        "eline" => null
                    ];
                }
            } else {
                foreach ($json as $move) {
                    $moves[] = [
                        "move" => $move["san"],
                        "cp" => $move["cp"],
                        "eline" => $move["line"]
                    ];
                    $multiple[] = [
                        "move" => $move['san'],
                        "cp" => isset($move['cp']) ? $move['cp'] : null,
                        "eline" => isset($move['line']) ? $move['line'] : null
                    ];
                }
            }


            // get the line up to this move
            $line = [];
            $temp = explode(" ", $rec->getPgn());
            for ($i = 0; $i < count($temp); $i++) {
                // if this is not a move number
                if (preg_match('/^\\d+\\./', $temp[$i]) !== 1) {
                    if (trim($temp[$i]) != "") {
                        $line[] = $temp[$i];
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
                "multiple" => $multiple
            ];

            // check to see if this position is in our repertoire
            $move = $this->findPosition($rec->getFen(), $resp[$rec->getColor()]);
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

        return new JsonResponse($resp);
    }

    // find a position inside a line
    private function findPosition(string $fen, array $line): mixed
    {
        // if this is the top level line
        if (!isset($line["moves"])) {
            foreach ($line as $ln) {
                $ret = $this->findPosition($fen, $ln);
                if ($ret !== false) {
                    return $ret;
                }
            }
        } else {
            // if this is the position
            if (isset($line["after"]) && $line["after"] == $fen) {
                return $line;
            }

            // go through the moves in this line
            foreach ($line["moves"] as $move) {
                $ret = $this->findPosition($fen, $move);
                if ($ret !== false) {
                    return $ret;
                }
            }
        }

        return false;
    }

    //
    private function findMultiple($line, $res)
    {

        foreach ($res as $rec) {
            if ($rec['color'] == $line['color'] && $rec['after'] == $line['before']) {
                return $rec['multiple'];
            }

            $ret = $this->findMultiple($line, $rec['moves']);
            if ($ret !== false) {
                return $ret;
            }
        }

        return false;
    }

    // group the lines per starting position/color
    private function groupByPosition(array $lines, array $res = []): array
    {
        $temp = [];
        foreach ($lines as $line) {
            $idx = -1;
            for ($i = 0; $i < count($temp); $i++) {
                if ($temp[$i]['fen'] == $line['before'] && $temp[$i]['color'] == $line['color']) {
                    $idx = $i;
                    break;
                }
            }

            // if we don't  have this FEN position yet
            if ($idx == -1) {
                // find the multiple moves from the original lines (we need all multiple moves, not just the new/recommended ones)
                $multiple = $this->findMultiple($line, $res);

                // if this is not the starting position
                $temp[] = [
                    'color' => $line['color'],
                    'initialFen' => isset($line['initialFen']) ? $line['initialFen'] : '',
                    'fen' => $line['before'],
                    'line' => isset($line['line']) ? $line['line'] : [],
                    'moves' => $line['before'] == $line['after'] ? $line['moves'] : [$line],
                    'multiple' => $multiple,
                    'multiple_old' => $line['before'] == $line['after'] ? $line['multiple'] : [$line['move']]
                ];
            } else {
                $temp[$idx]['moves'][] = $line;
                $temp[$idx]['multiple_old'][] = $line['move'];
                //$temp[$idx]['multiple'] = $line['multiple'];
                //$temp[$idx]['multiplex'] = $line['multiple'];
            }
        }

        return $temp;
    }

    private function isRecommended(int $practiceCount, int $practiceFailed, int $practiceInARow): bool
    {
        // get the fail percentage
        $failPct = $practiceCount < 5 ? 1 : $practiceFailed / $practiceCount;

        return $practiceCount == 0 ? false : $practiceInARow < $failPct * 20;
    }

    // get the complete lines for a certain color and starting position
    private function getLines(string $color, string $fen, array $res, $lineMoves = [], int $step = 1): array
    {
        $moves = [];

        // find the follow up moves for a certain color and position
        foreach ($res as $rep) {
            if ($rep->getColor() == $color && $rep->getFenBefore() == $fen) {
                $moves[] = [
                    'color' => $color,
                    'initialFen' => $rep->getInitialFen(),
                    'move' => $rep->getMove(),
                    'autoplay' => $rep->isAutoPlay(),
                    'halfmove' => $rep->getHalfMove(),
                    'before' => $rep->getFenBefore(),
                    'after' => $rep->getFenAfter(),
                    'new' => $rep->getPracticeCount() == 0 ? 1 : 0,
                    'failPercentage' => $rep->getPracticeCount() < 5 ? 1 : $rep->getPracticeFailed() / $rep->getPracticeCount(),
                    'recommended' => $this->isRecommended($rep->getPracticeCount(), $rep->getPracticeFailed(), $rep->getPracticeInARow()) ? 1 : 0,
                    'practiceCount' => $rep->getPracticeCount(),
                    'practiceFailed' => $rep->getPracticeFailed(),
                    'practiceInARow' => $rep->getPracticeInARow(),
                    'line' => $lineMoves,
                    'moves' => [],
                    'multiple' => []
                ];
            }
        }

        // if we have any moves
        if (count($moves) > 0) {
            // get the complete lines
            for ($i = 0; $i < count($moves); $i++) {

                //$temp = array_key_exists('move', $moves[$i]) ? array_merge($lineMoves, [$moves[$i]['move']]) : $lineMoves;
                $temp = array_merge($lineMoves, [$moves[$i]['move']]);

                $moves[$i]['moves'] = $this->getLines($color, $moves[$i]['after'], $res, $temp, $step + 1);

                // if we have multiple moves here, add them to an array
                if (count($moves[$i]['moves']) > 1) {
                    foreach ($moves[$i]['moves'] as $move) {
                        //$moves[$i]['multiple'][] = $move['move'];
                        $moves[$i]['multiple'][] = [
                            "move" => $move['move'],
                            "cp" => isset($move['cp']) ? $move['cp'] : null,
                            "line" => isset($move['line']) ? $move['line'] : null
                        ];
                    }
                }
            }
        }

        return $moves;
    }

    // find the lines of a certain type
    private function findLines(array $lines, string $color = "", bool $isNew = false, bool $isRecommended = false, string $rootColor = "", int $level = 1): array
    {
        $res = [];

        //dd($lines);

        // find the starting points for the lines
        foreach ($lines as $line) {
            // set the color (from the root object)
            if ($rootColor != "") {
                $line['color'] = $rootColor;
            }

            // is this our move?
            //$ourMove = ($line["color"] == "white" && $level % 2 == 1) || ($line["color"] == "black" && $level % 2 == 0);
            //$ourMove = ($line["color"] == "white" && $level % 2 == 0) || ($line["color"] == "black" && $level % 2 == 1);
            $ourMove = isset($line['halfmove']) ? (($line['color'] == "white" && $line['halfmove'] % 2 == 1) || ($line['color'] == "black" && $line['halfmove'] % 2 == 0)) : $line['color'] == "white";

            // if we need a certain color and this is a match
            if ($ourMove && $color != "" && $line['color'] == $color) {
                // add to the lines
                $res[] = $line;

                continue;
            }
            // if we need the new lines and this is a match
            if ($ourMove && $isNew && $line['new'] == 1 && (!isset($line['autoplay']) || !$line['autoplay'])) {
                // add to the lines
                $res[] = $line;

                continue;
            }
            // if we need the recommended lines and this is a match
            if ($ourMove && $isRecommended && $line['recommended'] == 1 && (!isset($line['autoplay']) || !$line['autoplay'])) {

                //print "- level (recommended): $level <br>";

                // add to the lines
                $res[] = $line;

                continue;
            }

            // check this line to see if any child moves match the criteria
            $temp = $this->findLines($line['moves'], $color, $isNew, $isRecommended, $line['color'], $level + 1);

            //
            // TEMP: testing for recommended - we need the move before in case of multiple!!
            //

            //if ($level == 1 && count($temp) > 0) {
            // add this line also (the parent line of the line we actually want)
            //$res[] = $line;
            //}



            foreach ($temp as $t) {
                $res[] = $t;
            }
        }

        // at top level of this function, return the lines until
        if ($level == 1) {

            //dd($lines, $res);

            // we need to split the lines into parts (that match the criteria)
            $parts = [];
            // split the lines at the part(s) where it stops matching (and later in the line matches again)
            foreach ($res as $line) {

                $temp = $this->splitLine($line, $color, $isNew, $isRecommended);

                //dd($line, $temp);

                $parts[] = $line;
                foreach ($temp as $t) {
                    $parts[] = $t;
                }
            }

            //dd($parts);

            $linesUntil = [];

            // get the line until
            for ($i = 0; $i < count($parts); $i++) {
                $parts[$i]['moves'] = $this->getLineUntil($parts[$i]['moves'], $color, $isNew, $isRecommended);
                if (isset($parts[$i]["move"]) || count($parts[$i]['moves']) > 0) {
                    $linesUntil[] = $parts[$i];
                }
            }

            //dd($parts, $linesUntil);

            return $linesUntil;
        } else {
            // return the line back to the findLines internal call
            return $res;
        }
    }

    // split the line into parts that match
    private function splitLine($line, string $color = "", bool $isNew = false, bool $isRecommended = false, bool $match = true, $level = 1): array
    {
        $parts = [];

        // is this our move?
        $ourMove = ($line['color'] == "white" && $level % 2 == 1) || ($line['color'] == "black" && $level % 2 == 0);
        //$ourMove = ($color == "white" && $level % 2 == 0) || ($color == "black" && $level % 2 == 1);

        //if ($line['color'] == "white" && $level == 1 && $isRecommended) {
        //print "level: $level - ourMove: " . $ourMove . "<br>";
        //}

        foreach ($line['moves'] as $move) {
            $temp = [];

            $autoplay = isset($move['autoplay']) ? $move['autoplay'] : false;

            // if the last move was a match
            if ($match) {
                // if this move matches also
                if (!$ourMove || ($color != '' && $move['color'] == $color) || ($isNew && $move['new'] == 1 && !$autoplay) || ($isRecommended && $move['recommended'] == 1 && !$autoplay)) {
                    // check next move for a non-match
                    $temp = $this->splitLine($move, $color, $isNew, $isRecommended, true, $level + 1);
                } else {
                    // check next move for match
                    $temp = $this->splitLine($move, $color, $isNew, $isRecommended, false, $level + 1);
                }
            } else {
                // if this move matches
                if ($ourMove && (($color != '' && $move['color'] == $color) || ($isNew && $move['new'] == 1 && !$autoplay) || ($isRecommended && $move['recommended'] == 1 && !$autoplay))) {
                    // add this this line as a part
                    $parts[] = $move;
                } else {
                    // check next move for match
                    $temp = $this->splitLine($move, $color, $isNew, $isRecommended, false, $level + 1);
                }
            }

            $parts = array_merge($parts, $temp);
        }

        return $parts;
    }

    // get the line until the criteria doesn't match anymore
    private function getLineUntil(array $moves, string $color = '', bool $isNew = false, bool $isRecommended = false, $level = 1): array
    {
        $line = [];

        // is this our move
        //$ourMove = ($color == "white" && $level % 2 == 1) || ($color == "black" && $level % 2 == 0);

        // check the line to see if it matches
        foreach ($moves as $move) {

            // is this our move
            //$ourMove = ($move['color'] == "white" && $level % 2 == 1) || ($move['color'] == "black" && $level % 2 == 0);
            $ourMove = isset($move['halfmove']) ? (($move['color'] == "white" && $move['halfmove'] % 2 == 1) || ($move['color'] == "black" && $move['halfmove'] % 2 == 0)) : $move['color'] == "white";

            //print "- level: " . $level . " / move: " . $move['move'] . " / ourMove: " . $ourMove . "<br>";
            //if ($move['move'] == 'Nxa6') {
            //print "- level: " . $level . " / halfmove: " . $move['halfmove'] . "/ move: " . $move['move'] . " / " . $move['color'] . " / ourMove: " . $ourMove . "<br>";
            //}

            $autoplay = isset($move['autoplay']) ? $move['autoplay'] : false;

            // if this move matches the criteria
            if (!$ourMove || (($color != '' && $move['color'] == $color) || ($isNew && $move['new'] == 1 && !$autoplay) || ($isRecommended && $move['recommended'] == 1 && !$autoplay))) {
                // get the rest of the line
                $temp = $this->getLineUntil($move['moves'], $color, $isNew, $isRecommended, $level + 1);

                // add this move if its our move or there are child moves
                if ($ourMove || count($temp) > 0) {

                    //print "- adding..<br>";

                    // add to the lines
                    $line[] = [
                        'initialFen' => isset($move['initialFen']) ? $move['initialFen'] : "",
                        'move' => $move['move'],
                        'autoplay' => isset($move['autoplay']) ? $move['autoplay'] : false,
                        'moves' => $temp,
                        'multiple' => $move['multiple']
                    ];
                } else {

                    //print "Not added:<br>";
                    //print_r($temp);
                    //print "<br><br>";
                    //dd($temp);
                }
            } else {

                //print "- no match..<br>";
            }
        }

        return $line;
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
            $bestMoves = $uci->setPosition($fen);
        }

        // get the current best move
        $bestCp = $bestMoves[0]["cp"];
        // white to move
        $whiteToMove = true;

        // need to change this to user setting?
        $analyseForBlack = $game->getBlack() == $siteUsername;

        // get the ignore list repo
        $repo = $this->em->getRepository(IgnoreList::class);

        //print "Players: " . $game->getWhite() . " vs " . $game->getBlack() . "<br>";
        //print "Analysing for: " . ($analyseForBlack ? "Black" : "White") . "<br>";

        // get the intial win percentage
        $prevWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $bestCp)) - 1));
        $accuracy = [];
        $mistakes = [];

        // need to add this to settings?
        $includeInnacuracies = true;

        // stop analysing when we exceed the limit
        $mistakesTotal = 0;
        $mistakesLimit = 10;
        $mistakesPoints = ["inaccuracy" => 1, "mistake" => 2, "blunder" => 3];

        foreach ($uciMoves as $move) {
            // add the UCI move
            $moves[] = $move['uci'];
            // get the FEN before this move
            $fenBefore = $chess->fen();
            // remember the best moves for this move
            $bestMovesBefore = [...$bestMoves];

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
                $bestMoves = $uci->setPosition($fen, $moves);

                // if these evals are for a black move
                if ($whiteToMove) {
                    // uno reverse the cp value
                    for ($i = 0; $i < count($bestMoves); $i++) {
                        $bestMoves[$i]["cp"] = $bestMoves[$i]["cp"] * -1;
                    }
                }
            }

            $whiteToMove = !$whiteToMove;

            // get the current best move centipawn value
            $moveCp = $bestMoves[0]["cp"];

            // if we need to check the CP loss
            if ((!$whiteToMove && !$analyseForBlack) || ($whiteToMove && $analyseForBlack)) {

                // not using the centipawn for now, but keep it in..
                if ($analyseForBlack) {
                    $cpLoss = $bestCp < $moveCp ? max(0, abs($bestCp - $moveCp)) : 0;
                } else {
                    $cpLoss = $bestCp > $moveCp ? max(0, abs($bestCp - $moveCp)) : 0;
                }

                // get the current win percentage
                $winPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $moveCp)) - 1));
                if ($analyseForBlack) {
                    $winPct = 100 - $winPct;
                }

                // calculate the percentage loss for this move
                $pctLoss = $prevWinPct == -1 ? 0 : max(0, ($prevWinPct - $winPct) / 100);

                // calculate the accuracy for this move (not used for now, but keep it in)
                $acc = 103.1668 * exp(-0.04354 * ($prevWinPct - min($prevWinPct, $winPct))) - 3.1669;
                $accuracy[] = $acc;

                // set the mistake array
                $mistake = ["move" => $move["san"], "type" => "", "bestmoves" => [], "fen" => $fenBefore, "line" => ["pgn" => $linePgn, "moves" => $lineMoves]];

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

                    foreach ($bestMovesBefore as $bm) {
                        // get the move details
                        $fromSquare = substr($bm["move"], 0, 2);
                        $toSquare = substr($bm["move"], 2, 2);
                        $promotion = strlen($bm["move"] == 5) ? substr($bm["move"], 5) : "";
                        // make the move
                        $ret = $chess->move(["from" => $fromSquare, "to" => $toSquare, "promotion" => $promotion]);
                        if ($ret == null) {

                            //print "Invalid move: " . $bm['move'] . "<br>";

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
                                $moveWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $bm["cp"])) - 1));
                                if ($analyseForBlack) {
                                    $moveWinPct = 100 - $moveWinPct;
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
                                    //"line" => $bm["line"],
                                    "line" => $sanMoves
                                ];
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
                    $mistakes[] = $mistake;
                }
            } else {
                // calculate the win percentage for the previous move (for next loop)
                $prevWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $moveCp)) - 1));
                if ($analyseForBlack) {
                    $prevWinPct = 100 - $prevWinPct;
                }
            }

            $bestCp = $moveCp;

            $linePgn .= ($linePgn != "" ? " " : "") . ($halfMove % 2 == 1 ? ceil($halfMove / 2) . ". " : "") . $move['san'];
            $lineMoves[] = $move['san'];

            // increase the halfmove
            $halfMove++;
            // if we need to stop analysing
            if ($halfMove >= 30) {
                break;
            }

            // if we exceeded the mistakes limit
            if ($mistakesTotal > $mistakesLimit) {
                break;
            }
        }

        return $mistakes;
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
