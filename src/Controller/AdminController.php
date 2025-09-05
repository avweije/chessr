<?php

namespace App\Controller;

use App\Entity\Evaluation;
use App\Entity\Fen;
use App\Entity\ImportLog;
use App\Library\ChessJs;
use App\Service\ChessHelper;
use App\Service\MyPgnParser\MyPgnParser;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;
use Onspli\Chess\FEN as ChessFEN;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * AdminController - Summary
 *
 * This controller provides admin endpoints and utilities for managing large chess data files, importing chess engine evaluations, updating evaluation records, and processing PGN files. It interacts directly with the `evaluations` and `moves` tables, and handles batch operations for efficiency.
 *
 * Key Functions:
 * 
 * 
 * ****
 * NEED TO UPDATE THIS..
 * ****
 * 
 * 
 * 
 * 1. index() - Renders admin dashboard, contains test code for splitting files, updating FENs, and updating evals.
 * 2. importInBatches() - for evals and move stats (need to clear up the rest, if not needed/used anymore)
 * 3. importEvaluations() - POST /admin/evaluations/import: Imports chess engine evaluations from JSONL files into the database.
 * 4. importPgnFiles() - Processes PGN files and updates move statistics.
 * 
 * 5. parseEvals($maxLines, $batchSize) - Reads and inserts lines from split JSONL files.
 * 
 * 6. split_file() - Splits large JSONL files into chunks.
 * 8. parseEvalsJson($filePath, $maxLines) - Generator for incremental import from JSONL files.
 * 9. findEvaluation($fen) - Searches split JSONL files for a FEN.
 * 11. splitPgnFile($path, $parts) - Splits large PGN files.
 * 13. processGame($game, &$totals, &$moveCount) - Processes a single chess game.
 * 14. processMoves($moves) - Inserts/updates move statistics in the moves table.
 * 15. getDuration($ms) - Converts duration to human-readable string.
 *
 * Usage:
 * - Batch update FENs: POST to /admin/evaluations/update with startId and batchSize.
 * - Import evaluations: POST to /admin/evaluations/import with maxLines and batchSize.
 * - Import PGN files: Access /admin/import.
 * - Split large files: Call split_file() or splitPgnFile() internally.
 * - Process moves/games: Use importPgnFiles() and helpers.
 */

class AdminController extends AbstractController
{
    private $em;
    private $conn;
    private $myPgnParser;
    private $chessHelper;

    private array $fenDict = [];
    private int $nextFenId = 1;

    public function __construct(
        Connection $conn,
        EntityManagerInterface $em,
        MyPgnParser $myPgnParser,
        ManagerRegistry $doctrine,
        ChessHelper $chessHelper
    ) {
        $this->em = $em;
        $this->myPgnParser = $myPgnParser;
        $this->conn = $conn;
        $this->chessHelper = $chessHelper;
    }

    #[Route('/admin', name: 'admin')]
    public function index(): Response
    {
        return $this->render('admin/index.html.twig');
    }

    #[Route('/admin/evaluations/import', methods: ["POST"], name: 'app_admin_evaluations_import')]
    public function importInBatches(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        $importType = $data["type"];

        $maxLines = intval($data["maxLines"]);
        $batchSize = intval($data["batchSize"]);
        $processed = intval($data["processed"]);

        if ($importType == "evaluations") {
            return $this->importEvaluations($maxLines, $batchSize);
        } else {
            return $this->importPgnFiles($batchSize, $processed);
        }
    }

    private function importEvaluations($maxLines, $batchSize): JsonResponse
    {
        $time = time();

        $processed = 0;
        $bytes = 0;
        $lastFidx = 0;
        $lastPct = 0;

        for ($i = 0; $i < 1; $i++) {
            [$lines, $bytes, $lastFidx, $lastPct] = $this->parseEvals($maxLines, $batchSize);

            $processed += $lines;
        }

        $seconds = time() - $time;

        $duration = $this->getDuration($seconds);

        return new JsonResponse([
            "processed" => $processed,
            "percentageComplete" => $lastPct,
            "fileIndex" => $lastFidx
        ]);
    }

