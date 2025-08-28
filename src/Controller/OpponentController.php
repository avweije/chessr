<?php

namespace App\Controller;

use App\Config\DownloadSite;
use App\Config\DownloadStatus;
use App\Config\DownloadType;
use App\Entity\Downloads;
use App\Entity\ECO;
use App\Entity\Opponent;
use App\Entity\OpponentGame;
use App\Entity\OpponentMove;
use App\Entity\Repertoire;
use App\Library\GameDownloader;
use App\Service\MyPgnParser\MyPgnParser;
use App\Controller\ChessrAbstractController;
use App\Service\RepertoireService;
use DateTime;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\User\UserInterface;

const DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

class OpponentController extends ChessrAbstractController
{
    public function __construct(
        private Connection $conn, 
        private EntityManagerInterface $em, 
        private MyPgnParser $myPgnParser,
        private RepertoireService $repertoireService
        ) {}

    #[Route('/opponent', name: 'app_opponent')]
    /**
     * Renders the opponent page. Passes along opponents array to be used for the datalist input.
     *
     * @return Response
     */
    public function index(): Response
    {
        // get the opponents
        $opponents = [];

        $repo = $this->em->getRepository(Opponent::class);
        foreach ($repo->findBy([], ['Username' => 'ASC']) as $opp) {
            $opponents[] = [
                "id" => $opp->getId(),
                "username" => $opp->getUsername(),
                "site" => $opp->getSite()->value,
                "total" => $opp->getTotal()
            ];
        }

        return $this->render('opponent/index.html.twig', [
            'opponents' => $opponents,
        ]);
    }

    #[Route('/api/opponent', methods: ['GET'], name: 'app_api_opponent_get_all')]
    /**
     * Returns a JSON with the opponents and their children. Used in JS to load the opponent radio buttons, etc.
     * 
     * JSON
     * opponents: [{ id: <id>, username: <username>, site: <site>, children: [{ id: <id>, username: <username>, site: <site>}] }]
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiGetOpponents(Request $request): JsonResponse
    {
        $opponents = [];
        $parents = [];

        $repo = $this->em->getRepository(Opponent::class);

        $res = $repo->findBy([], ['Parent' => 'ASC', 'Username' => 'ASC']);

        foreach ($res as $rec) {
            // if this is a parent (= no parent_id set)
            if ($rec->getParent() == null) {
                $children = isset($parents[$rec->getId()]) ? $parents[$rec->getId()]["children"] : [];
                $parents[$rec->getId()] = [
                    "id" => $rec->getId(),
                    "username" => $rec->getUsername(),
                    "site" => $rec->getSite(),
                    "children" => $children
                ];
            } else {
                if (!isset($parents[$rec->getParent()->getId()])) {
                    $parents[$rec->getParent()->getId()] = [
                        "children" => []
                    ];
                }

                $parents[$rec->getParent()->getId()]["children"][] = [
                    "id" => $rec->getId(),
                    "username" => $rec->getUsername(),
                    "site" => $rec->getSite()
                ];
            }
        }

        foreach ($parents as $key => $details) {
            $opponents[] = $details;
        }

        return new JsonResponse(["opponents" => $opponents]);
    }

    #[Route('/api/opponent/{id}', methods: ['GET'], name: 'app_api_opponent_get')]
    /**
     * Returns the lines for the opponent identified by <id>.
     * 
     * JSON:
     * white: [<white lines>],
     * black: [<black lines>]
     *
     * @param  mixed $request
     * @param  mixed $id
     * @return JsonResponse
     */
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

    #[Route('/api/opponent/{id}', methods: ['DELETE'], name: 'app_api_opponent_delete')]
    /**
     * Deletes the opponent identified by <id> and all of their downloads, moves, etc.
     *
     * @param  mixed $request
     * @param  mixed $id
     * @return JsonResponse
     */
    public function apiDeleteOpponent(Request $request, $id): JsonResponse
    {
        $repo = $this->em->getRepository(Opponent::class);

        // find the opponent
        $opp = $repo->find($id);
        if ($opp) {
            // remove the downloads first
            $qb = $this->em->createQueryBuilder();

            $q1 = $qb->delete('App\Entity\Downloads', 'd')
                ->where('d.Opponent = :opponent')
                ->setParameter('opponent', $opp)
                ->getQuery();

            $q1->execute();

            // remove as parent
            $sql = 'UPDATE opponent SET parent_id = NULL WHERE parent_id = :parentId';
            $stmtUpdate = $this->conn->prepare($sql);

            $stmtUpdate->bindValue('parentId', $opp->getId());

            $affected = $stmtUpdate->executeStatement();

            // remove the opponent
            $this->em->remove($opp);
            $this->em->flush();
        }

        return new JsonResponse(["message" => "Opponent removed."]);
    }

