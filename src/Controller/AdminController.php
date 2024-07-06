<?php

namespace App\Controller;

use AmyBoyd\PgnParser\Game;
use App\Entity\Moves;
use App\Service\MyPgnParser;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManager;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;
use Onspli\Chess\FEN;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

class AdminController extends AbstractController
{
    private $em;
    private $doctrine;
    private $conn;
    private $myPgnParser;

    public function __construct(Connection $conn, ManagerRegistry $doctrine, EntityManagerInterface $em, MyPgnParser $myPgnParser)
    {
        $this->em = $em;
        $this->myPgnParser = $myPgnParser;
        $this->doctrine = $doctrine;
        $this->conn = $conn;

        // disable the logger for this process
        //$this->em->getConnection()->getConfiguration()->setMiddlewares([new \Doctrine\DBAL\Logging\Middleware(new \Psr\Log\NullLogger())]);
        //$this->conn->getConfiguration()->setMiddlewares([new \Doctrine\DBAL\Logging\Middleware(new \Psr\Log\NullLogger())]);

        //$config = $this->conn->getConfiguration();
        //$config->set
    }

    #[Route('/admin', name: 'app_admin')]
    public function index(): Response
    {

        // test PGN parser


        //$repository = $this->em->getRepository(Moves::class);

        // set memory limit
        //ini_set('memory_limit', '512M');

        // set the upload folder
        $folder = './build/uploads/';
        // set the PGN files array
        $files = ['lichess_elite_2023-01-1st-10-games.pgn'];

        $totals = [];

        //
        $gameCount = 0;
        $moveCount = 0;
        $processCount = 0;


        //
        $time = time();


        //$files = ['lichess_elite_2023-01-a.pgn', 'lichess_elite_2023-01-b.pgn'];
        // loop through the files
        foreach ($files as $file) {

            //print "Parsing: " . $folder . $file . ":<br>";

            //$this->parsePgn($folder . $file);

            foreach ($this->myPgnParser->parsePgn($folder . $file) as $game) {

                // reset the time limit so we don't timeout on large files
                set_time_limit(300);

                // process the game, pass the totals & movecount as reference
                $this->processGame($game, $totals, $moveCount);

                // process the moves
                //$this->processMoves($totals);

                //$processCount++;

                // free the memory
                //$totals = [];

                $gameCount++;

                $usage = memory_get_usage() / 1024 / 1024;

                //if ($usage > 64 || count($totals) > 50) {
                //if ($usage > 64 || ($gameCount % 50 == 0)) {
                if ($usage > 64 || $gameCount % 10 == 0) {

                    dd($totals);
                    exit;

                    // process the moves
                    $this->processMoves($totals);

                    $processCount++;

                    // free the memory
                    $totals = [];
                }
            }
        }

        //print "end of script<br>";
        //exit;

        // process the moves that haven't been processed yet
        if (count($totals) > 0) {

            dd($totals);
            exit;

            //
            $this->processMoves($totals);

            $processCount++;
        }

        //
        $seconds = time() - $time;

        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds - $hours * 3600) / 60);
        $seconds = floor($seconds - ($hours * 3600) - ($minutes * 60));
        //
        print $gameCount . " games processed.<br>";
        print $moveCount . " moves processed.<br>";
        print $processCount . " calls to the processMoves function.<br>";

        //
        print "Duration of the script: " . $hours . "h " . $minutes . "m " . $seconds . "s<br>";

        $usage = memory_get_usage() / 1024 / 1024;

        print "Memory usage: " . round($usage, 2) . "mb<br>";

        exit;

        return $this->render('admin/index.html.twig', [
            'controller_name' => 'AdminController',
        ]);
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
                $totals[$fenstr] = ['pgn' => $pgn];
            }

            //
            if (!isset($totals[$fenstr][$moves[$i]])) {
                $totals[$fenstr][$moves[$i]] = [0, 0, 0];
            }

            //
            // update the totals
            if ($result == 'd') {
                $totals[$fenstr][$moves[$i]][1]++;
            } else if (($white && $result == 'w') || (!$white && $result == 'b')) {
                $totals[$fenstr][$moves[$i]][0]++;
            } else if (($white && $result == 'b') || (!$white && $result == 'w')) {
                $totals[$fenstr][$moves[$i]][2]++;
            }


            // make the move
            $fen->move($moves[$i]);

            // add to the pgn
            $pgn .= ($pgn != "" ? " " : "") . ($i % 2 == 0 ? ($i / 2 + 1) . ". " : "") . $moves[$i];

            $white = !$white;

            $moveCount++;
        }
    }

    private function processMoves($moves)
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

        foreach ($moves as $fen => $moves) {
            // reset the time limit so we don't timeout on large files
            set_time_limit(300);

            foreach ($moves as $move => $score) {

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

                        print "No rows affected rows after insert:<br>";

                        print "fen: " . $fen . "<br>";
                        print "move: " . $move . "<br>";
                        print_r($score);
                        exit;
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
                        print_r($score);
                        exit;
                    }
                }

                /*
                // find the move for this position
                $item = $repository->findOneBy([
                    'Fen' => $fen,
                    'Move' => $move
                ]);

                // if this is an existing move
                if ($item) {
                    $item->setWins($item->getWins() + $score[0]);
                    $item->setDraws($item->getDraws() + $score[1]);
                    $item->setLosses($item->getLosses() + $score[2]);
                } else {
                    // create it
                    $item = new Moves();
                    $item->setFen($fen);
                    $item->setMove($move);
                    $item->setWins($score[0]);
                    $item->setDraws($score[1]);
                    $item->setLosses($score[2]);
                }

                // persist the move
                $test->persist($item);
                */
            }

            // save the move
            //$test->flush();

            // batch processing??
            //$test->clear();

            //$this->em->getUnitOfWork()->clear();
        }

        // close the prepared statements
        //$stmtFind = null;
        //$stmtInsert = null;
        //$stmtUpdate = null;

        //$this->conn->close();


        //gc_enable();
        //gc_collect_cycles();


        //$test = $this->getDoctrine();

        //dd($test);
    }
}
