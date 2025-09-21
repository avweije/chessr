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
use App\Service\ChessHelper;
use App\Service\GameEvaluator;
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
  public function __construct(
    private Connection $conn,
    private EntityManagerInterface $em,
    private ManagerRegistry $doctrine,
    private MyPgnParser $myPgnParser,
    private ChessHelper $chessHelper,
    private GameEvaluator $gameEvaluator
  ) {}

  #[Route('/analyse', name: 'analyse')]
  public function index(): Response
  {

    //$jsonData = $this->getJsonTestData();
    //$jsonData = $this->getJsonTestData2();

    //dd($jsonData);

    //$mistakes = $this->gameEvaluator->evaluateGame($jsonData['game']);
    //$mistakes = $this->evaluateGame($jsonData['game']);

    //dd($mistakes, $this->gameEvaluator->getLog());

    return $this->render('analyse/index.html.twig');
  }

  #[Route('/api/analyse/download', methods: ['POST'], name: 'api_analyse_download')]
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
      // Board settings
      $settings->setAnimationDuration(300);
      // Engine settings
      $settings->setRepertoireEngineTime(30);
      $settings->setAnalyseEngineTime(1000);
      $settings->setAnalyseIgnoreInaccuracy(false);
      // Practice settings
      $settings->setRecommendInterval(0);
      $settings->setBalloonsAmount(1);
      $settings->setAnimateVariation(0);
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

      // If more than 2 minutes ago, it's good
      if ($mins > 2) {
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
            
            // Increase the downloaded counter before we possibly skip
            $downloaded++;
            // Skip if we have no game (no moves for instance)
            if ($evals === null) continue;

            // add download info
            $evals["site"] = $settings->getSite();
            $evals["username"] = $siteUsername;
            $evals["year"] = $year;
            $evals["month"] = $month;
            $evals["type"] = $dtype->value;

            // add to the downloaded games
            $games[] = $evals;

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

  #[Route('/api/analyse/evaluate', methods: ['POST'], name: 'api_analyse_evaluate')]
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
    $mistakes = $this->gameEvaluator->evaluateGame($payload["game"]);

    //$mistakes = $this->evaluateGame($payload["game"]);



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

    // Skip if there are no moves
    if (count($game->getMovesArray()) === 0) return null;

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
      // play the move
      $chess->move($move["san"]);
      // if the game is over, we can stop the analysis
      if ($chess->gameOver()) {
        break;
      }

      // get the FEN after this move
      $fen = $chess->fen();
      // Normalize the FEN string for evaluations
      $fen = $this->chessHelper->normalizeFenForEvaluation($fen);

      // get the database evaluations for this position
      $bestMoves = $this->getEvaluationBestMoves($fen, 3);

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

    //dd($bestMoves, $game);

    // get the current best move
    $bestCp = $bestMoves[0]["cp"] ?? 0;
    $bestMate = $bestMoves[0]["mate"] ?? 0;

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

    //dd($prevWinPct, $bestCp, $bestMate);

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
      if ($halfMove > 1 && (!$whiteToMove && !$analyseForBlack) || ($whiteToMove && $analyseForBlack)) {

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

        //dd($winPct, $acc, $prevWinPct, $fenBefore, $bestMovesBefore, $whiteToMove, $moveCp, $moveMate, $mistakesTotal, $mistakesLimit);

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
    // Normalize the FEN string for evaluations
    $fen = $this->chessHelper->normalizeFenForEvaluation($fen);

    $repo = $this->em->getRepository(Evaluation::class);

    // Get the top evals for this position
    $topEvals = $repo->findTopEvaluationByFen($fen);

    // Create a ChessJs instance
    $chess = new ChessJs();

    $pvs = [];
    foreach ($topEvals as $eval) {
      // If we don't have the SAN move yet, determine it now
      if (empty($eval->getSan())) {
        // Get the SAN notation
        $san = $this->chessHelper->getFirstSanMoveFromLine($chess, $fen, $eval->getLine());
        // Update the entity
        $eval->setSan($san);
        $this->em->persist($eval);
        $this->em->flush();
      }

      $pvs[] = [
        "depth" => $eval->getDepth(),
        "cp" => $eval->getCp(),
        "mate" => $eval->getMate(),
        "move" => $eval->getUci(),
        "san" => $eval->getSan(),
        "line" => explode(' ', $eval->getLine())
      ];
    }

    return $pvs;
  }

  private function getJsonTestData2()
  {
    $json2 = '{
  "uuid": "26067cec-ffd9-11ef-8008-6cfe544c0428",
  "color": "black",
  "opponent": "HannahSayceStreams",
  "result": "0-1",
  "fen": null,
  "link": "https://www.chess.com/game/live/135587973989",
  "evaluations": 3,
  "engine": 26,
  "moves": [
    {
      "san": "f3",
      "uci": "f2f3",
      "ignore": false,
      "bestmoves": [
        {
          "depth": 64,
          "cp": 19,
          "mate": null,
          "move": "g1f3",
          "san": "Nf3",
          "line": [
            "g1f3",
            "d7d5",
            "d2d4",
            "e7e6",
            "c2c4",
            "g8f6",
            "b1c3",
            "f8b4",
            "c4d5",
            "e6d5"
          ]
        },
        {
          "depth": 64,
          "cp": 18,
          "mate": null,
          "move": "e2e4",
          "san": "e4",
          "line": [
            "e2e4",
            "e7e5",
            "g1f3",
            "b8c6",
            "f1b5",
            "g8f6",
            "e1h1",
            "f6e4",
            "f1e1",
            "e4d6"
          ]
        },
        {
          "depth": 63,
          "cp": 19,
          "mate": null,
          "move": "d2d4",
          "san": "d4",
          "line": [
            "d2d4",
            "g8f6",
            "c2c4",
            "e7e6",
            "g1f3",
            "d7d5",
            "b1c3",
            "f8b4",
            "c4d5",
            "e6d5"
          ]
        }
      ],
      "engine": false,
      "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
      "line": {
        "pgn": "",
        "san": [],
        "uci": []
      }
    },
    {
      "san": "d5",
      "uci": "d7d5",
      "ignore": false,
      "bestmoves": [
        {
          "depth": 50,
          "cp": -77,
          "mate": null,
          "move": "e7e5",
          "san": "e5",
          "line": [
            "e7e5",
            "b1c3",
            "b8c6",
            "e2e3",
            "d7d5",
            "f1b5",
            "g8f6",
            "d2d3",
            "f8d6",
            "g1e2"
          ]
        },
        {
          "depth": 50,
          "cp": -50,
          "mate": null,
          "move": "d7d5",
          "san": "d5",
          "line": [
            "d7d5",
            "d2d4",
            "g8f6",
            "b1c3",
            "c7c5",
            "e2e4",
            "e7e6",
            "e4d5",
            "f6d5",
            "c3d5"
          ]
        },
        {
          "depth": 50,
          "cp": -48,
          "mate": null,
          "move": "g8f6",
          "san": "Nf6",
          "line": [
            "g8f6",
            "f3f4",
            "g7g6",
            "g1f3",
            "d7d5",
            "e2e3",
            "c7c5",
            "f1b5",
            "c8d7",
            "b5e2"
          ]
        },
        {
          "depth": 43,
          "cp": -67,
          "mate": null,
          "move": "e7e5",
          "san": "e5",
          "line": [
            "e7e5",
            "b1c3",
            "b8c6",
            "e2e4",
            "f8c5",
            "f1c4",
            "d7d6",
            "d2d3",
            "a7a5",
            "a2a3"
          ]
        },
        {
          "depth": 43,
          "cp": -56,
          "mate": null,
          "move": "g8f6",
          "san": "Nf6",
          "line": [
            "g8f6",
            "e2e3",
            "d7d5",
            "f3f4",
            "c8f5",
            "g1f3",
            "e7e6",
            "b2b3",
            "c7c5",
            "c1b2"
          ]
        }
      ],
      "engine": false,
      "fen": "rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq -",
      "line": {
        "pgn": "1. f3",
        "san": [
          "f3"
        ],
        "uci": [
          "f2f3"
        ]
      }
    },
    {
      "san": "e3",
      "uci": "e2e3",
      "ignore": false,
      "bestmoves": [
        {
          "depth": 37,
          "cp": -68,
          "mate": null,
          "move": "f3f4",
          "san": "f4",
          "line": [
            "f3f4",
            "b8c6",
            "d2d4",
            "c8g4",
            "b1c3",
            "e7e6",
            "g1f3",
            "g8h6",
            "e2e3",
            "h6f5"
          ]
        },
        {
          "depth": 37,
          "cp": -76,
          "mate": null,
          "move": "e2e4",
          "san": "e4",
          "line": [
            "e2e4",
            "e7e5",
            "e4d5",
            "d8d5",
            "b1c3",
            "d5e6",
            "f3f4",
            "e5f4",
            "f1e2",
            "f8d6"
          ]
        },
        {
          "depth": 37,
          "cp": -81,
          "mate": null,
          "move": "d2d4",
          "san": "d4",
          "line": [
            "d2d4",
            "g8f6",
            "b1c3",
            "c7c5",
            "e2e4",
            "b8c6",
            "e4d5",
            "f6d5",
            "d4c5",
            "d5c3"
          ]
        },
        {
          "depth": 37,
          "cp": -88,
          "mate": null,
          "move": "b1c3",
          "san": "Nc3",
          "line": [
            "b1c3",
            "d5d4",
            "c3e4",
            "e7e5",
            "e4f2",
            "c7c5",
            "e2e4",
            "b8c6",
            "f1c4",
            "f8d6"
          ]
        },
        {
          "depth": 37,
          "cp": -110,
          "mate": null,
          "move": "e2e3",
          "san": "e3",
          "line": [
            "e2e3",
            "e7e5",
            "d2d4",
            "b8c6",
            "f1b5",
            "c8d7",
            "b1c3",
            "e5d4",
            "c3d5",
            "a7a6"
          ]
        }
      ],
      "engine": false,
      "fen": "rnbqkbnr/ppp1pppp/8/3p4/8/5P2/PPPPP1PP/RNBQKBNR w KQkq d6",
      "line": {
        "pgn": "1. f3 d5",
        "san": [
          "f3",
          "d5"
        ],
        "uci": [
          "f2f3",
          "d7d5"
        ]
      }
    },
    {
      "san": "c5",
      "uci": "c7c5",
      "ignore": false,
      "bestmoves": [
        {
          "move": "e7e5",
          "depth": 17,
          "cp": 140,
          "mate": null,
          "inverted": false,
          "line": [
            "e7e5",
            "b1c3"
          ]
        },
        {
          "move": "g8f6",
          "depth": 16,
          "cp": 102,
          "mate": null,
          "inverted": false,
          "line": [
            "g8f6",
            "f3f4",
            "c8f5",
            "g1f3",
            "e7e6",
            "b2b3",
            "h7h6",
            "f1e2",
            "f8d6",
            "e1g1",
            "e8g8",
            "c2c4",
            "c7c5",
            "b1c3",
            "b8c6",
            "c3b5",
            "d6e7",
            "c1b2"
          ]
        },
        {
          "move": "c7c5",
          "depth": 16,
          "cp": 94,
          "mate": null,
          "inverted": false,
          "line": [
            "c7c5",
            "f3f4",
            "b8c6",
            "g1f3",
            "e7e6",
            "b2b3",
            "f8e7",
            "c1b2",
            "e7f6",
            "b1c3",
            "g8e7",
            "f1b5",
            "e8g8",
            "e1g1",
            "c8d7",
            "d2d4",
            "e7f5"
          ]
        }
      ],
      "engine": true,
      "fen": "rnbqkbnr/ppp1pppp/8/3p4/8/4PP2/PPPP2PP/RNBQKBNR b KQkq -",
      "line": {
        "pgn": "1. f3 d5 2. e3",
        "san": [
          "f3",
          "d5",
          "e3"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3"
        ]
      }
    },
    {
      "san": "Ne2",
      "uci": "g1e2",
      "ignore": false,
      "bestmoves": [
        {
          "move": "f3f4",
          "depth": 17,
          "cp": 42,
          "mate": null,
          "inverted": true,
          "line": [
            "f3f4",
            "b8c6",
            "g1f3",
            "c8f5",
            "f1e2",
            "e7e6",
            "e1g1",
            "f8d6",
            "c2c4",
            "g8e7",
            "f3h4",
            "f5b1",
            "a1b1",
            "d5d4",
            "b2b3",
            "e8g8",
            "h4f3"
          ]
        },
        {
          "move": "d2d4",
          "depth": 17,
          "cp": 65,
          "mate": null,
          "inverted": true,
          "line": [
            "d2d4",
            "e7e6",
            "c2c4",
            "c5d4",
            "e3d4",
            "b8c6",
            "c4d5",
            "e6d5",
            "f1b5",
            "f8d6",
            "g1e2",
            "g8e7",
            "e1g1",
            "e8g8",
            "c1f4",
            "d6f4",
            "e2f4",
            "e7f5",
            "b5c6",
            "b7c6"
          ]
        },
        {
          "move": "f1b5",
          "depth": 17,
          "cp": 85,
          "mate": null,
          "inverted": true,
          "line": [
            "f1b5",
            "c8d7"
          ]
        }
      ],
      "engine": true,
      "fen": "rnbqkbnr/pp2pppp/8/2pp4/8/4PP2/PPPP2PP/RNBQKBNR w KQkq c6",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5"
        ]
      }
    },
    {
      "san": "Nc6",
      "uci": "b8c6",
      "ignore": false,
      "bestmoves": [
        {
          "move": "b8c6",
          "depth": 17,
          "cp": 137,
          "mate": null,
          "inverted": false,
          "line": [
            "b8c6",
            "d2d4",
            "e7e6",
            "g2g3",
            "g8f6",
            "f1g2",
            "h7h5",
            "f3f4",
            "c5d4",
            "e3d4",
            "f8e7",
            "b1c3",
            "h5h4",
            "a2a3",
            "b7b6",
            "g2f3",
            "c8a6",
            "g3h4",
            "h8h4"
          ]
        },
        {
          "move": "e7e6",
          "depth": 16,
          "cp": 129,
          "mate": null,
          "inverted": false,
          "line": [
            "e7e6",
            "d2d4",
            "b8c6",
            "g2g3",
            "h7h5",
            "b1c3",
            "g8f6",
            "f1g2",
            "b7b6",
            "e3e4",
            "c5d4",
            "e2d4",
            "c6d4",
            "d1d4",
            "f8c5",
            "d4a4",
            "c8d7",
            "a4b3"
          ]
        },
        {
          "move": "h7h5",
          "depth": 16,
          "cp": 127,
          "mate": null,
          "inverted": false,
          "line": [
            "h7h5",
            "d2d4",
            "b8c6",
            "b1c3",
            "e7e6",
            "d1d2",
            "g8f6",
            "e3e4",
            "a7a6",
            "a2a3",
            "d5e4",
            "d4c5",
            "d8d2",
            "c1d2",
            "e4f3",
            "g2f3",
            "f8c5",
            "e1c1"
          ]
        }
      ],
      "engine": true,
      "fen": "rnbqkbnr/pp2pppp/8/2pp4/8/4PP2/PPPPN1PP/RNBQKB1R b KQkq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2"
        ]
      }
    },
    {
      "san": "g3",
      "uci": "g2g3",
      "ignore": false,
      "bestmoves": [
        {
          "move": "d2d4",
          "depth": 17,
          "cp": 92,
          "mate": null,
          "inverted": true,
          "line": [
            "d2d4",
            "e7e6",
            "g2g3",
            "f8d6",
            "f1g2",
            "c5d4",
            "e3d4",
            "g8e7",
            "e1g1",
            "e8g8",
            "b1c3",
            "a7a6",
            "a2a3",
            "h7h6",
            "c1e3",
            "e7f5",
            "e3f2",
            "d6e7",
            "f3f4",
            "c8d7"
          ]
        },
        {
          "move": "f3f4",
          "depth": 16,
          "cp": 107,
          "mate": null,
          "inverted": true,
          "line": [
            "f3f4",
            "g8f6",
            "d2d4",
            "e7e6",
            "g2g3",
            "c5d4",
            "e3d4",
            "c8d7",
            "f1g2",
            "c6e7",
            "e1g1",
            "e7f5",
            "c2c4",
            "h7h5",
            "c4d5",
            "f6d5"
          ]
        },
        {
          "move": "e3e4",
          "depth": 16,
          "cp": 117,
          "mate": null,
          "inverted": true,
          "line": [
            "e3e4",
            "g8f6",
            "e4d5",
            "f6d5",
            "b1c3",
            "e7e5",
            "c3d5",
            "d8d5",
            "e2g3",
            "f8e7",
            "f1d3",
            "e8g8",
            "d3e4",
            "d5e6",
            "e1g1",
            "f7f5",
            "e4c6",
            "b7c6",
            "d2d3",
            "f8d8"
          ]
        }
      ],
      "engine": true,
      "fen": "r1bqkbnr/pp2pppp/2n5/2pp4/8/4PP2/PPPPN1PP/RNBQKB1R w KQkq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6"
        ]
      }
    },
    {
      "san": "Nf6",
      "uci": "g8f6",
      "ignore": false,
      "bestmoves": [
        {
          "move": "h7h5",
          "depth": 16,
          "cp": 136,
          "mate": null,
          "inverted": false,
          "line": [
            "h7h5",
            "h2h3"
          ]
        },
        {
          "move": "e7e5",
          "depth": 16,
          "cp": 133,
          "mate": null,
          "inverted": false,
          "line": [
            "e7e5",
            "f1g2",
            "h7h5",
            "h2h3",
            "c8e6",
            "d2d3",
            "g8e7",
            "e3e4",
            "d8b6",
            "e4d5",
            "e7d5",
            "c2c4",
            "d5e7",
            "f3f4",
            "e5f4",
            "e1g1",
            "f4g3",
            "e2g3",
            "e7g6"
          ]
        },
        {
          "move": "g8f6",
          "depth": 15,
          "cp": 126,
          "mate": null,
          "inverted": false,
          "line": [
            "g8f6",
            "d2d4",
            "e7e6",
            "f1g2",
            "h7h5",
            "b1c3",
            "b7b6",
            "e3e4",
            "c5d4",
            "e4d5",
            "e6d5",
            "c3b5",
            "f8c5",
            "c1f4",
            "e8g8"
          ]
        }
      ],
      "engine": true,
      "fen": "r1bqkbnr/pp2pppp/2n5/2pp4/8/4PPP1/PPPPN2P/RNBQKB1R b KQkq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3"
        ]
      }
    },
    {
      "san": "Bg2",
      "uci": "f1g2",
      "ignore": false,
      "bestmoves": [
        {
          "move": "d2d3",
          "depth": 16,
          "cp": 76,
          "mate": null,
          "inverted": true,
          "line": [
            "d2d3",
            "e7e5",
            "f1g2",
            "h7h5",
            "e3e4",
            "d5e4",
            "d3e4",
            "d8d1",
            "e1d1",
            "c8e6",
            "c1g5",
            "f8e7",
            "b1c3",
            "c6d4",
            "a1b1",
            "f6d7",
            "g5e3",
            "e8g8",
            "c3d5"
          ]
        },
        {
          "move": "d2d4",
          "depth": 16,
          "cp": 82,
          "mate": null,
          "inverted": true,
          "line": [
            "d2d4"
          ]
        },
        {
          "move": "f1g2",
          "depth": 15,
          "cp": 92,
          "mate": null,
          "inverted": true,
          "line": [
            "f1g2",
            "h7h5",
            "h2h3",
            "e7e5",
            "b2b3",
            "f8d6",
            "e1g1",
            "e8g8",
            "c1b2",
            "c8e6",
            "f3f4",
            "d5d4",
            "b1a3",
            "e6d5",
            "g2d5",
            "f6d5",
            "f4e5",
            "d6e5"
          ]
        }
      ],
      "engine": true,
      "fen": "r1bqkb1r/pp2pppp/2n2n2/2pp4/8/4PPP1/PPPPN2P/RNBQKB1R w KQkq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6"
        ]
      }
    },
    {
      "san": "e6",
      "uci": "e7e6",
      "ignore": false,
      "bestmoves": [
        {
          "move": "h7h5",
          "depth": 16,
          "cp": 101,
          "mate": null,
          "inverted": false,
          "line": [
            "h7h5",
            "h2h3"
          ]
        },
        {
          "move": "e7e5",
          "depth": 15,
          "cp": 108,
          "mate": null,
          "inverted": false,
          "line": [
            "e7e5",
            "d2d3",
            "c8e6",
            "f3f4",
            "h7h5",
            "e1g1",
            "h5h4",
            "f4f5",
            "e6c8",
            "c1d2",
            "f8e7",
            "c2c4",
            "h4h3",
            "g2h1",
            "d5c4",
            "h1c6",
            "b7c6",
            "d3c4"
          ]
        },
        {
          "move": "b7b5",
          "depth": 15,
          "cp": 105,
          "mate": null,
          "inverted": false,
          "line": [
            "b7b5",
            "d2d3",
            "e7e6",
            "e1g1",
            "f8e7",
            "b2b3",
            "c8b7",
            "f3f4",
            "e8g8",
            "b1d2",
            "d8b6",
            "g2f3",
            "d5d4",
            "e3d4",
            "c6d4",
            "e2d4",
            "c5d4",
            "d1e2",
            "a8e8"
          ]
        }
      ],
      "engine": true,
      "fen": "r1bqkb1r/pp2pppp/2n2n2/2pp4/8/4PPP1/PPPPN1BP/RNBQK2R b KQkq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2"
        ]
      }
    },
    {
      "san": "O-O",
      "uci": "e1g1",
      "ignore": false,
      "bestmoves": [
        {
          "move": "f3f4",
          "depth": 17,
          "cp": 47,
          "mate": null,
          "inverted": true,
          "line": [
            "f3f4",
            "f8e7",
            "d2d3",
            "e8g8",
            "e1g1",
            "b7b5",
            "b1d2",
            "c8b7",
            "d2f3",
            "a7a5",
            "c1d2",
            "d8b6",
            "a2a3",
            "a8d8",
            "f3e5",
            "e7d6"
          ]
        },
        {
          "move": "e1g1",
          "depth": 16,
          "cp": 47,
          "mate": null,
          "inverted": true,
          "line": [
            "e1g1",
            "f8e7",
            "b2b3",
            "e8g8",
            "b1a3",
            "e6e5",
            "c1b2",
            "a7a6",
            "d2d3",
            "c8d7",
            "f3f4",
            "f6g4",
            "d1d2",
            "d5d4",
            "e3d4",
            "e5d4",
            "a3c4",
            "b7b5"
          ]
        },
        {
          "move": "b2b3",
          "depth": 16,
          "cp": 61,
          "mate": null,
          "inverted": true,
          "line": [
            "b2b3",
            "e6e5",
            "e1g1",
            "h7h5",
            "h2h3",
            "c8f5",
            "d2d3",
            "d8d7",
            "h3h4",
            "f8e7",
            "e3e4",
            "f5e6",
            "c2c4",
            "d5d4",
            "c1g5",
            "e8g8",
            "g1h1",
            "a7a6",
            "b1d2",
            "e6h3"
          ]
        }
      ],
      "engine": true,
      "fen": "r1bqkb1r/pp3ppp/2n1pn2/2pp4/8/4PPP1/PPPPN1BP/RNBQK2R w KQkq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6"
        ]
      }
    },
    {
      "san": "Bd6",
      "uci": "f8d6",
      "ignore": false,
      "bestmoves": [
        {
          "move": "h7h5",
          "depth": 17,
          "cp": 85,
          "mate": null,
          "inverted": false,
          "line": [
            "h7h5",
            "h2h3"
          ]
        },
        {
          "move": "f8e7",
          "depth": 16,
          "cp": 87,
          "mate": null,
          "inverted": false,
          "line": [
            "f8e7",
            "b2b3",
            "e8g8",
            "f3f4",
            "b7b6",
            "d2d3",
            "c8b7",
            "b1d2",
            "f6g4",
            "d2f3",
            "d5d4",
            "f3e5",
            "g4e5",
            "f4e5",
            "a8b8",
            "e3d4",
            "c5d4"
          ]
        },
        {
          "move": "b7b6",
          "depth": 16,
          "cp": 84,
          "mate": null,
          "inverted": false,
          "line": [
            "b7b6",
            "d2d3",
            "f8e7",
            "e3e4",
            "c8b7",
            "b1d2",
            "e8g8",
            "b2b3",
            "d8c7",
            "c1b2",
            "f8d8",
            "a2a4",
            "d5d4",
            "d2c4",
            "e6e5",
            "h2h3",
            "g8h8",
            "f3f4"
          ]
        }
      ],
      "engine": true,
      "fen": "r1bqkb1r/pp3ppp/2n1pn2/2pp4/8/4PPP1/PPPPN1BP/RNBQ1RK1 b kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1"
        ]
      }
    },
    {
      "san": "d4",
      "uci": "d2d4",
      "ignore": false,
      "bestmoves": [
        {
          "move": "c2c4",
          "depth": 17,
          "cp": 17,
          "mate": null,
          "inverted": true,
          "line": [
            "c2c4",
            "d5d4",
            "e3d4",
            "c5d4",
            "d2d3",
            "e6e5",
            "f3f4",
            "e8g8",
            "f4e5",
            "c6e5",
            "c1g5",
            "e5g4",
            "h2h3",
            "g4e3",
            "g5e3",
            "d4e3",
            "b1c3",
            "c8d7",
            "d3d4",
            "d7c6",
            "g2c6"
          ]
        },
        {
          "move": "f3f4",
          "depth": 16,
          "cp": 16,
          "mate": null,
          "inverted": true,
          "line": [
            "f3f4",
            "e8g8"
          ]
        },
        {
          "move": "d2d3",
          "depth": 16,
          "cp": 25,
          "mate": null,
          "inverted": true,
          "line": [
            "d2d3",
            "e6e5",
            "c2c4",
            "d5d4",
            "e3d4",
            "e5d4",
            "c1g5",
            "h7h6",
            "g5f6",
            "d8f6",
            "b1d2",
            "c8f5",
            "d2e4",
            "f6g6",
            "d1b3",
            "e8g8",
            "b3b7",
            "c6b4"
          ]
        }
      ],
      "engine": true,
      "fen": "r1bqk2r/pp3ppp/2nbpn2/2pp4/8/4PPP1/PPPPN1BP/RNBQ1RK1 w kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6"
        ]
      }
    },
    {
      "san": "h5",
      "uci": "h7h5",
      "ignore": false,
      "bestmoves": [
        {
          "move": "e8g8",
          "depth": 17,
          "cp": 135,
          "mate": null,
          "inverted": false,
          "line": [
            "e8g8",
            "b1c3",
            "c5d4",
            "e3d4",
            "c8d7",
            "c3b5",
            "d6b8",
            "b5c3",
            "h7h6",
            "b2b3",
            "f8e8",
            "c3a4",
            "e6e5",
            "a4c5",
            "e5d4",
            "c5d7",
            "d8d7",
            "f3f4"
          ]
        },
        {
          "move": "c5d4",
          "depth": 17,
          "cp": 110,
          "mate": null,
          "inverted": false,
          "line": [
            "c5d4",
            "e3d4",
            "c8d7",
            "c1g5",
            "e8g8",
            "c2c3",
            "a8c8",
            "b1d2",
            "e6e5",
            "d4e5",
            "d8b6",
            "g1h1",
            "c6e5",
            "g5f6",
            "g7f6",
            "d1b3",
            "e5d3",
            "b3b6"
          ]
        },
        {
          "move": "c8d7",
          "depth": 17,
          "cp": 98,
          "mate": null,
          "inverted": false,
          "line": [
            "c8d7",
            "c2c4"
          ]
        }
      ],
      "engine": true,
      "fen": "r1bqk2r/pp3ppp/2nbpn2/2pp4/3P4/4PPP1/PPP1N1BP/RNBQ1RK1 b kq d3",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4"
        ]
      }
    },
    {
      "san": "h4",
      "uci": "h2h4",
      "ignore": false,
      "bestmoves": [
        {
          "move": "h2h3",
          "depth": 16,
          "cp": 72,
          "mate": null,
          "inverted": true,
          "line": [
            "h2h3",
            "e8g8",
            "c2c4",
            "d5c4",
            "f3f4",
            "d6e7",
            "b1c3",
            "c5d4",
            "e3d4",
            "c8d7",
            "b2b3",
            "c4b3",
            "a2b3",
            "a7a6",
            "c1e3",
            "e7d6"
          ]
        },
        {
          "move": "h2h4",
          "depth": 16,
          "cp": 112,
          "mate": null,
          "inverted": true,
          "line": [
            "h2h4"
          ]
        },
        {
          "move": "c2c4",
          "depth": 15,
          "cp": 107,
          "mate": null,
          "inverted": true,
          "line": [
            "c2c4",
            "h5h4",
            "c4d5",
            "e6d5",
            "b1c3",
            "a7a6",
            "d4c5",
            "d6c5",
            "g3g4",
            "h4h3",
            "g2h1",
            "d8b6",
            "f1f2",
            "c5e3",
            "c1e3",
            "b6e3",
            "c3d5",
            "f6d5",
            "d1d5"
          ]
        }
      ],
      "engine": true,
      "fen": "r1bqk2r/pp3pp1/2nbpn2/2pp3p/3P4/4PPP1/PPP1N1BP/RNBQ1RK1 w kq h6",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5"
        ]
      }
    },
    {
      "san": "Qc7",
      "uci": "d8c7",
      "ignore": false,
      "bestmoves": [
        {
          "move": "e8g8",
          "depth": 17,
          "cp": 157,
          "mate": null,
          "inverted": false,
          "line": [
            "e8g8"
          ]
        },
        {
          "move": "d8c7",
          "depth": 16,
          "cp": 130,
          "mate": null,
          "inverted": false,
          "line": [
            "d8c7",
            "f3f4",
            "c5d4",
            "e2d4",
            "c6d4",
            "e3d4",
            "c8d7",
            "g2f3",
            "e8g8",
            "f1f2",
            "f6g4",
            "f3g4",
            "h5g4",
            "d1g4",
            "e6e5",
            "g4h5",
            "e5d4",
            "h5d5"
          ]
        },
        {
          "move": "c5d4",
          "depth": 16,
          "cp": 128,
          "mate": null,
          "inverted": false,
          "line": [
            "c5d4",
            "e3d4",
            "c6e7",
            "c1g5",
            "e7f5",
            "b1c3",
            "c8d7",
            "c3e4",
            "d7b5",
            "e4d6",
            "d8d6",
            "g5f4",
            "d6a6",
            "g1f2",
            "b5e2",
            "d1e2",
            "a6e2",
            "f2e2",
            "f5d4",
            "e2d3",
            "d4f5",
            "d3d2",
            "a8c8",
            "c2c3"
          ]
        }
      ],
      "engine": true,
      "fen": "r1bqk2r/pp3pp1/2nbpn2/2pp3p/3P3P/4PPP1/PPP1N1B1/RNBQ1RK1 b kq h3",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4"
        ]
      }
    },
    {
      "san": "Kh2",
      "uci": "g1h2",
      "ignore": false,
      "bestmoves": [
        {
          "move": "f3f4",
          "depth": 17,
          "cp": 83,
          "mate": null,
          "inverted": true,
          "line": [
            "f3f4"
          ]
        },
        {
          "move": "b1c3",
          "depth": 16,
          "cp": 135,
          "mate": null,
          "inverted": true,
          "line": [
            "b1c3",
            "a7a6",
            "g1h2",
            "e8g8",
            "a2a3",
            "c8d7",
            "c1d2",
            "b7b6",
            "f3f4",
            "f6g4",
            "h2g1",
            "a8c8",
            "g2f3",
            "c5d4",
            "e3d4",
            "c6e7",
            "f3g4",
            "h5g4"
          ]
        },
        {
          "move": "g1h2",
          "depth": 16,
          "cp": 137,
          "mate": null,
          "inverted": true,
          "line": [
            "g1h2",
            "a7a6",
            "b1c3",
            "e8g8",
            "a2a3",
            "f8d8",
            "c1d2",
            "c6e7",
            "d4c5",
            "d6c5",
            "e3e4",
            "e6e5",
            "e4d5",
            "f6d5",
            "c3e4",
            "d5e3"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2pp1/2nbpn2/2pp3p/3P3P/4PPP1/PPP1N1B1/RNBQ1RK1 w kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7"
        ]
      }
    },
    {
      "san": "g5",
      "uci": "g7g5",
      "ignore": false,
      "bestmoves": [
        {
          "move": "e8g8",
          "depth": 17,
          "cp": 199,
          "mate": null,
          "inverted": false,
          "line": [
            "e8g8"
          ]
        },
        {
          "move": "a7a6",
          "depth": 16,
          "cp": 181,
          "mate": null,
          "inverted": false,
          "line": [
            "a7a6",
            "b1c3",
            "e8g8",
            "d4c5",
            "d6c5",
            "e2f4",
            "f8d8",
            "c1d2",
            "c6e5",
            "f4d3",
            "e5c4",
            "d3c5",
            "c7c5",
            "d1c1",
            "e6e5",
            "e3e4",
            "d5e4",
            "d2g5",
            "e4f3",
            "f1f3"
          ]
        },
        {
          "move": "c7b8",
          "depth": 16,
          "cp": 141,
          "mate": null,
          "inverted": false,
          "line": [
            "c7b8",
            "b2b3",
            "b7b5",
            "c2c4",
            "c6e7",
            "g2h3",
            "b5c4",
            "b3c4",
            "e8g8",
            "d4c5",
            "d6c5",
            "c1a3",
            "c5a3",
            "b1a3",
            "f8d8",
            "a3b5",
            "c8b7"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2pp1/2nbpn2/2pp3p/3P3P/4PPP1/PPP1N1BK/RNBQ1R2 b kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7 9. Kh2",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7",
          "Kh2"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7",
          "g1h2"
        ]
      }
    },
    {
      "san": "hxg5",
      "uci": "h4g5",
      "ignore": false,
      "bestmoves": [
        {
          "move": "h4g5",
          "depth": 18,
          "cp": 84,
          "mate": null,
          "inverted": true,
          "line": [
            "h4g5",
            "h5h4",
            "h2g1",
            "f6h5",
            "f3f4",
            "h5g3",
            "e2g3",
            "h4g3",
            "b1c3",
            "a7a6",
            "c3e2",
            "c5d4",
            "e3d4",
            "c8d7",
            "e2g3",
            "e8c8",
            "c2c4",
            "d5c4",
            "g3e4",
            "d6e7"
          ]
        },
        {
          "move": "h2h1",
          "depth": 17,
          "cp": 169,
          "mate": null,
          "inverted": true,
          "line": [
            "h2h1",
            "d6g3",
            "h4g5",
            "h5h4",
            "f3f4",
            "f6g4",
            "d4c5",
            "g4h2",
            "c2c4",
            "e8f8",
            "c4d5",
            "e6d5",
            "b1c3",
            "h2f1",
            "c3d5",
            "c7d8",
            "d1f1",
            "c6e7",
            "d5f6",
            "h4h3",
            "g2f3",
            "e7f5"
          ]
        },
        {
          "move": "h2g1",
          "depth": 17,
          "cp": 187,
          "mate": null,
          "inverted": true,
          "line": [
            "h2g1",
            "g5h4",
            "g3h4",
            "h8g8",
            "b1c3",
            "a7a6",
            "g1h1",
            "c7e7",
            "d4c5",
            "d6c5",
            "e2f4",
            "e6e5",
            "f4h3",
            "c8e6",
            "h3g5",
            "e8c8",
            "d1e2",
            "d5d4",
            "c3a4",
            "c5a7",
            "g5e6",
            "e7e6",
            "c2c3"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2p2/2nbpn2/2pp2pp/3P3P/4PPP1/PPP1N1BK/RNBQ1R2 w kq g6",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7 9. Kh2 g5",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7",
          "Kh2",
          "g5"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7",
          "g1h2",
          "g7g5"
        ]
      }
    },
    {
      "san": "h4",
      "uci": "h5h4",
      "ignore": false,
      "bestmoves": [
        {
          "move": "h5h4",
          "depth": 18,
          "cp": 112,
          "mate": null,
          "inverted": false,
          "line": [
            "h5h4",
            "h2g1"
          ]
        },
        {
          "move": "d6g3",
          "depth": 17,
          "cp": 42,
          "mate": null,
          "inverted": false,
          "line": [
            "d6g3",
            "h2g1",
            "h5h4",
            "f3f4",
            "f6h5",
            "d4c5",
            "c7e7",
            "g2f3",
            "h5g7",
            "c2c4",
            "e7c5",
            "c4d5",
            "e6d5",
            "d1d5",
            "c5d5",
            "f3d5",
            "c8h3",
            "d5g2",
            "h3g4",
            "b1c3",
            "g7f5",
            "e2g3",
            "h4g3",
            "c3e4"
          ]
        },
        {
          "move": "f6d7",
          "depth": 17,
          "cp": -58,
          "mate": null,
          "inverted": false,
          "line": [
            "f6d7",
            "f1h1",
            "c5d4",
            "e3d4",
            "d6g3",
            "e2g3",
            "h5h4",
            "f3f4",
            "h4g3",
            "h2g3",
            "h8h1",
            "d1h1",
            "c6e7",
            "b1c3",
            "e7f5",
            "g3f2",
            "d7f8",
            "h1h8",
            "c8d7",
            "g2h3",
            "e8c8",
            "h3f5",
            "e6f5",
            "h8h3",
            "f8g6"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2p2/2nbpn2/2pp2Pp/3P4/4PPP1/PPP1N1BK/RNBQ1R2 b kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7 9. Kh2 g5 10. hxg5",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7",
          "Kh2",
          "g5",
          "hxg5"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7",
          "g1h2",
          "g7g5",
          "h4g5"
        ]
      }
    },
    {
      "san": "f4",
      "uci": "f3f4",
      "ignore": false,
      "bestmoves": [
        {
          "move": "h2g1",
          "depth": 18,
          "cp": 95,
          "mate": null,
          "inverted": true,
          "line": [
            "h2g1",
            "f6h5"
          ]
        },
        {
          "move": "f3f4",
          "depth": 17,
          "cp": 103,
          "mate": null,
          "inverted": true,
          "line": [
            "f3f4",
            "f6g4",
            "h2g1",
            "h4g3",
            "f1f3",
            "g4f2",
            "d1e1",
            "c5d4",
            "e3d4",
            "c6b4",
            "f3g3",
            "f2e4",
            "g2e4",
            "d5e4",
            "e1c3",
            "c8d7",
            "c3c7",
            "d6c7",
            "g3b3",
            "b4c2",
            "b3c3",
            "c2a1",
            "c3c7",
            "d7c6",
            "b1c3"
          ]
        },
        {
          "move": "f1h1",
          "depth": 17,
          "cp": 120,
          "mate": null,
          "inverted": true,
          "line": [
            "f1h1",
            "d6g3",
            "h2g1",
            "f6h5",
            "d4c5",
            "c7e7",
            "f3f4",
            "e6e5",
            "d1d5",
            "c8g4",
            "e2g3",
            "h5g3",
            "d5d6",
            "a8d8",
            "d6e7",
            "e8e7",
            "b1c3",
            "e5f4",
            "c3d5",
            "d8d5",
            "g2d5",
            "g3h1",
            "e3f4"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2p2/2nbpn2/2pp2P1/3P3p/4PPP1/PPP1N1BK/RNBQ1R2 w kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7 9. Kh2 g5 10. hxg5 h4",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7",
          "Kh2",
          "g5",
          "hxg5",
          "h4"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7",
          "g1h2",
          "g7g5",
          "h4g5",
          "h5h4"
        ]
      }
    },
    {
      "san": "hxg3+",
      "uci": "h4g3",
      "ignore": false,
      "bestmoves": [
        {
          "move": "f6g4",
          "depth": 17,
          "cp": 183,
          "mate": null,
          "inverted": false,
          "line": [
            "f6g4",
            "h2g1",
            "f7f5",
            "d1e1",
            "h4g3",
            "b1c3",
            "a7a6",
            "e1g3",
            "c5d4",
            "e3d4",
            "c7g7",
            "c1e3",
            "c8d7",
            "g2h3",
            "g7h7",
            "g1g2",
            "h7h3",
            "g3h3",
            "h8h3",
            "g2h3"
          ]
        },
        {
          "move": "h4g3",
          "depth": 17,
          "cp": 59,
          "mate": null,
          "inverted": false,
          "line": [
            "h4g3",
            "h2g3",
            "h8g8",
            "g3f3",
            "c5d4",
            "e3d4",
            "f6e4",
            "b1c3",
            "e4c3",
            "e2c3",
            "c7b6",
            "c3e2",
            "c6e7",
            "f3f2",
            "c8d7",
            "f1h1",
            "e8c8",
            "h1h7",
            "e7f5",
            "h7f7",
            "c8b8",
            "e2g3",
            "f5d4"
          ]
        },
        {
          "move": "f6e4",
          "depth": 17,
          "cp": -54,
          "mate": null,
          "inverted": false,
          "line": [
            "f6e4",
            "g2e4"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2p2/2nbpn2/2pp2P1/3P1P1p/4P1P1/PPP1N1BK/RNBQ1R2 b kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7 9. Kh2 g5 10. hxg5 h4 11. f4",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7",
          "Kh2",
          "g5",
          "hxg5",
          "h4",
          "f4"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7",
          "g1h2",
          "g7g5",
          "h4g5",
          "h5h4",
          "f3f4"
        ]
      }
    },
    {
      "san": "Kxg3",
      "uci": "h2g3",
      "ignore": false,
      "bestmoves": [
        {
          "move": "h2g3",
          "depth": 19,
          "cp": 20,
          "mate": null,
          "inverted": true,
          "line": [
            "h2g3",
            "h8g8",
            "g3f2",
            "f6g4",
            "f2e1",
            "f7f5",
            "b1c3",
            "c8d7",
            "c3b5",
            "c7a5",
            "e2c3",
            "d6e7",
            "c1d2",
            "a5b6",
            "a2a4",
            "c5d4",
            "b5d4",
            "c6d4",
            "e3d4",
            "e8c8",
            "g2f3",
            "g4h2",
            "f1h1",
            "h2f3",
            "d1f3"
          ]
        },
        {
          "move": "h2g1",
          "depth": 19,
          "cp": 111,
          "mate": null,
          "inverted": true,
          "line": [
            "h2g1"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2p2/2nbpn2/2pp2P1/3P1P2/4P1p1/PPP1N1BK/RNBQ1R2 w kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7 9. Kh2 g5 10. hxg5 h4 11. f4 hxg3+",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7",
          "Kh2",
          "g5",
          "hxg5",
          "h4",
          "f4",
          "hxg3+"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7",
          "g1h2",
          "g7g5",
          "h4g5",
          "h5h4",
          "f3f4",
          "h4g3"
        ]
      }
    },
    {
      "san": "Nh5+",
      "uci": "f6h5",
      "ignore": false,
      "bestmoves": [
        {
          "move": "h8g8",
          "depth": 18,
          "cp": 75,
          "mate": null,
          "inverted": false,
          "line": [
            "h8g8",
            "g3f2",
            "f6g4",
            "f2e1",
            "f7f5",
            "b1c3",
            "c8d7",
            "c3b5",
            "c7a5",
            "e2c3",
            "d6e7",
            "d4c5",
            "e7c5",
            "a2a3",
            "e8c8",
            "b5d4",
            "c6d4",
            "e3d4",
            "c5d6",
            "d1d2",
            "c8b8",
            "b2b3",
            "a5c7",
            "g2f3",
            "a7a6",
            "f1h1"
          ]
        },
        {
          "move": "f6h5",
          "depth": 17,
          "cp": 33,
          "mate": null,
          "inverted": false,
          "line": [
            "f6h5",
            "g3f2",
            "c8d7",
            "f1h1",
            "e8c8",
            "b1a3",
            "a7a6",
            "c2c3",
            "h5g7",
            "e3e4",
            "c5d4",
            "c3d4",
            "d5e4",
            "g2e4",
            "g7f5",
            "a3c4",
            "c8b8",
            "e4f5",
            "e6f5",
            "c4d6",
            "h8h1",
            "d1h1",
            "c7d6"
          ]
        },
        {
          "move": "f6d7",
          "depth": 17,
          "cp": -57,
          "mate": null,
          "inverted": false,
          "line": [
            "f6d7",
            "b1c3",
            "a7a6",
            "f1h1",
            "h8h1",
            "d1h1",
            "c5d4",
            "h1h8",
            "d7f8",
            "e2d4",
            "c8d7",
            "d4f3",
            "e8c8",
            "h8f6",
            "d7e8",
            "g3f2",
            "c8b8",
            "c1d2",
            "c6e7",
            "a1h1",
            "e7f5",
            "c3e2"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2p2/2nbpn2/2pp2P1/3P1P2/4P1K1/PPP1N1B1/RNBQ1R2 b kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7 9. Kh2 g5 10. hxg5 h4 11. f4 hxg3+ 12. Kxg3",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7",
          "Kh2",
          "g5",
          "hxg5",
          "h4",
          "f4",
          "hxg3+",
          "Kxg3"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7",
          "g1h2",
          "g7g5",
          "h4g5",
          "h5h4",
          "f3f4",
          "h4g3",
          "h2g3"
        ]
      }
    },
    {
      "san": "Kf2",
      "uci": "g3f2",
      "ignore": false,
      "bestmoves": [
        {
          "move": "g3f2",
          "depth": 18,
          "cp": -2,
          "mate": null,
          "inverted": true,
          "line": [
            "g3f2",
            "c8d7",
            "f1h1",
            "e8c8",
            "b1a3",
            "a7a6",
            "c2c3",
            "c8b8",
            "a3c2",
            "h5g7",
            "d4c5",
            "d6c5",
            "b2b4",
            "c5d6",
            "a2a4",
            "g7f5",
            "h1h8",
            "d8h8",
            "b4b5",
            "c6a5",
            "b5a6",
            "h8h2",
            "f2g1"
          ]
        },
        {
          "move": "g3f3",
          "depth": 18,
          "cp": 187,
          "mate": null,
          "inverted": true,
          "line": [
            "g3f3",
            "c5d4",
            "e3d4",
            "c8d7",
            "d1d2",
            "e8c8",
            "b1c3",
            "c6e7",
            "f3f2",
            "e7g6",
            "f2g1",
            "h5g7",
            "a2a4",
            "a7a6",
            "e2g3",
            "h8h4",
            "c3e2",
            "d8h8",
            "d2c3",
            "d7c6",
            "c1d2",
            "c8b8",
            "c3b3",
            "h4h2",
            "b3c3",
            "h2g2",
            "g1g2"
          ]
        },
        {
          "move": "g3g4",
          "depth": 18,
          "cp": 410,
          "mate": null,
          "inverted": true,
          "line": [
            "g3g4"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2p2/2nbp3/2pp2Pn/3P1P2/4P1K1/PPP1N1B1/RNBQ1R2 w kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7 9. Kh2 g5 10. hxg5 h4 11. f4 hxg3+ 12. Kxg3 Nh5+",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7",
          "Kh2",
          "g5",
          "hxg5",
          "h4",
          "f4",
          "hxg3+",
          "Kxg3",
          "Nh5+"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7",
          "g1h2",
          "g7g5",
          "h4g5",
          "h5h4",
          "f3f4",
          "h4g3",
          "h2g3",
          "f6h5"
        ]
      }
    },
    {
      "san": "cxd4",
      "uci": "c5d4",
      "ignore": false,
      "bestmoves": [
        {
          "move": "c8d7",
          "depth": 18,
          "cp": 41,
          "mate": null,
          "inverted": false,
          "line": [
            "c8d7",
            "b1a3",
            "a7a6",
            "c2c3",
            "e8c8",
            "f1h1",
            "c8b8",
            "a1b1",
            "c5d4",
            "c3d4",
            "h5g7",
            "c1d2",
            "h8h1",
            "d1h1",
            "c6b4",
            "d2b4",
            "d6b4",
            "h1c1",
            "d7c6",
            "a3c2",
            "b4d6",
            "c2e1",
            "c7a5",
            "b1a1",
            "g7f5",
            "e1d3",
            "d8h8"
          ]
        },
        {
          "move": "c5d4",
          "depth": 18,
          "cp": -62,
          "mate": null,
          "inverted": false,
          "line": [
            "c5d4",
            "f1h1"
          ]
        },
        {
          "move": "h5g7",
          "depth": 17,
          "cp": -90,
          "mate": null,
          "inverted": false,
          "line": [
            "h5g7",
            "b1c3",
            "a7a6",
            "d4c5",
            "d6c5",
            "f1h1",
            "h8h1",
            "d1h1",
            "c8d7",
            "h1h8",
            "c5f8",
            "g2d5",
            "e8c8",
            "d5e4",
            "c6e7",
            "h8h7",
            "c8b8",
            "c1d2",
            "e6e5",
            "a1g1",
            "e5f4",
            "e2f4"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2p2/2nbp3/2pp2Pn/3P1P2/4P3/PPP1NKB1/RNBQ1R2 b kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7 9. Kh2 g5 10. hxg5 h4 11. f4 hxg3+ 12. Kxg3 Nh5+ 13. Kf2",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7",
          "Kh2",
          "g5",
          "hxg5",
          "h4",
          "f4",
          "hxg3+",
          "Kxg3",
          "Nh5+",
          "Kf2"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7",
          "g1h2",
          "g7g5",
          "h4g5",
          "h5h4",
          "f3f4",
          "h4g3",
          "h2g3",
          "f6h5",
          "g3f2"
        ]
      }
    },
    {
      "san": "Nxd4",
      "uci": "e2d4",
      "ignore": false,
      "bestmoves": [
        {
          "move": "f1h1",
          "depth": 19,
          "cp": -26,
          "mate": null,
          "inverted": true,
          "line": [
            "f1h1",
            "c8d7"
          ]
        },
        {
          "move": "e2d4",
          "depth": 18,
          "cp": 1,
          "mate": null,
          "inverted": true,
          "line": [
            "e2d4",
            "c6d4",
            "d1d4",
            "h8g8",
            "d4d1",
            "h5g7",
            "c2c4",
            "c7c4",
            "b1d2",
            "c4c7",
            "d2f3",
            "c8d7",
            "f3d4",
            "d6c5",
            "d1c2",
            "g7f5",
            "c2c3",
            "f5d4",
            "e3d4",
            "c5d6",
            "c3c7",
            "d6c7",
            "f1h1"
          ]
        },
        {
          "move": "b1a3",
          "depth": 18,
          "cp": 102,
          "mate": null,
          "inverted": true,
          "line": [
            "b1a3",
            "d4e3",
            "c1e3",
            "d6f4",
            "e2f4",
            "h5f4",
            "a3b5",
            "c7e5",
            "e3f4",
            "e5f4",
            "d1f3",
            "f4f3",
            "f2f3",
            "e8e7",
            "a1e1",
            "c8d7",
            "b5c7",
            "c6d4",
            "f3f2",
            "d4c2",
            "e1e2",
            "c2d4",
            "c7d5",
            "e7d6",
            "e2d2",
            "e6d5",
            "d2d4",
            "d7e6",
            "f1h1",
            "h8h1",
            "g2h1"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2p2/2nbp3/3p2Pn/3p1P2/4P3/PPP1NKB1/RNBQ1R2 w kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7 9. Kh2 g5 10. hxg5 h4 11. f4 hxg3+ 12. Kxg3 Nh5+ 13. Kf2 cxd4",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7",
          "Kh2",
          "g5",
          "hxg5",
          "h4",
          "f4",
          "hxg3+",
          "Kxg3",
          "Nh5+",
          "Kf2",
          "cxd4"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7",
          "g1h2",
          "g7g5",
          "h4g5",
          "h5h4",
          "f3f4",
          "h4g3",
          "h2g3",
          "f6h5",
          "g3f2",
          "c5d4"
        ]
      }
    },
    {
      "san": "Nxd4",
      "uci": "c6d4",
      "ignore": false,
      "bestmoves": [
        {
          "move": "c6d4",
          "depth": 19,
          "cp": 35,
          "mate": null,
          "inverted": false,
          "line": [
            "c6d4",
            "d1d4"
          ]
        },
        {
          "move": "d6f4",
          "depth": 18,
          "cp": -138,
          "mate": null,
          "inverted": false,
          "line": [
            "d6f4",
            "e3f4",
            "h5f4",
            "f1h1",
            "h8h1",
            "d1h1",
            "f4g6",
            "d4c6",
            "b7c6",
            "h1h3",
            "a8b8",
            "h3g3",
            "e6e5",
            "b2b3",
            "g6f4",
            "c1e3",
            "c8f5",
            "b1d2",
            "f4g2",
            "f2g2",
            "f5c2",
            "g3h4",
            "c2f5",
            "g2f2"
          ]
        },
        {
          "move": "h5g7",
          "depth": 18,
          "cp": -182,
          "mate": null,
          "inverted": false,
          "line": [
            "h5g7",
            "d4b5",
            "c7b8",
            "f1h1",
            "h8h1",
            "b5d6",
            "b8d6",
            "d1h1",
            "g7f5",
            "c1d2",
            "c8d7",
            "h1h8",
            "d6f8",
            "h8f8",
            "e8f8",
            "b1a3",
            "f8e7",
            "a1h1",
            "a8g8",
            "d2c3",
            "f5d6",
            "c3f6",
            "e7e8",
            "c2c3",
            "b7b6",
            "h1h7",
            "c6e7",
            "a3c2",
            "d6e4",
            "g2e4",
            "d5e4"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2p2/2nbp3/3p2Pn/3N1P2/4P3/PPP2KB1/RNBQ1R2 b kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7 9. Kh2 g5 10. hxg5 h4 11. f4 hxg3+ 12. Kxg3 Nh5+ 13. Kf2 cxd4 14. Nxd4",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7",
          "Kh2",
          "g5",
          "hxg5",
          "h4",
          "f4",
          "hxg3+",
          "Kxg3",
          "Nh5+",
          "Kf2",
          "cxd4",
          "Nxd4"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7",
          "g1h2",
          "g7g5",
          "h4g5",
          "h5h4",
          "f3f4",
          "h4g3",
          "h2g3",
          "f6h5",
          "g3f2",
          "c5d4",
          "e2d4"
        ]
      }
    },
    {
      "san": "Qxd4",
      "uci": "d1d4",
      "ignore": false,
      "bestmoves": [
        {
          "move": "d1d4",
          "depth": 18,
          "cp": 24,
          "mate": null,
          "inverted": true,
          "line": [
            "d1d4",
            "h8g8",
            "d4d1",
            "h5g7",
            "b1c3",
            "c8d7",
            "c3e2",
            "d7b5",
            "a2a4",
            "b5e2",
            "d1e2",
            "g7f5",
            "a4a5",
            "f7f6",
            "g2h3",
            "f6g5",
            "h3f5",
            "e6f5",
            "e2b5",
            "c7c6",
            "b5c6",
            "b7c6",
            "c1d2",
            "e8c8",
            "a5a6",
            "g5f4"
          ]
        },
        {
          "move": "e3d4",
          "depth": 18,
          "cp": 322,
          "mate": null,
          "inverted": true,
          "line": [
            "e3d4",
            "h5f4"
          ]
        },
        {
          "move": "b1c3",
          "depth": 17,
          "cp": 329,
          "mate": null,
          "inverted": true,
          "line": [
            "b1c3",
            "h5f4",
            "e3f4",
            "d6c5",
            "f2e1",
            "h8h2",
            "d1d2",
            "c8d7",
            "f1h1",
            "h2h1",
            "g2h1",
            "e8c8",
            "c3e2",
            "d8h8",
            "h1g2",
            "d4f5",
            "b2b4",
            "c5b6",
            "d2c3",
            "c7c3",
            "e2c3",
            "h8h2",
            "c3d5",
            "e6d5",
            "g2d5"
          ]
        }
      ],
      "engine": true,
      "fen": "r1b1k2r/ppq2p2/3bp3/3p2Pn/3n1P2/4P3/PPP2KB1/RNBQ1R2 w kq -",
      "line": {
        "pgn": "1. f3 d5 2. e3 c5 3. Ne2 Nc6 4. g3 Nf6 5. Bg2 e6 6. O-O Bd6 7. d4 h5 8. h4 Qc7 9. Kh2 g5 10. hxg5 h4 11. f4 hxg3+ 12. Kxg3 Nh5+ 13. Kf2 cxd4 14. Nxd4 Nxd4",
        "san": [
          "f3",
          "d5",
          "e3",
          "c5",
          "Ne2",
          "Nc6",
          "g3",
          "Nf6",
          "Bg2",
          "e6",
          "O-O",
          "Bd6",
          "d4",
          "h5",
          "h4",
          "Qc7",
          "Kh2",
          "g5",
          "hxg5",
          "h4",
          "f4",
          "hxg3+",
          "Kxg3",
          "Nh5+",
          "Kf2",
          "cxd4",
          "Nxd4",
          "Nxd4"
        ],
        "uci": [
          "f2f3",
          "d7d5",
          "e2e3",
          "c7c5",
          "g1e2",
          "b8c6",
          "g2g3",
          "g8f6",
          "f1g2",
          "e7e6",
          "e1g1",
          "f8d6",
          "d2d4",
          "h7h5",
          "h2h4",
          "d8c7",
          "g1h2",
          "g7g5",
          "h4g5",
          "h5h4",
          "f3f4",
          "h4g3",
          "h2g3",
          "f6h5",
          "g3f2",
          "c5d4",
          "e2d4",
          "c6d4"
        ]
      }
    }
  ],
  "site": "Chess.com",
  "username": "avweije",
  "year": 2025,
  "month": 3,
  "type": "Blitz"
}';

    return ["game" => json_decode($json2, true)];
  }

  private function getJsonTestData()
  {

    $json = '{
  "game": {
    "uuid": "8d55da34-ffd7-11ef-8008-6cfe544c0428",
    "color": "black",
    "opponent": "bcausey21",
    "result": "0-1",
    "fen": null,
    "link": "https://www.chess.com/game/live/135587372485",
    "evaluations": 3,
    "engine": 26,
    "moves": [
      {
        "san": "e3",
        "uci": "e2e3",
        "ignore": false,
        "bestmoves": [
          {
            "depth": 64,
            "cp": 19,
            "mate": null,
            "move": "g1f3",
            "san": "Nf3",
            "line": [
              "g1f3",
              "d7d5",
              "d2d4",
              "e7e6",
              "c2c4",
              "g8f6",
              "b1c3",
              "f8b4",
              "c4d5",
              "e6d5"
            ]
          },
          {
            "depth": 64,
            "cp": 18,
            "mate": null,
            "move": "e2e4",
            "san": "e4",
            "line": [
              "e2e4",
              "e7e5",
              "g1f3",
              "b8c6",
              "f1b5",
              "g8f6",
              "e1h1",
              "f6e4",
              "f1e1",
              "e4d6"
            ]
          },
          {
            "depth": 63,
            "cp": 19,
            "mate": null,
            "move": "d2d4",
            "san": "d4",
            "line": [
              "d2d4",
              "g8f6",
              "c2c4",
              "e7e6",
              "g1f3",
              "d7d5",
              "b1c3",
              "f8b4",
              "c4d5",
              "e6d5"
            ]
          }
        ],
        "engine": false,
        "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
        "line": {
          "pgn": "",
          "san": [],
          "uci": []
        }
      },
      {
        "san": "d5",
        "uci": "d7d5",
        "ignore": false,
        "bestmoves": [
          {
            "depth": 50,
            "cp": 3,
            "mate": null,
            "move": "g8f6",
            "san": "Nf6",
            "line": [
              "g8f6",
              "d2d4",
              "d7d5",
              "c2c4",
              "e7e6",
              "g1f3",
              "f8e7",
              "b1c3",
              "e8h8",
              "b2b3"
            ]
          },
          {
            "depth": 50,
            "cp": 5,
            "mate": null,
            "move": "d7d5",
            "san": "d5",
            "line": [
              "d7d5",
              "g1f3",
              "c7c5",
              "b2b3",
              "g8f6",
              "c1b2",
              "e7e6",
              "d2d4",
              "c5d4",
              "e3d4"
            ]
          },
          {
            "depth": 50,
            "cp": 6,
            "mate": null,
            "move": "b7b6",
            "san": "b6",
            "line": [
              "b7b6",
              "g1f3",
              "c8b7",
              "b2b3",
              "g8f6",
              "c2c4",
              "e7e6",
              "c1b2",
              "f8e7",
              "d2d4"
            ]
          },
          {
            "depth": 50,
            "cp": 8,
            "mate": null,
            "move": "c7c5",
            "san": "c5",
            "line": [
              "c7c5",
              "c2c4",
              "g8f6",
              "b1c3",
              "d7d5",
              "c4d5",
              "f6d5",
              "g1f3",
              "e7e6",
              "c3d5"
            ]
          },
          {
            "depth": 50,
            "cp": 9,
            "mate": null,
            "move": "e7e6",
            "san": "e6",
            "line": [
              "e7e6",
              "d2d4",
              "g8f6",
              "g1f3",
              "d7d5",
              "b2b3",
              "c7c5",
              "f1d3",
              "b7b6",
              "e1h1"
            ]
          }
        ],
        "engine": false,
        "fen": "rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR b KQkq -",
        "line": {
          "pgn": "1. e3",
          "san": [
            "e3"
          ],
          "uci": [
            "e2e3"
          ]
        }
      },
      {
        "san": "f3",
        "uci": "f2f3",
        "ignore": false,
        "bestmoves": [
          {
            "depth": 38,
            "cp": 10,
            "mate": null,
            "move": "d2d4",
            "san": "d4",
            "line": [
              "d2d4",
              "g8f6",
              "g1f3",
              "e7e6",
              "f1d3",
              "b7b6",
              "e1h1",
              "f8d6",
              "b2b3",
              "c8b7"
            ]
          },
          {
            "depth": 35,
            "cp": 10,
            "mate": null,
            "move": "d2d4",
            "san": "d4",
            "line": [
              "d2d4",
              "g8f6",
              "g1f3",
              "e7e6",
              "b1d2",
              "f8e7",
              "f1d3",
              "b8d7",
              "e1h1",
              "e8h8"
            ]
          },
          {
            "depth": 35,
            "cp": 9,
            "mate": null,
            "move": "g1f3",
            "san": "Nf3",
            "line": [
              "g1f3",
              "e7e6",
              "d2d4",
              "g8f6",
              "b1d2",
              "f8e7",
              "f1d3",
              "c7c5",
              "b2b3",
              "b7b6"
            ]
          }
        ],
        "engine": false,
        "fen": "rnbqkbnr/ppp1pppp/8/3p4/8/4P3/PPPP1PPP/RNBQKBNR w KQkq d6",
        "line": {
          "pgn": "1. e3 d5",
          "san": [
            "e3",
            "d5"
          ],
          "uci": [
            "e2e3",
            "d7d5"
          ]
        }
      },
      {
        "san": "c5",
        "uci": "c7c5",
        "ignore": false,
        "bestmoves": [
          {
            "move": "d2d4",
            "depth": 11,
            "cp": -82,
            "mate": null,
            "inverted": false,
            "line": [
              "d2d4",
              "e7e6"
            ]
          },
          {
            "move": "f3f4",
            "depth": 10,
            "cp": -67,
            "mate": null,
            "inverted": false,
            "line": [
              "f3f4",
              "c8f5",
              "f1d3",
              "g8h6",
              "g1f3",
              "b8d7",
              "e1g1",
              "e7e6",
              "b1c3",
              "a7a6",
              "d3e2"
            ]
          },
          {
            "move": "f1b5",
            "depth": 10,
            "cp": -68,
            "mate": null,
            "inverted": false,
            "line": [
              "f1b5",
              "b8d7",
              "d2d4",
              "a7a6",
              "b5d7",
              "c8d7",
              "g1e2",
              "e7e6",
              "b1c3",
              "g8f6",
              "e1g1",
              "f8d6"
            ]
          }
        ],
        "engine": true,
        "fen": "rnbqkbnr/ppp1pppp/8/3p4/8/4PP2/PPPP2PP/RNBQKBNR b KQkq -",
        "line": {
          "pgn": "1. e3 d5 2. f3",
          "san": [
            "e3",
            "d5",
            "f3"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3"
          ]
        }
      },
      {
        "san": "Kf2",
        "uci": "e1f2",
        "ignore": false,
        "bestmoves": [
          {
            "move": "e7e5",
            "depth": 12,
            "cp": -155,
            "mate": null,
            "inverted": true,
            "line": [
              "e7e5",
              "d2d4"
            ]
          },
          {
            "move": "d5d4",
            "depth": 11,
            "cp": -157,
            "mate": null,
            "inverted": true,
            "line": [
              "d5d4",
              "h2h4",
              "e7e5",
              "f1b5",
              "c8d7",
              "b5d7",
              "b8d7",
              "e3d4",
              "c5d4",
              "d2d3",
              "g8f6",
              "b1d2",
              "f6d5",
              "d2e4"
            ]
          },
          {
            "move": "b8c6",
            "depth": 11,
            "cp": -147,
            "mate": null,
            "inverted": true,
            "line": [
              "b8c6",
              "d2d4",
              "c5d4",
              "e3d4",
              "e7e5",
              "f1b5",
              "a7a6",
              "b5c6",
              "b7c6",
              "g1e2",
              "e5e4",
              "e2c3",
              "g8f6",
              "c1f4"
            ]
          }
        ],
        "engine": true,
        "fen": "rnbqkbnr/pp2pppp/8/2pp4/8/4PP2/PPPP2PP/RNBQKBNR w KQkq c6",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5"
          ]
        }
      },
      {
        "san": "e5",
        "uci": "e7e5",
        "ignore": false,
        "bestmoves": [
          {
            "move": "d2d4",
            "depth": 11,
            "cp": -122,
            "mate": null,
            "inverted": false,
            "line": [
              "d2d4",
              "c5d4",
              "e3d4",
              "b8c6",
              "f1b5",
              "a7a6",
              "b5c6",
              "b7c6",
              "g1e2",
              "e5e4",
              "f3e4",
              "d8h4",
              "f2g1",
              "d5e4",
              "b1c3"
            ]
          },
          {
            "move": "f1b5",
            "depth": 11,
            "cp": -124,
            "mate": null,
            "inverted": false,
            "line": [
              "f1b5",
              "c8d7",
              "b5d7",
              "b8d7",
              "g1e2",
              "f8d6",
              "d2d3",
              "g8f6",
              "c2c4",
              "d5d4",
              "d1b3",
              "b7b6",
              "e3d4",
              "c5d4"
            ]
          },
          {
            "move": "h2h4",
            "depth": 11,
            "cp": -146,
            "mate": null,
            "inverted": false,
            "line": [
              "h2h4"
            ]
          }
        ],
        "engine": true,
        "fen": "rnbqkbnr/pp2pppp/8/2pp4/8/4PP2/PPPP1KPP/RNBQ1BNR b kq -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2"
          ]
        }
      },
      {
        "san": "Ne2",
        "uci": "g1e2",
        "ignore": false,
        "bestmoves": [
          {
            "move": "d5d4",
            "depth": 11,
            "cp": -202,
            "mate": null,
            "inverted": true,
            "line": [
              "d5d4",
              "h2h4",
              "f8e7",
              "d2d3",
              "b8c6",
              "e3d4",
              "c5d4",
              "b1d2",
              "g8f6",
              "e2g3",
              "e8g8",
              "d2e4",
              "f6e4",
              "g3e4"
            ]
          },
          {
            "move": "b8c6",
            "depth": 11,
            "cp": -194,
            "mate": null,
            "inverted": true,
            "line": [
              "b8c6",
              "d2d4",
              "f8d6",
              "d4e5",
              "d6e5",
              "g2g3",
              "g8e7",
              "f1g2",
              "e5f6",
              "b1d2",
              "e8g8",
              "f3f4"
            ]
          },
          {
            "move": "f8d6",
            "depth": 11,
            "cp": -185,
            "mate": null,
            "inverted": true,
            "line": [
              "f8d6"
            ]
          }
        ],
        "engine": true,
        "fen": "rnbqkbnr/pp3ppp/8/2ppp3/8/4PP2/PPPP1KPP/RNBQ1BNR w kq e6",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5"
          ]
        }
      },
      {
        "san": "f5",
        "uci": "f7f5",
        "ignore": false,
        "bestmoves": [
          {
            "move": "d2d4",
            "depth": 12,
            "cp": -58,
            "mate": null,
            "inverted": false,
            "line": [
              "d2d4",
              "c5d4",
              "e3d4",
              "b8c6",
              "g2g3",
              "f8d6",
              "b1c3",
              "g8e7",
              "f2g2",
              "e8g8",
              "d4e5",
              "c6e5",
              "c3d5",
              "d6c5"
            ]
          },
          {
            "move": "d2d3",
            "depth": 11,
            "cp": -136,
            "mate": null,
            "inverted": false,
            "line": [
              "d2d3",
              "g8f6",
              "d3d4",
              "c5d4",
              "e3d4",
              "b8c6",
              "g2g3",
              "f8e7",
              "f1g2",
              "e8g8",
              "b1c3",
              "e5e4"
            ]
          },
          {
            "move": "h2h4",
            "depth": 11,
            "cp": -154,
            "mate": null,
            "inverted": false,
            "line": [
              "h2h4",
              "d5d4",
              "d2d3",
              "b8c6",
              "c2c3",
              "d4e3",
              "c1e3",
              "g8f6",
              "b1d2",
              "f6d5",
              "d2c4",
              "f8e7",
              "g2g3",
              "e8g8"
            ]
          }
        ],
        "engine": true,
        "fen": "rnbqkbnr/pp3ppp/8/2ppp3/8/4PP2/PPPPNKPP/RNBQ1B1R b kq -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2"
          ]
        }
      },
      {
        "san": "g3",
        "uci": "g2g3",
        "ignore": false,
        "bestmoves": [
          {
            "move": "d5d4",
            "depth": 12,
            "cp": -218,
            "mate": null,
            "inverted": true,
            "line": [
              "d5d4",
              "d2d3",
              "g8f6",
              "c2c3",
              "b8c6",
              "d1b3",
              "d4e3",
              "c1e3",
              "f5f4",
              "e3d2",
              "a7a6",
              "h2h4",
              "f8e7",
              "g3f4",
              "d8d3"
            ]
          },
          {
            "move": "f8d6",
            "depth": 11,
            "cp": -158,
            "mate": null,
            "inverted": true,
            "line": [
              "f8d6",
              "d2d4",
              "g8f6",
              "b1c3",
              "e8g8",
              "c3b5",
              "b8c6",
              "b5d6",
              "d8d6",
              "h2h4",
              "b7b6",
              "d4e5",
              "c6e5",
              "e2f4",
              "c8b7",
              "f1b5",
              "d6e7"
            ]
          },
          {
            "move": "g8f6",
            "depth": 11,
            "cp": -153,
            "mate": null,
            "inverted": true,
            "line": [
              "g8f6",
              "d2d4",
              "f8d6",
              "b1c3",
              "e8g8",
              "c3b5",
              "b8c6",
              "b5d6",
              "d8d6",
              "h2h4",
              "f8f7",
              "c2c3",
              "c5d4",
              "c3d4"
            ]
          }
        ],
        "engine": true,
        "fen": "rnbqkbnr/pp4pp/8/2pppp2/8/4PP2/PPPPNKPP/RNBQ1B1R w kq f6",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5"
          ]
        }
      },
      {
        "san": "Nf6",
        "uci": "g8f6",
        "ignore": false,
        "bestmoves": [
          {
            "move": "d2d4",
            "depth": 12,
            "cp": -107,
            "mate": null,
            "inverted": false,
            "line": [
              "d2d4",
              "e5e4",
              "h2h4",
              "f8d6",
              "e2f4",
              "d6f4",
              "g3f4",
              "c5d4",
              "e3d4",
              "e8g8",
              "b1c3",
              "b8c6",
              "c1e3",
              "e4f3",
              "d1f3",
              "f6g4",
              "f2g1"
            ]
          },
          {
            "move": "c2c3",
            "depth": 12,
            "cp": -171,
            "mate": null,
            "inverted": false,
            "line": [
              "c2c3"
            ]
          },
          {
            "move": "d2d3",
            "depth": 11,
            "cp": -218,
            "mate": null,
            "inverted": false,
            "line": [
              "d2d3",
              "d5d4",
              "c2c3",
              "b8c6",
              "d1b3",
              "d4e3",
              "c1e3",
              "f5f4",
              "e3d2",
              "a7a6",
              "h2h4",
              "f8e7",
              "g3f4"
            ]
          }
        ],
        "engine": true,
        "fen": "rnbqkbnr/pp4pp/8/2pppp2/8/4PPP1/PPPPNK1P/RNBQ1B1R b kq -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3"
          ]
        }
      },
      {
        "san": "d3",
        "uci": "d2d3",
        "ignore": false,
        "bestmoves": [
          {
            "move": "d5d4",
            "depth": 12,
            "cp": -240,
            "mate": null,
            "inverted": true,
            "line": [
              "d5d4",
              "f1g2",
              "b8c6",
              "c2c3",
              "c8e6",
              "h2h4",
              "f8e7",
              "e3d4",
              "c5d4",
              "c3d4",
              "c6d4",
              "c1e3",
              "e7c5"
            ]
          },
          {
            "move": "b8c6",
            "depth": 11,
            "cp": -237,
            "mate": null,
            "inverted": true,
            "line": [
              "b8c6",
              "d3d4"
            ]
          },
          {
            "move": "f8e7",
            "depth": 11,
            "cp": -211,
            "mate": null,
            "inverted": true,
            "line": [
              "f8e7",
              "d3d4",
              "e5e4",
              "b1d2",
              "b8c6",
              "f2g2",
              "c5d4",
              "e2d4",
              "c6d4",
              "e3d4",
              "e4e3",
              "f1b5",
              "e8f7"
            ]
          }
        ],
        "engine": true,
        "fen": "rnbqkb1r/pp4pp/5n2/2pppp2/8/4PPP1/PPPPNK1P/RNBQ1B1R w kq -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6"
          ]
        }
      },
      {
        "san": "Nc6",
        "uci": "b8c6",
        "ignore": false,
        "bestmoves": [
          {
            "move": "d3d4",
            "depth": 13,
            "cp": -155,
            "mate": null,
            "inverted": false,
            "line": [
              "d3d4",
              "f8d6",
              "d4e5",
              "d6e5",
              "e2f4",
              "e5f4",
              "e3f4",
              "c8e6",
              "f1b5",
              "e8g8",
              "f2g2",
              "d5d4"
            ]
          },
          {
            "move": "f1g2",
            "depth": 12,
            "cp": -156,
            "mate": null,
            "inverted": false,
            "line": [
              "f1g2",
              "f8e7",
              "d3d4",
              "e8g8",
              "d4e5",
              "c6e5",
              "h1e1",
              "c8e6",
              "f2g1",
              "e6f7",
              "b1c3",
              "f8e8",
              "f3f4"
            ]
          },
          {
            "move": "h2h4",
            "depth": 12,
            "cp": -196,
            "mate": null,
            "inverted": false,
            "line": [
              "h2h4",
              "f8d6",
              "f1g2",
              "e8g8",
              "d3d4",
              "e5e4",
              "b1c3",
              "c8e6",
              "f2g1",
              "f6h5",
              "f3f4",
              "a8b8",
              "d4c5",
              "d6c5",
              "c3a4"
            ]
          }
        ],
        "engine": true,
        "fen": "rnbqkb1r/pp4pp/5n2/2pppp2/8/3PPPP1/PPP1NK1P/RNBQ1B1R b kq -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3"
          ]
        }
      },
      {
        "san": "Kg2",
        "uci": "f2g2",
        "ignore": false,
        "bestmoves": [
          {
            "move": "d5d4",
            "depth": 12,
            "cp": -240,
            "mate": null,
            "inverted": true,
            "line": [
              "d5d4",
              "h2h4",
              "c8e6",
              "e3d4",
              "c5d4",
              "c2c3",
              "d4c3",
              "b1c3",
              "f8c5",
              "c3a4",
              "c5b4",
              "c1e3",
              "e8g8",
              "a4c3"
            ]
          },
          {
            "move": "e5e4",
            "depth": 12,
            "cp": -215,
            "mate": null,
            "inverted": true,
            "line": [
              "e5e4",
              "b1d2"
            ]
          },
          {
            "move": "f8d6",
            "depth": 11,
            "cp": -217,
            "mate": null,
            "inverted": true,
            "line": [
              "f8d6",
              "d3d4",
              "e5e4",
              "f3f4",
              "e8g8",
              "d4c5",
              "d6c5",
              "e2d4",
              "c6d4",
              "e3d4",
              "c5b6",
              "f1b5"
            ]
          }
        ],
        "engine": true,
        "fen": "r1bqkb1r/pp4pp/2n2n2/2pppp2/8/3PPPP1/PPP1NK1P/RNBQ1B1R w kq -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6"
          ]
        }
      },
      {
        "san": "Bd6",
        "uci": "f8d6",
        "ignore": false,
        "bestmoves": [
          {
            "move": "d3d4",
            "depth": 13,
            "cp": -165,
            "mate": null,
            "inverted": false,
            "line": [
              "d3d4"
            ]
          },
          {
            "move": "c2c4",
            "depth": 12,
            "cp": -173,
            "mate": null,
            "inverted": false,
            "line": [
              "c2c4",
              "d5d4"
            ]
          },
          {
            "move": "f3f4",
            "depth": 12,
            "cp": -179,
            "mate": null,
            "inverted": false,
            "line": [
              "f3f4",
              "d5d4",
              "e3d4",
              "e5d4",
              "b1d2",
              "c8e6",
              "c2c4",
              "e8g8",
              "d2f3",
              "f8e8",
              "c1d2",
              "e6f7",
              "d1b3",
              "f7h5"
            ]
          }
        ],
        "engine": true,
        "fen": "r1bqkb1r/pp4pp/2n2n2/2pppp2/8/3PPPP1/PPP1N1KP/RNBQ1B1R b kq -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2"
          ]
        }
      },
      {
        "san": "Kf2",
        "uci": "g2f2",
        "ignore": false,
        "bestmoves": [
          {
            "move": "e8g8",
            "depth": 12,
            "cp": -292,
            "mate": null,
            "inverted": true,
            "line": [
              "e8g8",
              "f1h3"
            ]
          },
          {
            "move": "e5e4",
            "depth": 11,
            "cp": -275,
            "mate": null,
            "inverted": true,
            "line": [
              "e5e4",
              "f3f4",
              "e8g8",
              "f1h3",
              "d5d4",
              "c2c3",
              "d4e3",
              "c1e3",
              "f8e8",
              "d3e4",
              "e8e4",
              "e3d2",
              "f6g4",
              "h3g4",
              "f5g4"
            ]
          },
          {
            "move": "d5d4",
            "depth": 11,
            "cp": -269,
            "mate": null,
            "inverted": true,
            "line": [
              "d5d4",
              "f1g2",
              "e8g8",
              "e3d4",
              "c5d4",
              "c2c3",
              "d4c3",
              "b2c3",
              "c8e6",
              "c1e3",
              "e6d5"
            ]
          }
        ],
        "engine": true,
        "fen": "r1bqk2r/pp4pp/2nb1n2/2pppp2/8/3PPPP1/PPP1N1KP/RNBQ1B1R w kq -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6"
          ]
        }
      },
      {
        "san": "O-O",
        "uci": "e8g8",
        "ignore": false,
        "bestmoves": [
          {
            "move": "f1g2",
            "depth": 12,
            "cp": -221,
            "mate": null,
            "inverted": false,
            "line": [
              "f1g2",
              "e5e4",
              "h2h3",
              "f8e8",
              "f3f4",
              "c8e6",
              "d3e4",
              "f5e4",
              "b1c3",
              "a7a6",
              "c1d2",
              "e6f7",
              "h1e1"
            ]
          },
          {
            "move": "h2h3",
            "depth": 12,
            "cp": -240,
            "mate": null,
            "inverted": false,
            "line": [
              "h2h3",
              "a7a6",
              "f3f4",
              "e5e4",
              "d3e4",
              "f6e4",
              "f2g2",
              "c8e6",
              "b1c3",
              "d6c7",
              "c3e4",
              "f5e4",
              "e2c3",
              "c7a5",
              "f1e2"
            ]
          },
          {
            "move": "f1h3",
            "depth": 12,
            "cp": -253,
            "mate": null,
            "inverted": false,
            "line": [
              "f1h3"
            ]
          }
        ],
        "engine": true,
        "fen": "r1bqk2r/pp4pp/2nb1n2/2pppp2/8/3PPPP1/PPP1NK1P/RNBQ1B1R b kq -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2"
          ]
        }
      },
      {
        "san": "Bg2",
        "uci": "f1g2",
        "ignore": false,
        "bestmoves": [
          {
            "move": "b7b5",
            "depth": 12,
            "cp": -243,
            "mate": null,
            "inverted": true,
            "line": [
              "b7b5",
              "h1f1"
            ]
          },
          {
            "move": "c8e6",
            "depth": 11,
            "cp": -253,
            "mate": null,
            "inverted": true,
            "line": [
              "c8e6",
              "h1e1",
              "b7b5",
              "f2g1",
              "b5b4",
              "b1d2",
              "a8b8",
              "a2a3",
              "a7a5",
              "a3b4",
              "c5b4",
              "d2b3",
              "d8b6"
            ]
          },
          {
            "move": "f8e8",
            "depth": 11,
            "cp": -241,
            "mate": null,
            "inverted": true,
            "line": [
              "f8e8",
              "h1f1",
              "c8e6",
              "f2g1",
              "a8b8",
              "b1c3",
              "b7b5",
              "e3e4",
              "b5b4",
              "c3d5",
              "f6d5",
              "e4d5"
            ]
          }
        ],
        "engine": true,
        "fen": "r1bq1rk1/pp4pp/2nb1n2/2pppp2/8/3PPPP1/PPP1NK1P/RNBQ1B1R w - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8"
          ]
        }
      },
      {
        "san": "e4",
        "uci": "e5e4",
        "ignore": false,
        "bestmoves": [
          {
            "move": "h1f1",
            "depth": 12,
            "cp": -155,
            "mate": null,
            "inverted": false,
            "line": [
              "h1f1",
              "c6e5",
              "f2g1",
              "e5f3",
              "g2f3",
              "e4f3",
              "f1f3",
              "g7g5",
              "b1c3",
              "d8e8",
              "b2b3",
              "e8h5",
              "f3f2",
              "f6g4",
              "f2g2",
              "f8e8",
              "c3d5"
            ]
          },
          {
            "move": "h2h3",
            "depth": 12,
            "cp": -203,
            "mate": null,
            "inverted": false,
            "line": [
              "h2h3"
            ]
          },
          {
            "move": "f3f4",
            "depth": 11,
            "cp": -226,
            "mate": null,
            "inverted": false,
            "line": [
              "f3f4",
              "c8e6",
              "h2h3",
              "b7b5",
              "b1d2",
              "a7a5",
              "b2b3",
              "b5b4",
              "a2a3",
              "a5a4",
              "a3b4"
            ]
          }
        ],
        "engine": true,
        "fen": "r1bq1rk1/pp4pp/2nb1n2/2pppp2/8/3PPPP1/PPP1NKBP/RNBQ3R b - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O 9. Bg2",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O",
            "Bg2"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8",
            "f1g2"
          ]
        }
      },
      {
        "san": "f4",
        "uci": "f3f4",
        "ignore": false,
        "bestmoves": [
          {
            "move": "c8e6",
            "depth": 13,
            "cp": -253,
            "mate": null,
            "inverted": true,
            "line": [
              "c8e6",
              "h2h3",
              "e6f7",
              "h1e1",
              "a8b8",
              "f2g1",
              "b7b5",
              "b1d2",
              "b5b4",
              "b2b3",
              "f7h5",
              "c1b2"
            ]
          },
          {
            "move": "d5d4",
            "depth": 12,
            "cp": -250,
            "mate": null,
            "inverted": true,
            "line": [
              "d5d4",
              "f2g1",
              "c8e6",
              "h2h3",
              "d6e7",
              "g1h2",
              "h7h6",
              "b2b3",
              "a8c8",
              "c1b2",
              "d4e3",
              "d3e4",
              "d8d1",
              "h1d1",
              "f6e4"
            ]
          },
          {
            "move": "d6c7",
            "depth": 12,
            "cp": -238,
            "mate": null,
            "inverted": true,
            "line": [
              "d6c7",
              "h2h3",
              "c8e6",
              "d3d4",
              "c5d4",
              "e3d4",
              "d8d7",
              "c1e3",
              "a8c8",
              "h1e1",
              "a7a6",
              "f2g1",
              "e6f7",
              "b1d2",
              "f7h5"
            ]
          }
        ],
        "engine": true,
        "fen": "r1bq1rk1/pp4pp/2nb1n2/2pp1p2/4p3/3PPPP1/PPP1NKBP/RNBQ3R w - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O 9. Bg2 e4",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O",
            "Bg2",
            "e4"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8",
            "f1g2",
            "e5e4"
          ]
        }
      },
      {
        "san": "Be6",
        "uci": "c8e6",
        "ignore": false,
        "bestmoves": [
          {
            "move": "h2h3",
            "depth": 13,
            "cp": -217,
            "mate": null,
            "inverted": false,
            "line": [
              "h2h3",
              "d6c7",
              "f2g1",
              "h7h6",
              "g1h2",
              "d5d4",
              "e3d4",
              "c5d4",
              "b1d2",
              "e4e3",
              "d2f3",
              "e6f7"
            ]
          },
          {
            "move": "h1e1",
            "depth": 12,
            "cp": -222,
            "mate": null,
            "inverted": false,
            "line": [
              "h1e1",
              "b7b5",
              "f2g1",
              "d8b6",
              "a2a3",
              "a7a5",
              "d3d4",
              "b5b4",
              "a3b4",
              "a5b4",
              "d4c5",
              "b6c5",
              "a1a8"
            ]
          },
          {
            "move": "f2g1",
            "depth": 12,
            "cp": -236,
            "mate": null,
            "inverted": false,
            "line": [
              "f2g1",
              "d6e7",
              "h2h3",
              "d5d4",
              "g1h2",
              "h7h6",
              "b2b3",
              "e6f7",
              "d3e4",
              "f6e4",
              "g2e4",
              "f5e4",
              "b1d2"
            ]
          }
        ],
        "engine": true,
        "fen": "r1bq1rk1/pp4pp/2nb1n2/2pp1p2/4pP2/3PP1P1/PPP1NKBP/RNBQ3R b - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O 9. Bg2 e4 10. f4",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O",
            "Bg2",
            "e4",
            "f4"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8",
            "f1g2",
            "e5e4",
            "f3f4"
          ]
        }
      },
      {
        "san": "h3",
        "uci": "h2h3",
        "ignore": false,
        "bestmoves": [
          {
            "move": "d8e7",
            "depth": 12,
            "cp": -266,
            "mate": null,
            "inverted": true,
            "line": [
              "d8e7",
              "b1c3",
              "a7a6",
              "d3e4",
              "d5e4",
              "c1d2",
              "a8d8",
              "d1e1",
              "d6c7",
              "a2a3",
              "b7b5",
              "a1d1",
              "b5b4",
              "a3b4",
              "c5b4"
            ]
          },
          {
            "move": "d6e7",
            "depth": 12,
            "cp": -237,
            "mate": null,
            "inverted": true,
            "line": [
              "d6e7",
              "h1e1"
            ]
          },
          {
            "move": "b7b6",
            "depth": 11,
            "cp": -237,
            "mate": null,
            "inverted": true,
            "line": [
              "b7b6",
              "b1c3",
              "d6e7",
              "d3e4",
              "f6e4",
              "c3e4",
              "f5e4",
              "c1d2",
              "d8d7",
              "c2c4",
              "c6e5",
              "c4d5",
              "e5d3",
              "f2g1",
              "e6d5",
              "e2c3",
              "d3b2",
              "d1b1"
            ]
          }
        ],
        "engine": true,
        "fen": "r2q1rk1/pp4pp/2nbbn2/2pp1p2/4pP2/3PP1P1/PPP1NKBP/RNBQ3R w - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O 9. Bg2 e4 10. f4 Be6",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O",
            "Bg2",
            "e4",
            "f4",
            "Be6"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8",
            "f1g2",
            "e5e4",
            "f3f4",
            "c8e6"
          ]
        }
      },
      {
        "san": "d4",
        "uci": "d5d4",
        "ignore": false,
        "bestmoves": [
          {
            "move": "h1f1",
            "depth": 13,
            "cp": -193,
            "mate": null,
            "inverted": false,
            "line": [
              "h1f1",
              "d8b6"
            ]
          },
          {
            "move": "e3d4",
            "depth": 12,
            "cp": -207,
            "mate": null,
            "inverted": false,
            "line": [
              "e3d4",
              "c5d4",
              "f2g1",
              "d8b6",
              "b1d2",
              "a8e8",
              "g1h2",
              "e6d5",
              "d3e4",
              "f5e4",
              "d2b3",
              "d6c5",
              "b3c5",
              "b6c5"
            ]
          },
          {
            "move": "f2g1",
            "depth": 12,
            "cp": -192,
            "mate": null,
            "inverted": false,
            "line": [
              "f2g1",
              "d8b6",
              "g1h2",
              "a8e8",
              "b1a3",
              "e6d5",
              "c2c4",
              "e4d3",
              "g2d5",
              "f6d5",
              "c4d5",
              "d3e2",
              "d1e2"
            ]
          }
        ],
        "engine": true,
        "fen": "r2q1rk1/pp4pp/2nbbn2/2pp1p2/4pP2/3PP1PP/PPP1NKB1/RNBQ3R b - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O 9. Bg2 e4 10. f4 Be6 11. h3",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O",
            "Bg2",
            "e4",
            "f4",
            "Be6",
            "h3"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8",
            "f1g2",
            "e5e4",
            "f3f4",
            "c8e6",
            "h2h3"
          ]
        }
      },
      {
        "san": "Na3",
        "uci": "b1a3",
        "ignore": false,
        "bestmoves": [
          {
            "move": "d6e7",
            "depth": 12,
            "cp": -279,
            "mate": null,
            "inverted": true,
            "line": [
              "d6e7"
            ]
          },
          {
            "move": "d6c7",
            "depth": 11,
            "cp": -278,
            "mate": null,
            "inverted": true,
            "line": [
              "d6c7",
              "f2g1",
              "a7a6",
              "g1h2",
              "d8d7",
              "c2c3",
              "a8d8",
              "c3d4",
              "c5d4",
              "d3e4",
              "f6e4",
              "e2d4"
            ]
          },
          {
            "move": "d6b8",
            "depth": 11,
            "cp": -232,
            "mate": null,
            "inverted": true,
            "line": [
              "d6b8",
              "h1f1",
              "a7a6",
              "f2g1",
              "b7b5",
              "d3e4",
              "f6e4",
              "e3d4",
              "b5b4",
              "d4c5",
              "b4a3",
              "b2b3"
            ]
          }
        ],
        "engine": true,
        "fen": "r2q1rk1/pp4pp/2nbbn2/2p2p2/3ppP2/3PP1PP/PPP1NKB1/RNBQ3R w - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O 9. Bg2 e4 10. f4 Be6 11. h3 d4",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O",
            "Bg2",
            "e4",
            "f4",
            "Be6",
            "h3",
            "d4"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8",
            "f1g2",
            "e5e4",
            "f3f4",
            "c8e6",
            "h2h3",
            "d5d4"
          ]
        }
      },
      {
        "san": "exd3",
        "uci": "e4d3",
        "ignore": false,
        "bestmoves": [
          {
            "move": "c2d3",
            "depth": 12,
            "cp": -123,
            "mate": null,
            "inverted": false,
            "line": [
              "c2d3",
              "f8e8",
              "h1e1",
              "d6f8",
              "g2c6",
              "b7c6",
              "d1c2",
              "g8h8",
              "a3c4",
              "e6c4",
              "c2c4",
              "d4e3",
              "f2g1",
              "a7a6",
              "b2b3",
              "a6a5"
            ]
          },
          {
            "move": "d1d3",
            "depth": 12,
            "cp": -165,
            "mate": null,
            "inverted": false,
            "line": [
              "d1d3",
              "f8e8",
              "h1e1",
              "f6e4",
              "f2g1",
              "c6b4",
              "d3d1",
              "b4a2",
              "c1d2",
              "e4d2",
              "d1d2",
              "d4e3",
              "d2e3",
              "e6f7"
            ]
          },
          {
            "move": "e2d4",
            "depth": 11,
            "cp": -457,
            "mate": null,
            "inverted": false,
            "line": [
              "e2d4",
              "c5d4",
              "c2d3",
              "d6c5",
              "h1e1",
              "c6b4",
              "f2g1",
              "d8b6",
              "d1e2",
              "e6a2",
              "a3c4",
              "a2c4",
              "d3c4"
            ]
          }
        ],
        "engine": true,
        "fen": "r2q1rk1/pp4pp/2nbbn2/2p2p2/3ppP2/N2PP1PP/PPP1NKB1/R1BQ3R b - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O 9. Bg2 e4 10. f4 Be6 11. h3 d4 12. Na3",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O",
            "Bg2",
            "e4",
            "f4",
            "Be6",
            "h3",
            "d4",
            "Na3"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8",
            "f1g2",
            "e5e4",
            "f3f4",
            "c8e6",
            "h2h3",
            "d5d4",
            "b1a3"
          ]
        }
      },
      {
        "san": "cxd3",
        "uci": "c2d3",
        "ignore": false,
        "bestmoves": [
          {
            "move": "f8e8",
            "depth": 13,
            "cp": -177,
            "mate": null,
            "inverted": true,
            "line": [
              "f8e8",
              "h1e1",
              "h7h6",
              "e3d4",
              "c5d4",
              "c1d2",
              "c6b4",
              "d1b1",
              "d6c5",
              "e1c1",
              "d8b6",
              "a3c4",
              "e6c4",
              "c1c4"
            ]
          },
          {
            "move": "h7h6",
            "depth": 12,
            "cp": -175,
            "mate": null,
            "inverted": true,
            "line": [
              "h7h6",
              "e3d4"
            ]
          },
          {
            "move": "a7a6",
            "depth": 12,
            "cp": -164,
            "mate": null,
            "inverted": true,
            "line": [
              "a7a6",
              "h1e1",
              "f8e8",
              "a3c2",
              "e6d5",
              "g2d5",
              "f6d5",
              "e3d4",
              "d8b6",
              "f2g2",
              "c6d4",
              "e2d4",
              "c5d4"
            ]
          }
        ],
        "engine": true,
        "fen": "r2q1rk1/pp4pp/2nbbn2/2p2p2/3p1P2/N2pP1PP/PPP1NKB1/R1BQ3R w - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O 9. Bg2 e4 10. f4 Be6 11. h3 d4 12. Na3 exd3",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O",
            "Bg2",
            "e4",
            "f4",
            "Be6",
            "h3",
            "d4",
            "Na3",
            "exd3"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8",
            "f1g2",
            "e5e4",
            "f3f4",
            "c8e6",
            "h2h3",
            "d5d4",
            "b1a3",
            "e4d3"
          ]
        }
      },
      {
        "san": "dxe3+",
        "uci": "d4e3",
        "ignore": false,
        "bestmoves": [
          {
            "move": "c1e3",
            "depth": 13,
            "cp": -115,
            "mate": null,
            "inverted": false,
            "line": [
              "c1e3",
              "c6b4"
            ]
          },
          {
            "move": "f2g1",
            "depth": 12,
            "cp": -155,
            "mate": null,
            "inverted": false,
            "line": [
              "f2g1",
              "d8d7",
              "c1e3",
              "a8d8",
              "a3c2",
              "d6e7",
              "g1h2",
              "e6d5",
              "g2d5",
              "d7d5",
              "e2c3",
              "d5d3",
              "d1d3",
              "d8d3"
            ]
          },
          {
            "move": "f2f1",
            "depth": 12,
            "cp": -207,
            "mate": null,
            "inverted": false,
            "line": [
              "f2f1",
              "d6e7",
              "c1e3",
              "c6b4",
              "a3c4",
              "b4d3",
              "c4e5",
              "d3e5",
              "f4e5",
              "f6d5",
              "e3d2",
              "c5c4",
              "a1c1",
              "d8b6",
              "c1c4",
              "b6b2"
            ]
          }
        ],
        "engine": true,
        "fen": "r2q1rk1/pp4pp/2nbbn2/2p2p2/3p1P2/N2PP1PP/PP2NKB1/R1BQ3R b - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O 9. Bg2 e4 10. f4 Be6 11. h3 d4 12. Na3 exd3 13. cxd3",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O",
            "Bg2",
            "e4",
            "f4",
            "Be6",
            "h3",
            "d4",
            "Na3",
            "exd3",
            "cxd3"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8",
            "f1g2",
            "e5e4",
            "f3f4",
            "c8e6",
            "h2h3",
            "d5d4",
            "b1a3",
            "e4d3",
            "c2d3"
          ]
        }
      },
      {
        "san": "Bxe3",
        "uci": "c1e3",
        "ignore": false,
        "bestmoves": [
          {
            "move": "f6d5",
            "depth": 13,
            "cp": -158,
            "mate": null,
            "inverted": true,
            "line": [
              "f6d5",
              "a3c4",
              "d6e7",
              "d1d2",
              "d8d7",
              "h1d1",
              "a8d8",
              "c4e5",
              "c6e5",
              "f4e5",
              "d5e3",
              "d2e3",
              "f8e8"
            ]
          },
          {
            "move": "c6b4",
            "depth": 13,
            "cp": -141,
            "mate": null,
            "inverted": true,
            "line": [
              "c6b4",
              "a3c4",
              "d6c7",
              "e2c1",
              "e6d5",
              "a2a3",
              "b4c6",
              "g2d5",
              "f6d5",
              "e3c5",
              "b7b5",
              "h1e1",
              "b5c4",
              "d3c4",
              "c7b6",
              "d1d5",
              "d8d5",
              "c4d5",
              "b6c5",
              "f2g2"
            ]
          },
          {
            "move": "d6e7",
            "depth": 13,
            "cp": -105,
            "mate": null,
            "inverted": true,
            "line": [
              "d6e7",
              "g2c6",
              "b7c6",
              "a3c4",
              "a8b8",
              "b2b3",
              "f6d5",
              "d1d2",
              "f8e8",
              "h1e1",
              "d8d7",
              "f2g2",
              "e7f6",
              "e3c5",
              "f6a1",
              "e1a1"
            ]
          }
        ],
        "engine": true,
        "fen": "r2q1rk1/pp4pp/2nbbn2/2p2p2/5P2/N2Pp1PP/PP2NKB1/R1BQ3R w - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O 9. Bg2 e4 10. f4 Be6 11. h3 d4 12. Na3 exd3 13. cxd3 dxe3+",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O",
            "Bg2",
            "e4",
            "f4",
            "Be6",
            "h3",
            "d4",
            "Na3",
            "exd3",
            "cxd3",
            "dxe3+"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8",
            "f1g2",
            "e5e4",
            "f3f4",
            "c8e6",
            "h2h3",
            "d5d4",
            "b1a3",
            "e4d3",
            "c2d3",
            "d4e3"
          ]
        }
      },
      {
        "san": "Bd5",
        "uci": "e6d5",
        "ignore": false,
        "bestmoves": [
          {
            "move": "g2d5",
            "depth": 14,
            "cp": 0,
            "mate": null,
            "inverted": false,
            "line": [
              "g2d5",
              "f6d5",
              "d1b3",
              "d6e7",
              "e2c3",
              "c6b4",
              "f2g2",
              "f8f7",
              "c3d5",
              "d8d5",
              "b3d5",
              "b4d5",
              "a1e1",
              "d5e3",
              "e1e3",
              "e7f6",
              "a3c4",
              "f6d4",
              "e3e1",
              "a8d8"
            ]
          },
          {
            "move": "h1e1",
            "depth": 13,
            "cp": -11,
            "mate": null,
            "inverted": false,
            "line": [
              "h1e1",
              "d5f7",
              "a3c4",
              "f8e8",
              "e2c3",
              "d8d7",
              "f2g1",
              "d6f8",
              "e3f2",
              "e8e1",
              "d1e1",
              "d7d3",
              "c4e5",
              "d3c2",
              "a1c1",
              "c2b2",
              "e5c6",
              "b7c6"
            ]
          },
          {
            "move": "e2c3",
            "depth": 13,
            "cp": -12,
            "mate": null,
            "inverted": false,
            "line": [
              "e2c3",
              "d5f7",
              "a3c4",
              "f8e8",
              "g2c6",
              "b7c6",
              "h1e1",
              "d8d7",
              "f2g1",
              "a8d8",
              "e3f2",
              "e8e1",
              "d1e1",
              "f7d5",
              "e1e3",
              "d5c4",
              "d3c4"
            ]
          }
        ],
        "engine": true,
        "fen": "r2q1rk1/pp4pp/2nbbn2/2p2p2/5P2/N2PB1PP/PP2NKB1/R2Q3R b - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O 9. Bg2 e4 10. f4 Be6 11. h3 d4 12. Na3 exd3 13. cxd3 dxe3+ 14. Bxe3",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O",
            "Bg2",
            "e4",
            "f4",
            "Be6",
            "h3",
            "d4",
            "Na3",
            "exd3",
            "cxd3",
            "dxe3+",
            "Bxe3"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8",
            "f1g2",
            "e5e4",
            "f3f4",
            "c8e6",
            "h2h3",
            "d5d4",
            "b1a3",
            "e4d3",
            "c2d3",
            "d4e3",
            "c1e3"
          ]
        }
      },
      {
        "san": "Nc4",
        "uci": "a3c4",
        "ignore": false,
        "bestmoves": [
          {
            "move": "f8e8",
            "depth": 14,
            "cp": -80,
            "mate": null,
            "inverted": true,
            "line": [
              "f8e8",
              "e2c3"
            ]
          },
          {
            "move": "d5g2",
            "depth": 13,
            "cp": -131,
            "mate": null,
            "inverted": true,
            "line": [
              "d5g2",
              "f2g2",
              "b7b5",
              "c4d6",
              "d8d6",
              "a1c1",
              "f8e8",
              "e3c5",
              "d6d5",
              "g2h2",
              "a8d8",
              "h1e1",
              "b5b4",
              "c1c2",
              "d5a2",
              "c2d2",
              "a2d5"
            ]
          },
          {
            "move": "b7b5",
            "depth": 13,
            "cp": -92,
            "mate": null,
            "inverted": true,
            "line": [
              "b7b5",
              "c4d6",
              "d8d6",
              "a1c1",
              "d5g2",
              "f2g2",
              "f8e8",
              "e3c5",
              "d6d5",
              "g2h2",
              "a8d8",
              "h1e1",
              "d5d3",
              "d1d3",
              "d8d3",
              "e2c3",
              "d3d2",
              "h2g1",
              "e8e1",
              "c1e1",
              "d2b2"
            ]
          }
        ],
        "engine": true,
        "fen": "r2q1rk1/pp4pp/2nb1n2/2pb1p2/5P2/N2PB1PP/PP2NKB1/R2Q3R w - -",
        "line": {
          "pgn": "1. e3 d5 2. f3 c5 3. Kf2 e5 4. Ne2 f5 5. g3 Nf6 6. d3 Nc6 7. Kg2 Bd6 8. Kf2 O-O 9. Bg2 e4 10. f4 Be6 11. h3 d4 12. Na3 exd3 13. cxd3 dxe3+ 14. Bxe3 Bd5",
          "san": [
            "e3",
            "d5",
            "f3",
            "c5",
            "Kf2",
            "e5",
            "Ne2",
            "f5",
            "g3",
            "Nf6",
            "d3",
            "Nc6",
            "Kg2",
            "Bd6",
            "Kf2",
            "O-O",
            "Bg2",
            "e4",
            "f4",
            "Be6",
            "h3",
            "d4",
            "Na3",
            "exd3",
            "cxd3",
            "dxe3+",
            "Bxe3",
            "Bd5"
          ],
          "uci": [
            "e2e3",
            "d7d5",
            "f2f3",
            "c7c5",
            "e1f2",
            "e7e5",
            "g1e2",
            "f7f5",
            "g2g3",
            "g8f6",
            "d2d3",
            "b8c6",
            "f2g2",
            "f8d6",
            "g2f2",
            "e8g8",
            "f1g2",
            "e5e4",
            "f3f4",
            "c8e6",
            "h2h3",
            "d5d4",
            "b1a3",
            "e4d3",
            "c2d3",
            "d4e3",
            "c1e3",
            "e6d5"
          ]
        }
      }
    ],
    "site": "Chess.com",
    "username": "avweije",
    "year": 2025,
    "month": 3,
    "type": "Blitz"
  },
  "site": "Chess.com",
  "username": "avweije",
  "year": 2025,
  "month": 3,
  "type": "Blitz"
}';


    return json_decode($json, true);
  }
}
