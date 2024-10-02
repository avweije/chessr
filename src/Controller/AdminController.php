<?php

namespace App\Controller;

use App\Service\MyPgnParser\MyPgnParser;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Onspli\Chess\FEN;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class AdminController extends AbstractController
{
    private $em;
    private $conn;
    private $myPgnParser;

    public function __construct(Connection $conn, EntityManagerInterface $em, MyPgnParser $myPgnParser)
    {
        $this->em = $em;
        $this->myPgnParser = $myPgnParser;
        $this->conn = $conn;
    }

    #[Route('/admin', name: 'app_admin')]
    public function index(): Response
    {

        if (false) {
            //$this->split_file();
            /*
            $sql = 'SELECT * FROM evaluations.evaluation ORDER BY id DESC LIMIT 1';
            $stmtFind = $this->conn->prepare($sql);

            $result = $stmtFind->executeQuery();

            $item = $result->fetchAssociative();

            // if the move exists
            if ($item == false) {
                print "Max record not found.<br>";
                exit;
            }

            $bytes = $item['bytes2'];
            */
        }

        if (false) {

            print "Updating FEN<br>";

            $fen = "r1bqkb1r/pp2nppp/2n1p3/3pP3/3P4/5N2/PP3PPP/RNBQKB1R w KQkq -";

            $this->updateEvals($fen);

            exit;
        }

        if (false) {

            print "Updating all single evals:<br>";

            $this->updateSingleEvals();

            exit;
        }

        return $this->render('admin/index.html.twig');
    }

    #[Route('/admin/evaluations/update', methods: ["POST"], name: 'app_admin_evaluations_update')]
    public function updateEvaluationFen(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        //dd($data);

        $startId = intval($data["startId"]);
        $batchSize = intval($data["batchSize"]);

        // max 5 minutes
        set_time_limit(60 * 5);

        $this->conn->setAutoCommit(true);

        // prepare the insert statement
        $sql = 'UPDATE evaluations.evaluation SET fen_vchar = fen WHERE id >= :startId AND id <= :endId';
        $stmtUpdate = $this->conn->prepare($sql);

        $stmtUpdate->bindValue('startId', $startId);
        $stmtUpdate->bindValue('endId', $startId + $batchSize);

        $affected = $stmtUpdate->executeStatement();

        //print "Record updated: $affected<br>";

        // perform commit
        //$this->conn->commit();

        return new JsonResponse([
            "processed" => $batchSize,
            "affected" => $affected,
            "percentageComplete" => 0
        ]);
    }

    #[Route('/admin/evaluations/import', methods: ["POST"], name: 'app_admin_evaluations_import')]
    public function importEvaluations(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        $maxLines = intval($data["maxLines"]);
        $batchSize = intval($data["batchSize"]);

        //dd($data);

        //$usage = round(memory_get_usage() / 1024 / 1024, 2);

        //print "Memory usage: $usage<br>";

        $time = time();

        $processed = 0;
        $bytes = 0;
        $lastFidx = 0;
        $lastPct = 0;

        for ($i = 0; $i < 1; $i++) {
            [$lines, $bytes, $lastFidx, $lastPct] = $this->parseEvals($maxLines, $batchSize);

            $processed += $lines;
        }

        //$file = './lichess_db_eval.jsonl';

        //$fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -";

        //$temp = $this->findEvaluation($file, $fen);

        $seconds = time() - $time;
        //
        //$duration = $this->getDuration($seconds * 1000);
        $duration = $this->getDuration($seconds);

        //print "Duration: $duration<br>";

        //print $processed . " items processed.<br>";

        //$fsize = filesize('./lichess_db_eval.jsonl');

        //$percentageComplete = round(($bytes / $fsize) * 100, 2);

        //print round(($bytes / $fsize) * 100, 2) . "% done.<br>";


        //$usage = round(memory_get_usage() / 1024 / 1024, 2);

        //print "Memory usage: $usage<br>";

        return new JsonResponse([
            "processed" => $processed,
            "percentageComplete" => $lastPct,
            "fileIndex" => $lastFidx
        ]);
    }

    private function updateSingleEvals(): bool
    {

        $max = 10000;
        $singles = 0;
        $i = 0;

        $sql = 'SELECT * FROM evaluations.evaluation ORDER BY id LIMIT ' . $max;
        $stmtFind = $this->conn->prepare($sql);

        $result = $stmtFind->executeQuery();

        while (($rec = $result->fetchAssociative()) !== false) {
            $pvs = json_decode($rec["pvs"]);
            if (count($pvs) == 1) {
                $singles++;
            }
            $i++;
            if ($i >= $max) {
                break;
            }
        }

        print $singles . " singles found in " . $max . " records.<br>";

        return true;
    }

    private function updateEvals($fen): bool
    {

        //[$fidx, $bytes, $json] = $this->findEvaluation($item["fen"]);
        [$fidx, $bytes, $json] = $this->findEvaluation($fen);

        // old version - use just the top depth pvs (sometimes gives only 1 line)
        $deepest = null;
        foreach ($json["evals"] as $eval) {
            if ($deepest == null || $eval["depth"] > $deepest["depth"]) {
                $deepest = $eval;
            }
        }

        // new version - get up to 3 lines across all depth pvs (to ensure more than 1 line)
        $evals = $json["evals"];

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
                $firstmove = explode(" ", $pv["line"])[0];
                if (!in_array($firstmove, $firstmoves)) {
                    $firstmoves[] = $firstmove;
                    $pvs[] = $pv;

                    // if we have 3 lines from the top eval or 5 lines from the top 2
                    if (($evcnt == 0 && count($pvs) >= 3) || ($evcnt == 1 && count($pvs) >= 5)) {
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


        //if ($deepest !== null) {
        if (count($pvs) > 0) {

            $sql = 'SELECT * FROM evaluations.evaluation WHERE fen = :fen';
            $stmtFind = $this->conn->prepare($sql);

            $stmtFind->bindValue('fen', $fen);

            $result = $stmtFind->executeQuery();

            $recs = [];
            $id = -1;

            while (($rec = $result->fetchAssociative()) !== false) {
                if ($rec["fen"] == $fen) {
                    $rec["found"] = true;
                    $id = $rec["id"];
                }
                $recs[] = $rec;
            }

            // dd($id, $recs, $pvs);

            if ($id == -1) {
                print "Record not found.<br>";

                return false;
            }

            // prepare the insert statement
            $sql = 'UPDATE evaluations.evaluation SET pvs = :pvs WHERE id = :id';
            $stmtUpdate = $this->conn->prepare($sql);

            $stmtUpdate->bindValue('id', $id);
            //$stmtUpdate->bindValue('fen', $json["fen"]);
            //$stmtInsert->bindValue('pvs', json_encode($deepest["pvs"]));
            $stmtUpdate->bindValue('pvs', json_encode($pvs));

            $affected = $stmtUpdate->executeStatement();

            print "Record updated: $affected<br>";

            // perform commit
            //$this->conn->commit();
        }

        return true;
    }

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

    private function parseEvals($maxLines = 5000, $batchSize = 1000)
    {
        $pgn = "1. e4 c5 2. c3 d5";

        //$code = $this->em->getRepository(ECO::class)->findCodeByPgn($pgn);

        //$file = './build/uploads/lichess_db_eval.jsonl';
        $file = './lichess_db_eval.jsonl';
        $evals = [];

        $processed = 0;
        $lastBytes = 0;
        $lastPct = 0;
        $lastFidx = 0;

        //$sql = 'ALTER INSTANCE DISABLE INNODB REDO_LOG;';
        //$stmtRedo = $this->conn->prepare($sql);
        //$stmtRedo->executeStatement();

        /*
        $sql = "SELECT * FROM performance_schema.global_status WHERE variable_name = 'innodb_redo_log_enabled'";
        $stmtRedo = $this->conn->prepare($sql);

        $result = $stmtRedo->executeQuery();

        $item = $result->fetchAssociative();

        dd($item);
        */

        // auto-commit off
        $this->conn->setAutoCommit(false);
        $this->conn->beginTransaction();

        // 
        // 

        // prepare the insert statement
        $sql = 'INSERT INTO evaluations.evaluation ( fen, evals, bytes, fidx ) VALUES ( :fen, :evals, :bytes, :fidx )';
        //$sql = 'INSERT INTO evaluations.evaluation_1 ( fen, evals, bytes, fidx ) VALUES ( :fen, :evals, :bytes, :fidx )';
        $stmtInsert = $this->conn->prepare($sql);

        foreach ($this->parseEvalsJson($file, $maxLines) as [$fidx, $line, $bytes, $fsize]) {
            // add to time limit
            set_time_limit(300);

            //dd($line, $bytes);

            $lastBytes = $bytes;
            $lastFidx = $fidx;
            $lastPct = round(($bytes / $fsize) * 100, 2);

            // get the deepest pv
            $json = json_decode($line, true);

            //dd($json);

            if ($json == null) {
                print "Json = null<br>";
                print $line . "<br>";

                continue;
            }

            /*
            // old version - use just the top depth pvs (sometimes gives only 1 line)
            $deepest = null;
            foreach ($json["evals"] as $eval) {
                if ($deepest == null || $eval["depth"] > $deepest["depth"]) {
                    $deepest = $eval;
                }
            }

            // new version - get up to 3 lines across all depth pvs (to ensure more than 1 line)
            $evals = $json["evals"];

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
                    $firstmove = explode(" ", $pv["line"])[0];
                    if (!in_array($firstmove, $firstmoves)) {
                        $firstmoves[] = $firstmove;
                        $pvs[] = $pv;

                        // if we have 3 lines from the top eval or 5 lines from the top 2
                        if (($evcnt == 0 && count($pvs) >= 3) || ($evcnt == 1 && count($pvs) >= 5)) {
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


            //if ($deepest !== null) {
            if (count($pvs) > 0) {
            */

            $evals = json_encode($json["evals"]);

            if (strlen($evals) >= 8192) {

                // commit inserts up till now..
                $this->conn->commit();

                print "evals string larger than 8192 (column size) - exiting import..";

                // exit program..
                exit;
            }
            //8192

            $stmtInsert->bindValue('fen', $json["fen"]);
            //$stmtInsert->bindValue('knodes', $deepest["knodes"]);
            //$stmtInsert->bindValue('depth', $deepest["depth"]);
            //$stmtInsert->bindValue('pvs', json_encode($deepest["pvs"]));
            //$stmtInsert->bindValue('pvs', json_encode($pvs));
            $stmtInsert->bindValue('evals', $evals);
            $stmtInsert->bindValue('bytes', $bytes);
            $stmtInsert->bindValue('fidx', $fidx);

            $affected = $stmtInsert->executeStatement();

            $processed++;

            //print "Record added: $fidx - $bytes<br>";

            // perform commit
            if ($processed % $batchSize == 0) {
                $this->conn->commit();
                //$this->conn->beginTransaction();
            }

            //dd($evals);
            //exit;
            //}

            //$evals[] = json_decode($eval, true);
            //$evals[] = $eval;
        }

        // perform final commit
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

            //dd($bytes, $fsize);

            while (($line = fgets($handle, 8192)) !== false) {

                // print "LINE-$i: " . $line . "<br>";

                //dd($fidx, $bytes, json_decode($line, true));
                //if ($bytes)
                $bytes += strlen($line);
                //$bytes = bcadd($bytes, strlen($line));
                //$bytes = ftell($handle);


                //dd($line, strlen($line), $bytesPrev, $bytes);

                //if ($i == 2) {
                //  print "bytes for 3 lines: " . $bytes . "<br>";
                //}

                //if ($i == 4) {
                //  exit;
                //}

                // When reading files line-by-line, there is a \n at the end, so remove it.
                $line = trim($line);
                if (empty($line)) {

                    continue;
                }

                //print "Line $i ($maxLines)<br>";

                //$buffer .= $line . "\n";

                yield [$fidx, $line, $bytes, $fsize];

                $i++;

                if ($i >= $maxLines) {
                    break 2;
                }

                //if ($bytes >= $maxBytes) {
                //break;
                //}
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


    #[Route('/admin/import', name: 'app_admin_import')]
    public function import()
    {

        if (false) {

            $this->splitPgnFile("./lichess_elite_2023-04.pgn");

            exit;
        }

        //exit;

        gc_enable();

        gc_collect_cycles();

        //exit;


        $time = time();


        // process the games from the pgn files and import the move totals
        $this->importPgnFiles();

        $seconds = time() - $time;

        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds - $hours * 3600) / 60);
        $seconds = floor($seconds - ($hours * 3600) - ($minutes * 60));

        print "Duration of the script: " . $hours . "h " . $minutes . "m " . $seconds . "s<br>";

        gc_collect_cycles();

        exit;
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

    public function importPgnFiles()
    {
        // set the upload folder
        $folder = './';

        // done
        //$files = ['./lichess_elite_2023-02-?.pgn'];
        //$files = ['./lichess_elite_2023-03-?.pgn'];
        //$files = ['./lichess_elite_2023-04-?.pgn'];

        // todo

        //$files = ['./lichess_elite_2023-05-1.pgn'];
        //$files = ['./lichess_elite_2023-05-1.pgn', './lichess_elite_2023-05-2.pgn'];

        exit;

        /*

        - DO NOT SAVE TO DATABASE IF ONLY 1 GAME PLAYED!!
        - IF WE DO THIS PER 18K GAMES, WE SAVE 80% OR MORE
        - WILL BE MUCH FASTER.

        */


        $totals = [];

        //
        $gameCount = 0;
        $moveCount = 0;
        $processCount = 0;
        $queryCount = 0;

        //$batchSize = 50000;
        $batchSize = 25000;

        // loop through the files
        foreach ($files as $file) {
            foreach ($this->myPgnParser->parsePgn($folder . $file) as $game) {
                // reset the time limit so we don't timeout on large files
                set_time_limit(300);

                // process the game, pass the totals & movecount as reference
                $this->processGame($game, $totals, $moveCount);

                $gameCount++;

                //$usage = memory_get_usage() / 1024 / 1024;

                // every 50k games or when memory is low
                //if ($usage > 256 || $gameCount % 50000 == 0) {
                if ($gameCount % $batchSize == 0) {
                    // process the moves
                    $cnt = $this->processMoves($totals);

                    $queryCount = $queryCount + $cnt;

                    $processCount++;

                    // free the memory
                    $totals = [];
                }
            }
        }

        // process the moves that haven't been processed yet
        if (count($totals) > 0) {
            // process the moves
            $cnt = $this->processMoves($totals);

            $queryCount = $queryCount + $cnt;

            $processCount++;

            // free the memory
            $totals = [];
        }

        print $gameCount . " games processed.<br>";
        print $moveCount . " moves processed.<br>";
        print $processCount . " calls to the processMoves function.<br>";
        print $queryCount . " number of queries executed.<br>";

        $usage = memory_get_usage() / 1024 / 1024;

        print "Memory usage: " . round($usage, 2) . "mb<br>";
    }

    private function processGame($game, &$totals, &$moveCount)
    {
        // get the FEN parser
        $fen = new FEN();

        //
        $white = true;

        //print $fen->export() . "<br>";

        //print "<br>result: " . $game->getResult() . "<br>";

        $result = '';

        switch ($game->getResult()) {
            case '1-0':
                $result = 'w';
                break;
            case '0-1':
                $result = 'b';
                break;
            case '1/2-1/2':
                $result = 'd';
                break;
        }

        //print "result: " . $result . "<br>";

        //
        $moves = $game->getMovesArray();

        //
        // only take the 1st X moves ??
        //
        // we don't need all moves in all positions
        //
        // the 1st 20 is probably enough???
        //
        // we are talking about halfmoves, so 20-30 ??
        //

        $maxMoves = 20;
        $pgn = "";

        for ($i = 0; $i < min($maxMoves, count($moves)); $i++) {

            // safety check, encountered empty moves?
            if ($moves[$i] == "") {
                continue;
            }

            //
            // save to database: fen, move, result
            //

            // get the fen
            $fenstr = $fen->export();

            // store all in array, save once per file ? - testing..
            if (!isset($totals[$fenstr])) {
                //$totals[$fenstr] = ['pgn' => $pgn];
                $totals[$fenstr] = [];
            }

            //
            if (!isset($totals[$fenstr][$moves[$i]])) {
                $totals[$fenstr][$moves[$i]] = [0, 0, 0];
            }

            //
            // update the totals
            if ($result == 'd') {
                $totals[$fenstr][$moves[$i]][1]++;
                //} else if (($white && $result == 'w') || (!$white && $result == 'b')) {
            } else if ($result == 'w') {
                $totals[$fenstr][$moves[$i]][0]++;
                //} else if (($white && $result == 'b') || (!$white && $result == 'w')) {
            } else if ($result == 'b') {
                $totals[$fenstr][$moves[$i]][2]++;
            }


            // make the move
            $fen->move($moves[$i]);

            // add to the pgn
            $pgn .= ($pgn != "" ? " " : "") . ($i % 2 == 0 ? ($i / 2 + 1) . ". " : "") . $moves[$i];

            $white = !$white;

            $moveCount++;
        }

        $fen = null;
    }

    private function processMoves($moves): int
    {


        //if (!$this->conn->isConnected()) {
        //  $this->conn->connect();
        //}

        //$em = $this->doctrine->getManager();
        //$repo = $em->getRepository('App\Entity\Moves');

        //$repo->persist();

        //$conn = $this->em->getConnection();
        //$conn = $repo->getConnection();

        // prepare the select statement
        $sql = 'SELECT * FROM moves WHERE fen = :fen AND move = :move';
        $stmtFind = $this->conn->prepare($sql);

        // prepare the insert statement
        $sql = 'INSERT INTO moves ( fen, move, wins, draws, losses ) VALUES ( :fen, :move, :wins, :draws, :losses )';
        $stmtInsert = $this->conn->prepare($sql);

        // prepare the update statement
        //$sql = 'UPDATE moves SET wins = :wins, draws = :draws, losses = :losses WHERE fen = :fen AND move = :move';
        $sql = 'UPDATE moves SET wins = :wins, draws = :draws, losses = :losses WHERE id = :id';
        $stmtUpdate = $this->conn->prepare($sql);

        //$repository = $this->em->getRepository(Moves::class);
        $i = 0;
        $queryCount = 0;

        $batchSize = 1000;

        $this->conn->setAutoCommit(false);
        $this->conn->beginTransaction();

        foreach ($moves as $fen => $fenMoves) {
            // reset the time limit so we don't timeout on large files
            set_time_limit(300);

            foreach ($fenMoves as $move => $score) {

                // skip the 'pgn' field, not an actual move..
                if ($move == 'pgn') {
                    continue;
                }

                //
                // IF ONLY 1 GAME, SKIP AND DON'T SAVE..
                //
                if ($score[0] + $score[1] + $score[2] < 2) {
                    continue;
                }

                //

                $queryCount++;

                //continue;

                $stmtFind->bindValue('fen', $fen);
                $stmtFind->bindValue('move', $move);

                $result = $stmtFind->executeQuery();

                $item = $result->fetchAssociative();

                // if the move exists
                if ($item == false) {
                    //
                    $stmtInsert->bindValue('fen', $fen);
                    $stmtInsert->bindValue('move', $move);
                    //
                    $stmtInsert->bindValue('wins', $score[0]);
                    $stmtInsert->bindValue('draws', $score[1]);
                    $stmtInsert->bindValue('losses', $score[2]);
                    //
                    $affected = $stmtInsert->executeStatement();

                    //
                    if ($affected == 0) {

                        print "-- No rows affected rows after insert:<br>";

                        print "fen: " . $fen . "<br>";
                        print "move: " . $move . "<br>";
                        //exit;
                    }
                } else {
                    //
                    $stmtUpdate->bindValue('id', $item["id"]);
                    //$stmtUpdate->bindValue('fen', $fen);
                    //$stmtUpdate->bindValue('move', $move);
                    //
                    $stmtUpdate->bindValue('wins', $item['wins'] + $score[0]);
                    $stmtUpdate->bindValue('draws', $item['draws'] + $score[1]);
                    $stmtUpdate->bindValue('losses', $item['losses'] + $score[2]);
                    //
                    $affected = $stmtUpdate->executeStatement();

                    //
                    if ($affected == 0) {

                        print "No rows affected rows after update:<br>";

                        print "fen: " . $fen . "<br>";
                        print "move: " . $move . "<br>";
                        //exit;
                    }
                }

                if ($queryCount % $batchSize == 0) {
                    $this->conn->commit();
                }
            }

            $i++;
        }

        $this->conn->commit();

        // free memory
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