    // Maybe use this later..
    private function split_file()
    {

        $file = './lichess_db_eval.jsonl';
        $basename = 'lichess_db_eval-';

        $buffer = '';

        // split into 1GB files
        $splitSize = 1024 * 1024 * 1024;

        $read = 0;
        $fidx = 1;

        $handle = fopen($file, "r");

        $fname = "./lichess_db_eval-$fidx.jsonl";

        $fhandle2 = fopen($fname, "w") or die($php_errormsg);

        if (!$fhandle2) {
            echo "Cannot open file ($fname)";
            //exit;
        }

        while (!feof($handle)) {

            $line = fgets($handle, 4096);
            //$buffer .= $line;
            $read += strlen($line);

            if (!fwrite($fhandle2, $line)) {
                echo "Cannot write to file ($fname)";
                //exit;
            }

            if ($read >= $splitSize) {

                fclose($fhandle2);

                // increase time limit
                set_time_limit(120);

                $fidx++;
                $read = 0;

                $buffer = '';

                $fname = "./lichess_db_eval-$fidx.jsonl";

                $fhandle2 = fopen($fname, "w") or die($php_errormsg);

                if (!$fhandle2) {
                    echo "Cannot open file ($fname)";
                    //exit;
                }
            }
        }
        fclose($handle);
        fclose($fhandle2);
    }


    //
    private function parseEvals($maxLines = 5000, $batchSize = 1000)
    {
        $file = './lichess_db_eval-1.jsonl';

        $processed = 0;
        $lastBytes = 0;
        $lastPct = 0;
        $lastFidx = 0;

        $this->conn->setAutoCommit(false);
        $this->conn->beginTransaction();

        $sql = 'INSERT INTO evaluations.evaluation 
        (fen_id, uci, san, cp, mate, rank, line, depth, knodes, fidx, bytes)
        VALUES (:fen_id, :uci, :san, :cp, :mate, :rank, :line, :depth, :knodes, :fidx, :bytes)';
        $stmtInsert = $this->conn->prepare($sql);

        // Create once, pass in function call
        $chess = new ChessJs();

        foreach ($this->parseEvalsJson($file, $maxLines) as [$fidx, $line, $bytes, $fsize]) {
            set_time_limit(300);

            $lastBytes = $bytes;
            $lastFidx = $fidx;
            $lastPct = round(($bytes / $fsize) * 100, 2);

            $json = json_decode($line, true);
            if ($json === null) {
                print "Json = null<br>";
                print $line . "<br>";
                continue;
            }

            // Normalize FEN for evaluation
            $fenString = $this->chessHelper->normalizeFenForEvaluation($json["fen"]);

            // Get or create Fen ID
            $fenRepo = $this->em->getRepository(Fen::class);

            $fenEntity = $fenRepo->findOneBy(['fen' => $fenString]);
            if (!$fenEntity) {
                $fenEntity = new Fen();
                $fenEntity->setFen($fenString);
                $this->em->persist($fenEntity);
                $this->em->flush();
            }
            $fenId = $fenEntity->getId();

            // Determine top moves (1-5) from deepest PVs
            $evalsArray = $json["evals"] ?? [];
            if (empty($evalsArray)) {
                continue;
            }

            usort($evalsArray, fn($a, $b) => $b['depth'] <=> $a['depth']);
            $movesToInsert = [];
            $uciAlready = [];

            // Top depth first
            $topEval = $evalsArray[0];
            foreach ($topEval['pvs'] as $pv) {
                $uci = $pv['line'] ?? '';
                if (!in_array($uci, $uciAlready)) {
                    // merge depth and knodes into pv array
                    $pv['depth'] = $topEval['depth'] ?? null;
                    $pv['knodes'] = $topEval['knodes'] ?? null;

                    $movesToInsert[] = $pv;
                    $uciAlready[] = $uci;
                }
                if (count($movesToInsert) >= 5) break;
            }

            // Second depth if needed
            if (count($movesToInsert) < 5 && isset($evalsArray[1])) {
                foreach ($evalsArray[1]['pvs'] as $pv) {
                    $uci = $pv['line'] ?? '';
                    if (!in_array($uci, $uciAlready)) {
                        // merge depth and knodes into pv array
                        $pv['depth'] = $evalsArray[1]['depth'] ?? null;
                        $pv['knodes'] = $evalsArray[1]['knodes'] ?? null;

                        $movesToInsert[] = $pv;
                        $uciAlready[] = $uci;
                    }
                    if (count($movesToInsert) >= 5) break;
                }
            }

            // Insert each move
            $rank = 1;
            foreach ($movesToInsert as $pv) {
                $moves = explode(" ", $pv['line']);

                $uci = count($moves) > 0 ? $moves[0] : '';
                $san = ''; // convert to SAN if needed
                $scoreCp = $pv['cp'] ?? null;
                $scoreMate = $pv['mate'] ?? null;
                $line = $pv['line'] ?? '';
                $depth = $pv['depth'] ?? null;
                $knodes = $pv['knodes'] ?? null;

                // We need to make sure line isn't longer than 255 chars
                if (strlen($line) > 255) {
                    // cut at the last space before the limit
                    $truncated = substr($line, 0, 255);
                    $lastSpace = strrpos($truncated, ' ');
                    if ($lastSpace !== false) {
                        $line = substr($truncated, 0, $lastSpace);
                    } else {
                        // fallback if no space found: just take the substring
                        $line = $truncated;
                    }
                }

                // Get the SAN notation
                $san = $this->chessHelper->getFirstSanMoveFromLine($chess, $json["fen"], $pv['line']);

                //
                // Appearantly there are some chess960 evaluations in here..
                // If $san == null, we have an invalid move because of castling not possible..
                //
                if ($uci == '' || $san == null || count($moves) == 0) {
                    continue;
                }

                // Attempt to filter out other variants
                if (!$this->chessHelper->isLikelyStandardChessFEN($json["fen"])) {

                    //dd("Not a standard chess game.", $json);

                    continue;
                }

                //dd($uci,$san,$scoreCp,$scoreMate,$rank,$depth,$knodes,$fidx,$bytes);

                $stmtInsert->bindValue('fen_id', $fenId);
                $stmtInsert->bindValue('uci', $uci);
                $stmtInsert->bindValue('san', $san);
                $stmtInsert->bindValue('cp', $scoreCp);
                $stmtInsert->bindValue('mate', $scoreMate);
                $stmtInsert->bindValue('rank', $rank);
                $stmtInsert->bindValue('line', $line);
                $stmtInsert->bindValue('depth', $depth);
                $stmtInsert->bindValue('knodes', $knodes);
                $stmtInsert->bindValue('fidx', $fidx);
                $stmtInsert->bindValue('bytes', $bytes);

                $stmtInsert->executeStatement();
                $rank++;
            }

            $processed++;
            if ($processed % $batchSize == 0) {
                $this->conn->commit();
                $this->conn->beginTransaction();
            }
        }

        $this->conn->commit();

        return [$processed, $lastBytes, $lastFidx, $lastPct];
    }