    #[Route('/api/opponent/connect', methods: ['POST'], name: 'app_api_opponent_connect')]
    /**
     * Connect an opponent to a parent opponent (main account, multiple accounts).
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiOpponentConnect(Request $request): JsonResponse
    {
        // get the payload (if posted)
        $data = $request->getPayload()->all();

        $opponentId = isset($data["opponent"]) ? $data["opponent"] : null;
        $parentId = isset($data["parent"]) ? $data["parent"] : null;

        $msg = "Opponent connected to parent.";

        // find the opponent
        $repo = $this->em->getRepository(Opponent::class);
        $opp = $repo->find($opponentId);
        if ($opp) {
            // find the parent
            $parent = $repo->find($parentId);
            if ($parent) {
                // update the opponent record
                $opp->setParent($parent);
                $this->em->persist($opp);
                $this->em->flush();
            } else {
                $msg = "Parent not found.";
            }
        } else {
            $msg = "Opponent not found.";
        }

        return new JsonResponse(["message" => "Opponent connected to parent."]);
    }

    #[Route('/api/opponent/disconnect', methods: ['POST'], name: 'app_api_opponent_disconnect')]
    /**
     * Disconnect an opponent from their parent (main) account.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiOpponentDisconnect(Request $request): JsonResponse
    {
        // get the payload (if posted)
        $data = $request->getPayload()->all();

        $parentId = isset($data["parent"]) ? $data["parent"] : null;
        $children = isset($data["children"]) ? $data["children"] : null;

        // find the parent
        $repo = $this->em->getRepository(Opponent::class);
        $parent = $repo->find($parentId);
        if ($parent) {
            $cnt = 0;
            // disconnect the children
            foreach ($children as $childId) {
                // find the child
                $child = $repo->find($childId);
                if ($child) {
                    // update the child record
                    $child->setParent(null);
                    $this->em->persist($child);
                    $this->em->flush();

                    $cnt++;
                }
            }

            $msg = $cnt . " opponent(s) disconnected from parent.";
        } else {
            $msg = "Parent not found.";
        }

        return new JsonResponse(["message" => $cnt]);
    }

    #[Route('/api/opponent/moves', methods: ['POST'], name: 'app_api_opponent_get_moves')]
    /**
     * Get the opponent moves from their games. Used for moves that are or were not in our repertoire and therefor
     * had not been saved to our moves table.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
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

            // find the connected accounts for this opponent
            $children = $repo->findBy(['Parent' => $opp]);

            $accounts = [$opp, ...$children];

            foreach ($accounts as $account) {
                // get the opponent games
                $games = $this->getOpponentGames($account, $color, $pgn);
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

    #[Route('/api/opponent/analyse', methods: ['GET', 'POST'], name: 'app_api_opponent_analyse')]
    /**
     * Analyse an opponent's games against our repertoire.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
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
            //if ($mins > 4) {
            if (true) {
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
        [$lines, $groups] = $this->repertoireService->getAllLines();

        //dd($lines[0]["moves"]);

        // get the game downloader
        $downloader = new GameDownloader($this->em, null, $opp);

        // get user - createdAt
        $createdAt = $downloader->getCreatedAt();

        // get the created year & month
        $created = new DateTime();
        $created->setTimestamp($createdAt);
        $createdYear = intval($created->format('Y'));
        $createdMonth = intval($created->format('m'));

        // get the year & month from & to
        $fromYear = $periodOlder ? $createdYear : $recentYear;
        $fromMonth = $periodOlder ? $createdMonth : $recentMonth;
        $toYear = $periodRecent ? $currentYear : $olderYear;
        $toMonth = $periodRecent ? $currentMonth : $olderMonth;

        // the max games to process
        $maxGames = 100;
        //$maxDownload = $site == DownloadSite::ChessDotCom ? 100 : 10;
        $maxDownload = 100;
        $processed = 0;
        $matches = 0;
        $completed = false;

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

                    //dd($cnt, $site, $year, $month, $dtype->value, $games);

                    // loop through the games
                    for ($i = 0; $i < $cnt; $i++) {

                        /*

                    - "initial_setup" => only if empty
                    - "rules" => [chess, ?]
                    - 

                    */

