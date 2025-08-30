<?php

namespace App\Controller;

use App\Config\DownloadSite;
use App\Config\DownloadStatus;
use App\Config\DownloadType;
use App\Entity\Evaluation;
use App\Entity\Analysis;
use App\Entity\Downloads;
use App\Entity\IgnoreList;
use App\Entity\Opponent;
use App\Entity\Settings;
use App\Entity\User;
use App\Library\ChessJs;
use App\Library\GameDownloader;
use App\Service\MyPgnParser\MyPgnParser;
use App\Controller\ChessrAbstractController;
use DateTime;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;
use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Core\User\UserInterface;

class AnalyseController extends ChessrAbstractController
{
    public function __construct(private Connection $conn, private EntityManagerInterface $em, private ManagerRegistry $doctrine, private MyPgnParser $myPgnParser)
    {}

    #[Route('/analyse', name: 'analyse')]
    public function index(): Response
    {
        return $this->render('analyse/index.html.twig');
    }

    #[Route('/api/analyse/download', methods: ['POST'], name: 'app_api_analyse_download')]
    /**
     * Downloads the next batch of games for a user, site, type and period.
     * Used in conjunction with /api/analyse/evaluate to download and evaluate the games.
     *
     * @param  mixed $request
     * @return JsonResponse
     */
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
            $settings->setRecommendInterval(0);
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
                $rec = $this->getDownloadRecord($this->getUser(), null, $site, $year, $month, $dtype->value);
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
    /**
     * Evaluates a game based on evaluations given in the payload (from our eval database and from the local JS Stockfish).
     *
     * @param  mixed $request
     * @return JsonResponse
     */
    public function apiAnalyseEvaluate(Request $request): JsonResponse
    {
        // get the payload
        $payload = $request->getPayload()->all();

        // evaluate the game
        $mistakes = $this->evaluateGame($payload["game"]);

        // set the totals
        $totals = ["inaccuracies" => 0, "mistakes" => 0, "blunders" => 0];

        foreach ($mistakes as $mistake) {
            if (!isset($mistake["type"])) {
                continue;
            }

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

        // if there are any mistakes
        if (count($mistakes) > 0) {
            // get the initial fen
            $initialFen = $payload["game"]["fen"] !== null ? $payload["game"]["fen"] : "";
            // add them to the database
            foreach ($mistakes as $mistake) {
                if (!isset($mistake["type"])) {
                    continue;
                }

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

                $this->em->persist($rc);
            }
        }

        // update the download record
        $rec = $this->getDownloadRecord($this->getUser(), null, $payload["site"], $payload["year"], $payload["month"], $payload["game"]["type"]);
        if ($rec !== null) {
            // update the last UUID
            $rec->setDateTime(new DateTime());
            $rec->setLastUUID($payload["game"]["uuid"]);
            $rec->setStatus(DownloadStatus::Partial);

            $this->em->persist($rec);
        }

        $this->em->flush();

        return new JsonResponse([
            'message' => 'Analysis done.',
            'totals' => $totals,
            'mistakes' => $mistakes
        ]);
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

    /**
     * Gets all the evaluations that are available in our database for a certain game.
     * 
     * Returns an array with information about the game and the evaluations for the moves that are in our eval database.
     * The rest of the evaluations will need to be done locally with the Stockfish JS engine.
     *
     * @param  mixed $data
     * @param  mixed $siteUsername
     * @return array
     */
    private function getGameEvaluations($data, string $siteUsername): ?array
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
                "engine" => $bestMoves == null,
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

    /**
     * Evaluates a chess game using move evaluations passed along in the $game parameter.
     * 
     * Returns an array with all the inaccuracies, mistakes and blunders.
     *
     * @param  mixed $game
     * @return array
     */
    private function evaluateGame($game): array
    {
        // get the user settings
        $user = $this->em->getRepository(User::class)->find($this->getUser());
        $settings = $user->getSettings();

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
        $centipawn = [];

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
                    // if we need to include inaccuracies
                    if (!$settings->isAnalyseIgnoreInaccuracy()) {
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
            $centipawns[] = [$move["san"], $moveCp];

            $linePgn .= ($linePgn != "" ? " " : "") . ($halfMove % 2 == 1 ? ceil($halfMove / 2) . ". " : "") . $move['san'];
            $lineMoves[] = $move['san'];

            // increase the halfmove
            $halfMove++;

            // if we exceeded the mistakes limit
            if ($mistakesTotal >= $mistakesLimit) {
                break;
            }
        }

        // TEMP - testing
        $mistakes[] = ["centipawns" => $centipawns];

        return $mistakes;
    }

    /**
     * Returns the best moves from our eval database based on a FEN string.
     *
     * @param  mixed $fen
     * @param  mixed $max
     * @return array
     */
    private function getEvaluationBestMoves(string $fen, $max = 5): ?array
    {
        $parts = explode(" ", $fen);
        // the fen without the move numbers
        $fenWithout = implode(" ", array_slice($parts, 0, 4));
        // the 2nd with the en-passant square as -
        $fenWithout2 = implode(" ", array_slice($parts, 0, 3)) . " -";

        $repo = $this->em->getRepository(Evaluation::class);

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
}