    public function parseEvalsJson($filePath, $maxLines = 5000)
    {

        $bytes = 0;
        $fidx = 1;

        $sql = 'SELECT bytes, fidx FROM evaluations.evaluation ORDER BY id DESC LIMIT 1';
        $stmtFind = $this->conn->prepare($sql);

        $result = $stmtFind->executeQuery();

        $item = $result->fetchAssociative();

        // if the move exists
        if ($item !== false) {
            $bytes = $item['bytes'];
            $fidx = $item['fidx'];
        }

        if ($fidx == null || $fidx == -1) {
            print "All files read.<br>";
            exit;
        }

        $i = 0;
        $maxLines = $maxLines;

        //$fileName = basename($filePath);

        $filePath = './lichess_db_eval-' . $fidx . '.jsonl';

        while (file_exists($filePath)) {

            //print "File open: " . $filePath . " ($bytes)<br>";

            $handle = fopen($filePath, "r");
            fseek($handle, $bytes, SEEK_SET);

            $fsize = filesize($filePath);

            while (($line = fgets($handle, 8192)) !== false) {

                $bytes += strlen($line);

                // When reading files line-by-line, there is a \n at the end, so remove it.
                $line = trim($line);
                if (empty($line)) {

                    continue;
                }

                yield [$fidx, $line, $bytes, $fsize];

                $i++;

                if ($i >= $maxLines) {
                    break 2;
                }
            }

            fclose($handle);

            $fidx++;

            $filePath = './lichess_db_eval-' . $fidx . '.jsonl';
            $bytes = 0;
        }
    }

    public function findEvaluation($fen): array
    {
        $fidx = 1;
        $basename = './lichess_db_eval-';
        $bytes = 0;

        print "Trying: '" . $basename . $fidx . ".jsonl'<br>";

        while (file_exists($basename . $fidx . ".jsonl")) {

            $handle = fopen($basename . $fidx . ".jsonl", "r");

            print "File opened: '" . $basename . $fidx . ".jsonl' (bytes prev = $bytes)<br>";

            $bytes = 0;

            while (($line = fgets($handle, 8192)) !== false) {

                $bytes += strlen($line);

                // When reading files line-by-line, there is a \n at the end, so remove it.
                $line = trim($line);
                if (empty($line)) {
                    continue;
                }

                $json = json_decode($line, true);
                if ($json["fen"] == $fen) {
                    return [$fidx, $bytes, $json];
                }
            }

            fclose($handle);

            $fidx++;
        }

        return [-1, 0, null];
    }