                        // don't analyse games with a different initial position - [Chess.com]
                        if (
                            isset($games[$i]["initial_setup"])
                            && $games[$i]["initial_setup"] !== ""
                            && $games[$i]["initial_setup"] !== DEFAULT_POSITION
                        ) {
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

                        //dd($oppGame, $games[$i]);

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

                        // DEBUG
                        //dd("New opponent game:", $oppGame);

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
            'period' => (new DateTime())->setDate($year, $month, 1)->format("F, Y"),
            'debugInfo' => $downloader->getDebugInfo()
        ]);
    }

    /**
     * Get all of the opponent lines or just for a certain color and/or PGN.
     *
     * @param  mixed $opponent
     * @param  mixed $color
     * @param  mixed $pgn
     * @return void
     */
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

        // find the connected accounts for this opponent
        $repo = $this->em->getRepository(Opponent::class);
        $children = $repo->findBy(['Parent' => $opponent]);

        // get an array with opponent & children
        $ids = [$opponent, ...$children];

        $repoRep = $this->em->getRepository(Repertoire::class);

        // get the opponent moves
        $qb = $this->em->createQueryBuilder('OpponentMove');
        $query = $qb->select('om')
            ->from('App\Entity\OpponentMove', 'om')
            ->where('om.Opponent IN (:opp)')
            ->setParameter('opp', $ids);

        // if we need to fetch a specific line
        if ($color !== "" && $pgn !== "") {
            $query = $query->andWhere('om.Color = :color')
                ->andWhere($qb->expr()->like('om.Pgn', 'CONCAT(:pgn, \' %\')'))
                ->setParameter('color', $color)
                ->setParameter('pgn', $pgn);
        }

        $query = $query->addOrderBy('om.Color', 'ASC')
            ->addOrderBy('om.Pgn', 'ASC')
            ->getQuery();

        $res = $query->getResult();

        $includeEco = true;

        foreach ($res as $rec) {
            // find the ECO from the parent moves
            $eco = null;
            $hasMore = true;
            if ($includeEco && $rec->getPgn() !== "") {
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
            if ($includeEco && $rec->getPgn() !== "" && $hasMore) {

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

                // SKIP ABOVE FOR NOW, VERY SLOW.. ONLY DO THIS FOR TOP LEVEL MOVES ? AND CHECK ON LOWER MOVES WHEN THEY ARE OPENED ??
                //if (false) {

                // find the move in our repository (opposite color)
                $rep = $repoRep->findOneBy([
                    'Color' => $rec->getColor() == "white" ? "black" : "white",
                    'FenBefore' => $rec->getFen(),
                    'Move' => $rec->getMove()
                ]);

                // if we now have this move in our repertoire
                if ($rep) {

                    /*

                    - to speed things up.. 
                    - only setMatches(true) here and in JSON ?? need to check for setMatches, maybe in /moves function

                    - and then find the moves and add them to the database, only if the move is expanded with /moves api call..
                    - in /moves api call, check if move now exists, if it does, do the code below here.. ??


                    */

                    //dd($rec, $rep);

                    $newRepertoireMoves++;

                    // if we haven't fetched the lines yet
                    if (!$linesFetched) {
                        // get the repertoire lines
                        [$lines, $groups] = $this->repertoireService->getAllLines();

                        $linesFetched = true;
                    }

                    $oppMoves = [];

                    // get the opponent games
                    $games = $this->getOpponentGames($rec->getOpponent(), $rec->getColor(), $rec->getPgn());
                    foreach ($games as $game) {
                        // get the new opponent moves
                        $newMoves = $this->getOpponentMoves($rec->getColor(), $lines, $game["moves"]);

                        // filter the moves based on the PGN (those opponent moves already exist)
                        $filtered = [];
                        foreach ($newMoves["moves"] as $move) {
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
                    $this->saveOpponentMoves($rec->getOpponent(), $oppMoves);

                    // get the newly added moves for this line
                    $newChildMoves = $this->getOpponentLines($rec->getOpponent(), $rec->getColor(), $rec->getPgn());

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

            // in case of connected accounts, we may need to update the move
            if (isset($_moves[$rec->getMove()])) {
                // update the totals
                $_moves[$rec->getMove()]["wins"] = $_moves[$rec->getMove()]["wins"] + $rec->getWins();
                $_moves[$rec->getMove()]["draws"] = $_moves[$rec->getMove()]["draws"] + $rec->getDraws();
                $_moves[$rec->getMove()]["losses"] = $_moves[$rec->getMove()]["losses"] + $rec->getLosses();
                $_moves[$rec->getMove()]["matches"] = $_moves[$rec->getMove()]["matches"] || $rec->isMatches();
                $_moves[$rec->getMove()]["fetched"] = $_moves[$rec->getMove()]["matches"] ? 1 : 0;
            } else {
                // add it
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

    /**
     * Get suggestions based on the opponent moves (to add to our repertoire).
     *
     * @param  mixed $color
     * @param  mixed $moves
     * @param  mixed $halfmove
     * @return array
     */
    private function getOpponentSuggestions($color, $moves, $halfmove = 1): array
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

    /**
     * Get the opponent games for a certain PGN, adding an array with the moves.
     *
     * @param  mixed $opponent
     * @param  mixed $color
     * @param  mixed $pgn
     * @return array
     */
    private function getOpponentGames($opponent, $color, $pgn): array
    {
        $games = [];

        // find the connected accounts for this opponent
        //$repo = $this->em->getRepository(Opponent::class);
        //$children = $repo->findBy(['Parent' => $opponent]);

        // get an array with opponent & children
        //$ids = [$opponent, ...$children];

        $qb = $this->em->createQueryBuilder();
        $query = $qb->select('og')
            ->from('App\Entity\OpponentGame', 'og')
            //->where('og.Opponent IN (:opp)')
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

    /**
     * Parse & analyse an opponent game.
     *
     * @param  mixed $data
     * @param  mixed $opponent
     * @param  mixed $lines
     * @return array
     */
    private function analyseOpponentGame($data, $opponent, $lines): ?array
    {
        // make sure we have a PGN
        if (!isset($data["pgn"])) {
            return null;
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
        $oppMoves = $this->getOpponentMoves($color, $lines, $game->getMovesArray());

        $oppGame = [
            "color" => $color,
            "result" => $result,
            "pgn" => $game->getMovesPgn(),
            "match" => $oppMoves["match"],
            "moves" => $oppMoves["moves"]
        ];

        //dd($color, $oppGame);

        return $oppGame;
    }

    /**
     * Get the opponent moves for a game, based off our repertoire.
     *
     * @param  mixed $color
     * @param  mixed $lines
     * @param  mixed $gameMoves
     * @return array
     */
    private function getOpponentMoves($color, $lines, $gameMoves): array
    {
        /*

        - currently works off of our repertoire, so only those moves are checked?
        - for gotham we don't have e4 atm, because e4 was disabled.. 
        - we should always get all of the opponent moves!

        */

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
                    if (trim($move) == "") {
                        continue;
                    }

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

        return ["match" => $gameMatch, "moves" => $oppMoves];
    }

    /**
     * Save the moves for a certain opponent.
     *
     * @param  mixed $opponent
     * @param  mixed $oppMoves
     * @return void
     */
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

    /**
     * Gets or creates a download record for a user or opponent and sets the status to Downloading.
     *
     * @param  mixed $user
     * @param  mixed $opponent
     * @param  mixed $site
     * @param  mixed $year
     * @param  mixed $month
     * @param  mixed $type
     * @return mixed
     */
    private function getDownloadRecord(?UserInterface $user, ?Opponent $opponent, $site, $year, $month, $type): mixed
    {
        // get the repository
        $repository = $this->em->getRepository(Downloads::class);

        // set the criteria
        $crit = [
            'Site' => $site,
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
}
