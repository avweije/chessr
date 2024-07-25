<?php

namespace App\Controller;

use App\Entity\ECO;
use App\Library\GameDownloader;
use App\Repository\ECORepository;
use App\Service\MyPgnParser\MyPgnParser;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Onspli\Chess\FEN;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
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
        $pgn = "1. e4 c5 2. c3 d5";

        $code = $this->em->getRepository(ECO::class)->findCodeByPgn($pgn);

        return $this->render('admin/index.html.twig', [
            'controller_name' => 'AdminController',
        ]);
    }

    #[Route('/admin/import', name: 'app_admin_import')]
    public function import()
    {

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

    public function importPgnFiles()
    {
        // set the upload folder
        $folder = './build/uploads/';

        // done
        //$files = ['lichess_elite_2023-01-1st-500k-lines.pgn'];
        //$files = ['lichess_elite_2023-01-500k-b.pgn'];
        //$files = ['lichess_elite_2023-01-500k-c.pgn'];
        //$files = ['lichess_elite_2023-01-500k-d.pgn'];
        //$files = ['lichess_elite_2023-01-500k-e.pgn'];
        //$files = ['lichess_elite_2023-01-500k-f.pgn'];
        //$files = ['lichess_elite_2023-01-500k-g.pgn'];
        //$files = ['lichess_elite_2023-01-500k-h.pgn'];


        // todo
        $files = [];

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
                if ($gameCount % 50000 == 0) {
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
        $sql = 'UPDATE moves SET wins = :wins, draws = :draws, losses = :losses WHERE fen = :fen AND move = :move';
        $stmtUpdate = $this->conn->prepare($sql);

        //$repository = $this->em->getRepository(Moves::class);
        $i = 0;
        $queryCount = 0;

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
                    $stmtUpdate->bindValue('fen', $fen);
                    $stmtUpdate->bindValue('move', $move);
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
            }

            $i++;
        }

        // free memory
        gc_collect_cycles();

        return $queryCount;
    }

    // returns the duration in text, based off of microseconds
    public function getDuration($ms)
    {
        $seconds = round($ms, 3);

        print "-- duration: $ms -- --";


        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds - $hours * 3600) / 60);
        $seconds = floor($seconds - ($hours * 3600) - ($minutes * 60));

        return ($hours > 0 ? $hours . "h " : "") . ($hours > 0 || $minutes > 0 ? $minutes . "m " : "") . $seconds . "s";
    }
}