    private function splitPgnFile($path, $parts = 10)
    {

        $pathinfo = pathinfo($path);

        $fsize = filesize($path);

        $partSize = $fsize / 10;

        $part = 1;
        $read = 0;

        $handle = fopen($path, "r");

        $handle2 = fopen($pathinfo["dirname"] . "/" . $pathinfo["filename"] . "-" . $part . ".pgn", "w");

        $meta = false;

        while (($line = fgets($handle, 4096)) !== false) {

            $empty = empty(trim($line));

            if ($meta == false && $empty && $read >= $partSize) {
                fclose($handle2);

                $part++;
                $read = 0;

                set_time_limit(120);

                $handle2 = fopen($pathinfo["dirname"] . "/" . $pathinfo["filename"] . "-" . $part . ".pgn", "w");

                continue;
            }

            if (strpos($line, '[') === 0) {
                $meta = true;
            } else if ($empty == false) {
                $meta = false;
            }

            $read += strlen($line);

            fwrite($handle2, $line);
        }

        fclose($handle);
        fclose($handle2);
    }


    public function importPgnFiles(int $limit, int $skip): JsonResponse
    {
        ini_set('memory_limit', '2G');

        $files = ['./lichess_elite_2025-05.pgn'];
        $filePath = $files[0];

        $totals = [];
        $gameCount = 0;
        $moveCount = 0;
        $processCount = 0;
        $queryCount = 0;
        $bytesReadTotal = 0;
        
        $batchSize = $limit;

        // Get the import log repo
        $importLogRepo = $this->em->getRepository(ImportLog::class);

        // prepare FEN insert statement once
        $stmtInsertFen = $this->conn->prepare(
            'INSERT INTO fen (fen) VALUES (:fen)'
        );

        foreach ($files as $file) {

            // Check to see if we already partially imported this file
            $log = $importLogRepo->findOneBy(['filename' => $file]);

            if ($log) {
                // Get the games read from the log
                $skip = $log->getGamesRead();
            } else {
                // Add a new import log
                $log = new ImportLog();
                $log->setFilename($file);
                $log->setGamesRead(0);
                $log->setFinished(false);
            }

            //dd($file, $skip, $log);

            // If this file is finished, continue to the next
            if ($log->isFinished()) {
                continue;
            }

            // Keep track of game count for this file
            $fileGameCount = 0;
            $gamesRead = $log->getGamesRead();

            // Parse the PGN files
            foreach ($this->myPgnParser->parsePgn($file, false, $limit, $skip) as $item) {
                set_time_limit(300);

                $game = $item['game'];
                $bytesReadTotal = $item['bytesRead'];

                $this->processGame($game, $totals, $moveCount, $stmtInsertFen);

                $gameCount++;
                $fileGameCount++;

                if ($gameCount % $batchSize === 0) {
                    $queryCount += $this->processMoves($totals);
                    $processCount++;

                    // Update import log
                    $log->setGamesRead($gamesRead + $gameCount);

                    // Persist and flush
                    $this->em->persist($log);
                    $this->em->flush();

                    $totals = [];
                    gc_collect_cycles();
                }

                unset($game);
            }

            // flush leftover totals
            if (!empty($totals)) {
                $queryCount += $this->processMoves($totals);
                $processCount++;
                $totals = [];
                gc_collect_cycles();
            }

            // Update the import log
            $log->setGamesRead($gamesRead + $gameCount);
            $log->setFinished($fileGameCount == 0);

            // Persist and flush
            $this->em->persist($log);
            $this->em->flush();
        }

        $fileSize = filesize($filePath);
        $percentageComplete = round(($bytesReadTotal / $fileSize) * 100, 2);

        return new JsonResponse([
            "processed" => $gameCount,
            "moveCount" => $moveCount,
            "processCount" => $processCount,
            "queryCount" => $queryCount,
            "fileSize" => $fileSize,
            "bytesRead" => $bytesReadTotal,
            "skip" => $skip,
            "percentageComplete" => $percentageComplete,
            "fileIndex" => 0
        ]);
    }

