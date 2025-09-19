<?php

namespace App\Controller;

use App\Entity\Evaluation;
use App\Entity\Fen;
use App\Entity\ImportLog;
use App\Library\ChessJs;
use App\Library\FastChessJs;
use App\Library\FastSanParser;
use App\Library\FastFen\FEN as FastFen;
use App\Service\ChessHelper;
use App\Service\MyPgnParser\MyPgnParser;
use App\Library\Timer;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;
use Exception;
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
    private $doctrine;
    private $em;
    private $conn;
    private $myPgnParser;
    private $chessHelper;
    private $timer;

    private array $fenDict = [];
    private int $nextFenId = 1;

    public function __construct(
        Connection $conn,
        EntityManagerInterface $em,
        MyPgnParser $myPgnParser,
        ManagerRegistry $doctrine,
        ChessHelper $chessHelper,
        Timer $timer
    ) {
        $this->doctrine = $doctrine;
        $this->em = $em;
        $this->myPgnParser = $myPgnParser;
        $this->conn = $conn;
        $this->chessHelper = $chessHelper;
        $this->timer = $timer;
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
        // start the timer
        $this->timer->startProcess();

        $time = time();

        $processed = 0;
        $bytes = 0;
        $lastFidx = 0;
        $lastPct = 0;

        $totProcessed = 0;
        $totSkipped = 0;
        //$commitTotal = 0;
        $commitTotal = [];

        for ($i = 0; $i < 1; $i++) {
            [$lines, $bytes, $lastFidx, $lastPct, $commitCount, $totalProcessed, $totalSkipped] = 
                $this->parseEvals($maxLines, $batchSize);

            $processed += $lines;
            
            //$commitTotal += $commitCount;
            $commitTotal = [...$commitTotal, ...$commitCount];

            $totProcessed += $totalProcessed;
            $totSkipped += $totalSkipped;
        }

        $seconds = time() - $time;

        $duration = $this->getDuration($seconds);

        // end the timer
        $this->timer->endProcess();

        return new JsonResponse([
            "processed" => $processed,
            "percentageComplete" => $lastPct,
            "fileIndex" => $lastFidx,
            "commitCount" => $commitTotal,
            "totProcessed" => $totProcessed,
            "totSkipped" => $totSkipped,
            "timer" => $this->timer->getReport()
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
        // Get the current file index and bytes where we last left off
        [$fidx, $bytes] = $this->getCurrentEvaluationsFile();

        // Get the filename
        $filePath = './lichess_db_eval-' . $fidx . '.jsonl';

        // Make sure the file exists
        if (!file_exists($filePath)) {
            throw new Exception(`Evaluations file does not exist: {$filePath}`);
        }

        $processed = 0;
        $commitCount = [];

        $lastFidx = $fidx;
        $lastBytes = $bytes;
        $lastPct = 0;

        // Create once, pass in function call
        $chess = new ChessJs();

        // arrays to keep FENs and moves until batch flush
        $fensToFlush = [];       // array of FEN strings
        $batchMoves = [];        // array of moves per FEN index

        $totalProcessed = 0;
        $totalSkipped = 0;

        foreach ($this->parseEvalsJson($filePath, $lastBytes, $maxLines) as [$line, $bytes, $fsize]) {
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

            // start the sub timer
            $this->timer->startSub('normalizeForEvaluation');

            // Normalize FEN for evaluation
            $fenString = $this->chessHelper->normalizeFenForEvaluation($json["fen"]);

            // end the sub timer
            $this->timer->stopSub('normalizeForEvaluation');


            /*

            As for FEN.. it shouldnt exist, skip the check part and just insert.
            If we do get a unique key error, we can either skip it or get the FEN
            record and use that. Again, it shouldnt exist. If it does we actually
            need to check which evals are in there and if the new (current ones read)
            are actually better.. Catch error for now and throw to stop ..
            Can check when it happens what do do.

            try {
                $fenEntity = new Fen();
                $fenEntity->setFen($fenString);
                $this->em->persist($fenEntity);
                $this->em->flush();
            } catch (\Doctrine\DBAL\Exception\UniqueConstraintViolationException $e) {
                // skip, already exists
            }

            */


            //$fenEntity = $fenRepo->findOneBy(['fen' => $fenString]);
            //if (!$fenEntity) {

            /*
            try {
                $fenEntity = new Fen();
                $fenEntity->setFen($fenString);
                $this->em->persist($fenEntity);
                $this->em->flush();
            } catch (\Doctrine\DBAL\Exception\UniqueConstraintViolationException $e) {
                // Just throw for now, I want to see when it happens..
                throw $e;
            }
            //}
            $fenId = $fenEntity->getId();
            */

            /*

            // Only create new entity if not already in this batch
            if (!isset($fenEntitiesByString[$fenString])) {
                $fenEntity = new Fen();
                $fenEntity->setFen($fenString);
                $this->em->persist($fenEntity);

                $newFens[] = $fenEntity;
                $fenEntitiesByString[$fenString] = $fenEntity;
            }

            // We'll flush all new FENs later, before inserting moves
            */

            // Store FEN in array and get its index
            $currentFenIdx = count($fensToFlush);
            $fensToFlush[] = $fenString;


            // Determine top moves (1-5) from deepest PVs
            $evalsArray = $json["evals"] ?? [];
            if (empty($evalsArray)) {
                continue;
            }

            // start the sub timer
            $this->timer->startSub('Sort Evals');

            usort($evalsArray, fn($a, $b) => $b['depth'] <=> $a['depth']);
            $movesToInsert = [];
            $uciAlready = [];

            // end the sub timer
            $this->timer->startSub('Sort Evals');

            // start the sub timer
            $this->timer->startSub('Filter Evals');

            // Top depth first
            $topEval = $evalsArray[0];
            foreach ($topEval['pvs'] as $pv) {
                $uci = $pv['line'] ?? '';
                if (!in_array($uci, $uciAlready)) {
                    // merge depth and knodes into pv array
                    $pv['depth'] = $topEval['depth'] ?? null;
                    $pv['knodes'] = $topEval['knodes'] ?? null;

                    // Add the fidx and bytes
                    $pv['fidx'] = $lastFidx;
                    $pv['bytes'] = $lastBytes;

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

                        // Add the fidx and bytes
                        $pv['fidx'] = $lastFidx;
                        $pv['bytes'] = $lastBytes;

                        $movesToInsert[] = $pv;
                        $uciAlready[] = $uci;
                    }
                    if (count($movesToInsert) >= 5) break;
                }
            }

            // end the sub timer
            $this->timer->stopSub('Filter Evals');

            
            // Store moves keyed by FEN index
            $batchMoves[$currentFenIdx] = $movesToInsert;
            $processed++;

            if ($processed % $batchSize == 0) {

                //dd($processed, $batchSize, $fensToFlush, $batchMoves);
                //
                [$batchProcessed,$batchSkipped] = $this->processEvalsBatch($fensToFlush, $batchMoves, $chess, $processed);

                //$this->conn->commit();
                //$this->conn->beginTransaction();

                //$commitCount++;
                $commitCount[] = [
                    "processed" => $processed,
                    "fidx" => $fidx,
                    "bytes" => $bytes,
                    "batchProcessed" => $batchProcessed,
                    "batchSkipped" => $batchSkipped
                ];

                $totalProcessed += $batchProcessed;
                $totalSkipped += $batchSkipped;

                // Reset batch arrays
                $fensToFlush = [];
                $batchMoves = [];
            }

            // testing new setup, FEN in batches
            continue;



            // start the sub timer
            $this->timer->startSub('Add Evals Loop');

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

                // start the sub timer
                $this->timer->startSub('GetFirstSanMove');

                // Get the SAN notation
                $san = $this->chessHelper->getFirstSanMoveFromLine($chess, $json["fen"], $pv['line']);

                // end the sub timer
                $this->timer->stopSub('GetFirstSanMove');

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

            // end the sub timer
            $this->timer->stopSub('Add Evals Loop');
}

        if ($processed > 0) {
            //
            [$batchProcessed, $batchSkipped] = $this->processEvalsBatch($fensToFlush, $batchMoves, $chess, $processed);

            //$this->conn->commit();

            $totalProcessed += $batchProcessed;
            $totalSkipped += $batchSkipped;
            
            //$commitCount++;
            $commitCount[] = [
                "processed" => $processed,
                "fidx" => $fidx,
                "bytes" => $bytes,
                "batchProcessed" => $batchProcessed,
                "batchSkipped" => $batchSkipped
                ];
        }

        //$commitCount++;
        //$this->conn->commit();

        return [$processed, $lastBytes, $lastFidx, $lastPct, $commitCount, $totalProcessed, $totalSkipped];
    }

    private function processEvalsBatch($fensToFlush, $batchMoves, $chess, $processed) 
    {
        $fenEntities = [];
        $fenIds = [];
        $processed = 0;
        $skipped = 0;
        $uniqueErrors = 0;

        // start the sub timer
        $this->timer->startSub('InsertFens');

        // Process the FEN strings
        foreach ($fensToFlush as $fenString) {
            try {


                $sql = "INSERT INTO fen (fen)
                    VALUES (:fen)
                    ON CONFLICT (fen) DO NOTHING
                    RETURNING id";

                $stmt = $this->conn->prepare($sql);
                $stmt->bindValue('fen', $fenString);
                $result = $stmt->executeQuery();
                $fenId = $result->fetchOne(); // ID of inserted or existing row

                // If null, the FEN string already existed
                // We need to check if there are evaluations for this position or not
                if ($fenId == null) {
                    // Get the FEN string ID
                    $sql = "SELECT id FROM fen WHERE fen = :fen";

                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue('fen', $fenString);
                    $result = $stmt->executeQuery();

                    $existingId = $result->fetchOne();

                    // Find evaluations for this FEN string
                    $sql = "SELECT 1 FROM evaluations.evaluation WHERE fen_id = :fen_id LIMIT 1";

                    $stmt = $this->conn->prepare($sql);
                    $stmt->bindValue('fen_id', $existingId);
                    $exists = $stmt->executeQuery()->fetchOne();

                    if (!$exists) {
                        $fenId = $existingId;
                    }
                }

                $fenIds[] = $fenId;

                //dd($fenId, $fenString);

                /*
                // Create the entity
                $fenEntity = new Fen();
                $fenEntity->setFen($fenString);
                $this->em->persist($fenEntity);
                // Flush to get the IDs
                $this->em->flush();                
                // Keep reference for the evals
                $fenEntities[] = $fenEntity;
                */
            } catch (\Doctrine\DBAL\Exception\UniqueConstraintViolationException $e) {
                //dd($processed, $fenString, $e->getMessage());
                // Just throw for now, I want to see when it happens..
                //throw $e;
                $uniqueErrors++;
                //dd("test");
                // Reset the EM safely
                //$this->em->getConnection()->rollBack(); // rollback failed transaction
                $this->em->close();                     // close the broken EM
                $this->em = $this->doctrine->resetManager(); // get a fresh, usable EM
                continue;
            } catch (\Doctrine\DBAL\Exception\ConnectionException $e) {
                dd($uniqueErrors, $e);
            }
        }

        //return [count($fensToFlush),$uniqueErrors];

        // stop the sub timer
        $this->timer->stopSub('InsertFens');

        // start the sub timer
        $this->timer->startSub('InsertEvals');

        //$this->conn->setAutoCommit(false);
        $this->conn->beginTransaction();

        $rolledBack = false;

        try {

        // Prepare the insert statement
        $sql = 'INSERT INTO evaluations.evaluation 
        (fen_id, uci, san, cp, mate, rank, line, depth, knodes, fidx, bytes)
        VALUES (:fen_id, :uci, :san, :cp, :mate, :rank, :line, :depth, :knodes, :fidx, :bytes)';
        $stmtInsert = $this->conn->prepare($sql);

        // Loop through batchMoves
        foreach ($batchMoves as $key => $movesToInsert) {

            // Get the FEN id
            
            //$fenId = $fenEntities[$key]->getId();
            $fenId = $fenIds[$key];

            if ($fenId == null) {
                $skipped++;
                continue;
            }

            $fenString = $fensToFlush[$key];

            //dd($fenId, $key, $movesToInsert, $json);

            // Insert each move
            $rank = 1;
            foreach ($movesToInsert as $pv) {

                try {

                $moves = explode(" ", $pv['line']);

                $uci = count($moves) > 0 ? $moves[0] : '';
                $san = ''; // convert to SAN if needed
                $scoreCp = $pv['cp'] ?? null;
                $scoreMate = $pv['mate'] ?? null;
                $line = $pv['line'] ?? '';
                $depth = $pv['depth'] ?? null;
                $knodes = $pv['knodes'] ?? null;

                $fidx = $pv['fidx'] ?? null;
                $bytes = $pv['bytes'] ?? null;

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

                // start the sub timer
                //$this->timer->startSub('GetFirstSanMove');

                // Get the SAN notation
                //$san = $this->chessHelper->getFirstSanMoveFromLine($chess, $fenString, $pv['line']);

                // end the sub timer
                //$this->timer->stopSub('GetFirstSanMove');

                //
                // Appearantly there are some chess960 evaluations in here..
                // If $san == null, we have an invalid move because of castling not possible..
                //
                //if ($uci == '' || $san == null || count($moves) == 0) {
                if ($uci == '' || count($moves) == 0) {
                    $skipped++;
                    continue;
                }

                // start the sub timer
                $this->timer->startSub('isLikelyStandard');

                // Attempt to filter out other variants
                if (!$this->chessHelper->isLikelyStandardChessFEN($fenString)) {

                    //dd("Not a standard chess game.", $json);
        
                    // stop the sub timer
                    $this->timer->stopSub('isLikelyStandard');

                    $skipped++;

                    continue;
                }

                // stop the sub timer
                $this->timer->stopSub('isLikelyStandard');

                //dd($uci,$san,$scoreCp,$scoreMate,$rank,$depth,$knodes,$fidx,$bytes);

                $stmtInsert->bindValue('fen_id', $fenId);
                $stmtInsert->bindValue('uci', $uci);
                //$stmtInsert->bindValue('san', $san);
                $stmtInsert->bindValue('san', '');
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

            } catch (\Throwable $e) {
                dd($e, $fenId, $key, $movesToInsert);
            }
            }

            

            $processed++;
        }
    } catch (\Throwable $e) {
        $rolledBack = true;
        $this->conn->rollback();

        dd("rolled back", $e);
    }

        if (!$rolledBack) {
            $this->conn->commit();
        }
        // stop the sub timer
        $this->timer->stopSub('InsertEvals');

        // temp..
        $processed = count($fensToFlush);

        return [$processed,$skipped];
    }

    private function getCurrentEvaluationsFile()
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

        return [$fidx, $bytes];
    }

    public function parseEvalsJson($filePath, $bytesToSkip = 0, $maxLines = 5000)
    {
        $i = 0;

        if (file_exists($filePath)) {

            //print "File open: " . $filePath . " ($bytes)<br>";

            $handle = fopen($filePath, "r");
            fseek($handle, $bytesToSkip, SEEK_SET);

            $fsize = filesize($filePath);

            while (($line = fgets($handle, 8192)) !== false) {

                $bytesToSkip += strlen($line);

                // When reading files line-by-line, there is a \n at the end, so remove it.
                $line = trim($line);
                if (empty($line)) {

                    continue;
                }

                yield [$line, $bytesToSkip, $fsize];

                $i++;

                if ($i >= $maxLines) {
                    break;
                }
            }

            fclose($handle);
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
        // start the timer
        $this->timer->startProcess();

        ini_set('memory_limit', '2G');

        $files = ['./lichess_elite_2025-05.pgn'];
        $filePath = $files[0];

        $totals = [];
        $gameCount = 0;
        $moveCount = 0;
        $processCount = 0;
        $queryCount = 0;
        $bytesReadTotal = 0;

        $movesNotToMakeTotal = 0;
        $fensNotExportedTotal = 0;
        
        $batchSize = $limit;

        // Get the import log repo
        $importLogRepo = $this->em->getRepository(ImportLog::class);

        // Create the FastChessJs instance
        $fastChessJs = new FastChessJs();

        foreach ($files as $file) {
            
            // start the sub
            $this->timer->startSub('ImportLog');

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

            // stop the sub
            $this->timer->stopSub('ImportLog');

            // If this file is finished, continue to the next
            if ($log->isFinished()) {
                continue;
            }

            // Keep track of game count for this file
            $fileGameCount = 0;
            $gamesRead = $log->getGamesRead();

            //
            $this->timer->startSub('parsePgn');

            $items = [];

            // Parse the PGN files
            foreach ($this->myPgnParser->parsePgn($file, false, $limit, $skip, $this->timer) as $item) {

                $items[] = $item;

                //
                $this->timer->stopSub('parsePgn');

                set_time_limit(300);

                $game = $item['game'];
                $bytesReadTotal = $item['bytesRead'];

                // start the sub
                $this->timer->startSub('processGame');

                [$movesNotToMake, $fensNotExported] = $this->processGame($game, $fastChessJs, $totals, $moveCount);
                
                $movesNotToMakeTotal += $movesNotToMake;
                $fensNotExportedTotal += $fensNotExported;

                // stop the sub
                $this->timer->stopSub('processGame');

                $gameCount++;
                $fileGameCount++;

                if ($gameCount % $batchSize === 0) {
                    // start the sub
                    $this->timer->startSub('processMoves');

                    $queryCount += $this->processMoves($totals);
                    $processCount++;

                    // stop the sub
                    $this->timer->stopSub('processMoves');

                    //
                    $this->timer->startSub('PersistFlush');

                    // Update import log
                    $log->setGamesRead($gamesRead + $gameCount);

                    // Persist and flush
                    $this->em->persist($log);
                    $this->em->flush();

                    //
                    $this->timer->stopSub('PersistFlush');

                    $totals = [];
                    gc_collect_cycles();
                }

                //
                $this->timer->startSub('UnsetGame');

                unset($game);

                //
                $this->timer->stopSub('UnsetGame');

                //
                $this->timer->startSub('parsePgn');
            }

            //dd($items);

            //
            $this->timer->stopSub('parsePgn');

            // flush leftover totals
            if (!empty($totals)) {
                // start the sub
                $this->timer->startSub('processMoves');

                $queryCount += $this->processMoves($totals);
                $processCount++;

                // stop the sub
                $this->timer->stopSub('processMoves');

                //
                $this->timer->startSub('UnsetTotalsCollect');
                $this->timer->startSub('UnsetCollect');

                $totals = [];
                gc_collect_cycles();

                //
                $this->timer->stopSub('UnsetTotalsCollect');
                $this->timer->stopSub('UnsetCollect');

            }

            //
            $this->timer->startSub('PersistFlush');

            // Update the import log
            $log->setGamesRead($gamesRead + $gameCount);
            $log->setFinished($fileGameCount == 0);

            // Persist and flush
            $this->em->persist($log);
            $this->em->flush();

            //
            $this->timer->stopSub('PersistFlush');
        }

        $fileSize = filesize($filePath);
        $percentageComplete = round(($bytesReadTotal / $fileSize) * 100, 2);

        // end the timer
        $this->timer->endProcess();

        return new JsonResponse([
            "processed" => $gameCount,
            "moveCount" => $moveCount,
            "processCount" => $processCount,
            "queryCount" => $queryCount,
            "fileSize" => $fileSize,
            "bytesRead" => $bytesReadTotal,
            "skip" => $skip,
            "percentageComplete" => $percentageComplete,
            "fileIndex" => 0,
            "movesNotToMake" => $movesNotToMakeTotal,
            "fensNotExportedTotal" => $fensNotExportedTotal,
            "fenDict" => $this->fenDict,
            "timer" => $this->timer->getReport()
        ]);
    }

    private function processGame($game, $fastChessJs, array &$totals, int &$moveCount): array
    {

        // start the sub
        //$this->timer->startSub('ChessFen');

        //$fen = new ChessFEN();
        //$fastFen = new FastFen();

        // stop the sub
        //$this->timer->stopSub('ChessFen');

        //
        $this->timer->startSub('getMovesArray');

        //$moves = $game->getMovesArray();
        $moves = $game["moves"];

        // total moves? 30 = 15 moves deep only..
        $maxMoves = min(30, count($moves));

        /*

        What do we need the game for?

        - moves array - check for san or whatever?
        - result - win/draw/loss
        - ??

        That's it, we get the FEN from ChessFEN and making the moves.

        So if we get the moves straight from the PGN (SAN moves, which is fine, 
        no need to use a game object to get the SAN moves)

        We just need the result, which I think we can get quite easily.. ?

        */

        // TESTING
        //$this->timer->debugVar("movesArray", $moves);

        //
        $this->timer->stopSub('getMovesArray');

        //
        $this->timer->startSub('PrepareInsert');

        // normalize result
        $map = ['1-0' => 'w', '0-1' => 'b', '1/2-1/2' => 'd'];
        
        //$result = $map[$game->getResult()] ?? '';
        $result = $map[$game['result']] ?? '';

        // prepare FEN insert statement once
        $stmtInsertFen = $this->conn->prepare(
            'INSERT INTO fen (fen) VALUES (:fen)'
        );

        $chessJs = new ChessJs();

        // Reset the FastChessJs instance
        $fastChessJs->reset();

        //
        $fenBefore = $chessJs->fen();
        // Normalize the FEN string for move stats
        $fenBefore = $this->chessHelper->normalizeFenForMoveStats($fenBefore);

        $movesNotToMake = 0;
        $fensNotExported = 0;
        $lastMove = "";
        $lastMoveMade = false;

        // Prepare the find FEN
        $stmtFindFen = $this->conn->prepare('SELECT id FROM fen WHERE fen = :fen');

        
        $updater = new FastSanParser();


        $fens = [
            'ChessJs' => [],
            'FastSan' => [],
            'FastFen' => [],
            'FEN' => []
        ];

        $lastFromTo = [];

        //
        $this->timer->startSub('PrepareInsert');

        for ($i = 0; $i < $maxMoves; $i++) {
            $move = $moves[$i] ?? '';
            if ($move === '') continue;

            // start the sub
            //$this->timer->startSub('FenExport');

            /*
            //
            if ($fenBefore !== '' && isset($this->fenDict[$fenBefore])) {
                //
                if (false && isset($this->fenDict[$fenBefore][$move]) && $this->fenDict[$fenBefore][$move] !== '') {
                    $this->timer->startSub('FenGetDict');
                    $fenstr = $this->fenDict[$fenBefore][$move];
                    $this->timer->stopSub('FenGetDict');

                    //dd($move, $fenBefore, $this->fenDict);

                    $fensNotExported++;

                    //dd("FenFromDict", $fenstr, $this->fenDict);
                } else {
                    //$this->timer->startSub('FenExportAndMove');
                    //$fenstr = $fen->export();
                    //$this->timer->stopSub('FenExportAndMove');

                    $this->timer->startSub('ChessJsGetFen');
                    $fenstr = $chessJs->fen();
                    $this->timer->stopSub('ChessJsGetFen');

                    //if ($fenstr != $fenstr2) {
                      //  dd($fenstr, $fenstr2, $fen, $chessJs);
                    //}

                    //$this->fenDict[$fenBefore][$move] = $fenstr;

                    //dd($fenDict);
                }
            } else {
                //$this->timer->startSub('FenExportAndMove');
                //$fenstr = $fen->export();
                //$this->timer->stopSub('FenExportAndMove');

                $this->timer->startSub('ChessJsGetFen');
                $fenstr = $chessJs->fen();
                $this->timer->stopSub('ChessJsGetFen');

                //if ($fenstr != $fenstr2) {
                  //  dd($fenstr, $fenstr2, $fen, $chessJs);
                //}
            }
                */

            $this->timer->startSub('FastChessJsGetFen');
            $fenstr = $fastChessJs->fen();
            //$fenstr5 = $this->chessHelper->normalizeFenForMoveStats($fenstr5);
            $this->timer->stopSub('FastChessJsGetFen');


            //$fenstr = $fen->export();
            
            //
            //$this->timer->stopSub('FenExport');

            //
            $this->timer->startSub('normalizeForMoveStats');

            // Normalize the FEN string for move stats
            $fenstr = $this->chessHelper->normalizeFenForMoveStats($fenstr);

            //$fenstr2 = $updater->getFen();
            //$fenstr2 = $this->chessHelper->normalizeFenForMoveStats($fenstr2);

            //
            $this->timer->stopSub('normalizeForMoveStats');

            /*
            $this->timer->startSub('FEN-export');
            $fenstr4 = $fen->export();
            $this->timer->stopSub('FEN-export');

            $this->timer->startSub('FastFen-export');
            $fenstr3 = $fastFen->export();
            $this->timer->stopSub('FastFen-export');

            $fenstr3 = $this->chessHelper->normalizeFenForMoveStats($fenstr3);
            $fenstr4 = $this->chessHelper->normalizeFenForMoveStats($fenstr4);
            */


            //$fens['ChessJs'][] = $fenstr;
            //$fens['FastChessJs'][] = $fenstr;

            //$fens['FastSan'][] = $fenstr2;

            //$fens['FastFen'][] = $fenstr3;
            //$fens['FEN'][] = $fenstr4;

           // if ($fenstr5 != $fenstr) {
                //dd("DIFFER", $fenBefore, $fenstr, $fenstr5, $fastFen->export(), $i, $lastFromTo, $move, $moves);
           // }


            //
            if ($fenBefore != '' && $lastMove != '') {
                $this->fenDict[$fenBefore][$lastMove] = $fenstr;
            }

            //
            $this->timer->startSub('FindFen');

            // assign or retrieve FEN ID
            if (!isset($this->fenDict[$fenstr])) {

                // check database first
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
                //$this->fenDict[$fenstr] = $fenId;
                $this->fenDict[$fenstr] = [
                    'id' => $fenId,
                    $move => ''
                ];
            } else {
                //$fenId = $this->fenDict[$fenstr];
                $fenId = $this->fenDict[$fenstr]['id'];
            }

            //
            $this->timer->stopSub('FindFen');

            //
            $this->timer->startSub('StoreTotals');

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

            //
            $this->timer->stopSub('StoreTotals');

            // Remember fen before this move so we can look it up
            $fenBefore = $fenstr;

            //
            //$this->timer->startSub('FenExportAndMove');
            //$fen->move($move);
            //$this->timer->stopSub('FenExportAndMove');

            // If we already have the FEN after this move
            if (isset($this->fenDict[$fenstr][$move]) && $this->fenDict[$fenstr][$move] != "") {
                $movesNotToMake++;

                //$this->timer->startSub('ChessJsLoadFen');
                //$chessJs->load($this->fenDict[$fenstr][$move]." - 0 1");
                //$this->timer->stopSub('ChessJsLoadFen');

                $this->timer->startSub('FastChessJsLoadFen');
                $fastChessJs->load($this->fenDict[$fenstr][$move]." - 0 1");
                $this->timer->stopSub('FastChessJsLoadFen');
            } else {
            
                //$this->timer->startSub('ChessJsMakeMove');
                //$chessJs->move($move);
                //$this->timer->stopSub('ChessJsMakeMove');

                $this->timer->startSub('FastChessJsMakeMove');
                $fastChessJs->move($move);
                $this->timer->stopSub('FastChessJsMakeMove');
           
                $lastMoveMade = true;
            }


            /*
            //$this->timer->startSub('FastSanMove');
            $this->timer->startSub('FastFen-move');
            try {
                //$lastFromTo = $updater->getFromTo($move);
                $fastFen->move($move);
            } catch (\Throwable $e) {
                dd("Exception-1", $e, $moves, $fenstr, $move);
            }
            //$this->timer->stopSub('FastSanMove');
            $this->timer->stopSub('FastFen-move');

            $this->timer->startSub('FEN-move');
            try {
                //$lastFromTo = $updater->getFromTo($move);
                $fen->move($move);
            } catch (\Throwable $e) {
                dd("Exception-2", $e, $moves, $fenstr, $move);
            }
            //$this->timer->stopSub('FastSanMove');
            $this->timer->stopSub('FEN-move');
            */


            $lastMove = $move;

            $moveCount++;
        }

        //if (count($moves) > 0) {
            //dd($moves, $this->fenDict);
        //}

        //if ($movesNotToMake > 0) {
            //dd("MovesNotToMake", $movesNotToMake, $this->fenDict);
        //}

        //
        //$this->timer->startSub('UnsetCollect');

        //unset($fen, $moves);
        //gc_collect_cycles();

        //
        //$this->timer->stopSub('UnsetCollect');

        return [$movesNotToMake, $fensNotExported];
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