    private function processGame($game, array &$totals, int &$moveCount, $stmtInsertFen): void
    {
        $fen = new ChessFEN();
        $moves = $game->getMovesArray();
        $maxMoves = min(20, count($moves));

        // normalize result
        $map = ['1-0' => 'w', '0-1' => 'b', '1/2-1/2' => 'd'];
        $result = $map[$game->getResult()] ?? '';

        for ($i = 0; $i < $maxMoves; $i++) {
            $move = $moves[$i] ?? '';
            if ($move === '') continue;

            $fenstr = $fen->export();

            // Normalize the FEN string for move stats
            $fenstr = $this->chessHelper->normalizeFenForMoveStats($fenstr);

            // assign or retrieve FEN ID
            if (!isset($this->fenDict[$fenstr])) {
                // check database first
                $stmtFindFen = $this->conn->prepare('SELECT id FROM fen WHERE fen = :fen');
                $stmtFindFen->bindValue('fen', $fenstr);
                $item = $stmtFindFen->executeQuery()->fetchAssociative();

                if ($item !== false) {
                    $fenId = (int) $item['id'];
                } else {
                    // insert new FEN
                    $stmtInsertFen->bindValue('fen', $fenstr);
                    $stmtInsertFen->executeStatement();
                    $fenId = (int) $this->conn->lastInsertId();
                }

                // cache it
                $this->fenDict[$fenstr] = $fenId;
            } else {
                $fenId = $this->fenDict[$fenstr];
            }

            $key = $fenId . '|' . $move;

            if (!isset($totals[$key])) {
                $totals[$key] = [0, 0, 0]; // wins, draws, losses
            }

            switch ($result) {
                case 'w':
                    $totals[$key][0]++;
                    break;
                case 'd':
                    $totals[$key][1]++;
                    break;
                case 'b':
                    $totals[$key][2]++;
                    break;
            }

            $fen->move($move);
            $moveCount++;
        }

        unset($fen, $moves);
        gc_collect_cycles();
    }

    private function processMoves(array $moves): int
    {
        $stmtFind = $this->conn->prepare(
            'SELECT wins, draws, losses FROM move_stats WHERE fen_id = :fenId AND move = :move'
        );
        $stmtInsert = $this->conn->prepare(
            'INSERT INTO move_stats (fen_id, move, wins, draws, losses) VALUES (:fenId, :move, :wins, :draws, :losses)'
        );
        $stmtUpdate = $this->conn->prepare(
            'UPDATE move_stats SET wins = :wins, draws = :draws, losses = :losses WHERE fen_id = :fenId AND move = :move'
        );

        $queryCount = 0;
        $batchSize = 1000;
        $this->conn->beginTransaction();

        foreach ($moves as $key => $score) {
            set_time_limit(300);

            [$fenId, $move] = explode('|', $key, 2);

            $stmtFind->bindValue('fenId', (int)$fenId);
            $stmtFind->bindValue('move', $move);
            $item = $stmtFind->executeQuery()->fetchAssociative();

            if ($item === false) {
                $stmtInsert->bindValue('fenId', (int)$fenId);
                $stmtInsert->bindValue('move', $move);
                $stmtInsert->bindValue('wins', $score[0]);
                $stmtInsert->bindValue('draws', $score[1]);
                $stmtInsert->bindValue('losses', $score[2]);
                $stmtInsert->executeStatement();
            } else {
                $stmtUpdate->bindValue('fenId', (int)$fenId);
                $stmtUpdate->bindValue('move', $move);
                $stmtUpdate->bindValue('wins', $item['wins'] + $score[0]);
                $stmtUpdate->bindValue('draws', $item['draws'] + $score[1]);
                $stmtUpdate->bindValue('losses', $item['losses'] + $score[2]);
                $stmtUpdate->executeStatement();
            }

            $queryCount++;

            if ($queryCount % $batchSize === 0) {
                $this->conn->commit();
                $this->conn->beginTransaction();
            }
        }

        $this->conn->commit();

        unset($moves);
        gc_collect_cycles();

        return $queryCount;
    }


    // returns the duration in text, based off of microseconds
    public function getDuration($ms)
    {
        $seconds = round($ms, 3);

        //print "-- duration: $ms -- --";


        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds - $hours * 3600) / 60);
        $seconds = floor($seconds - ($hours * 3600) - ($minutes * 60));

        return ($hours > 0 ? $hours . "h " : "") . ($hours > 0 || $minutes > 0 ? $minutes . "m " : "") . $seconds . "s";
    }
}
