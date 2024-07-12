<?php

namespace App\Controller;

use App\Library\UCI;
use App\Library\ChessJs;
use App\Library\GameDownloader;
use App\Service\MyPgnParser;
use App\Service\MyGame;
use Doctrine\DBAL\Connection;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;
use Onspli\Chess\FEN;
use Onspli\Chess\PGN;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

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
        //$this->importPgnFiles();

        //$this->testStockfish();

        //exit;

        return $this->render('admin/index.html.twig', [
            'controller_name' => 'AdminController',
        ]);
    }

    #[Route('/admin/engine', name: 'app_admin_engine')]
    public function testStockfish()
    {

        print "Testing UCI class.<br>";

        $downloader = new GameDownloader();

        $archives = $downloader->downloadArchives();

        $games = $downloader->downloadGames(2024, 1);

        //dd($games, $downloader->getGames());

        //dd($downloader->games, $downloader->getGames("blitz", [2024 => [2, 3]]));


        /*

        1) Need to check for user color, currently always checking for white.
        Make it possible to check for white or black, based on user.

        */

        //dd($games);

        print count($games) . " games in total.<br>";
        print "Analysis takes about 16s per game on average.<br>";
        print "Estimated time for all games: " . $this->getDuration(count($games) * 16) . "<br>";

        exit;


        // start the UCI component
        $uci = new UCI();

        // request the 3 best moves
        $uci->setOption("MultiPV", 3);

        $i = 0;

        $time = microtime(true);

        // analyse the games
        foreach ($games as $val) {

            // parse the game
            $game = $this->myPgnParser->parsePgnString($val["pgn"], true);

            // analyse the game
            $mistakes = $this->analyseGame($uci, $game);

            print "Game " . ($i + 1) . " Mistakes:<br>";
            print_r($mistakes);
            print "<br><br>";

            print "Duration so far: " . $this->getDuration(microtime(true) - $time) . "<br><br>";

            $i++;

            if ($i > 2) {
                break;
            }
        }

        //$bestMoves = $uci->setPosition("rnbqkb1r/pp1ppppp/5n2/2p5/4P3/2PB4/PP1P1PPP/RNBQK1NR b KQkq - 2 3");
        //rnbqkb1r/pp1ppppp/5n2/2p5/4P3/2PB4/PP1P1PPP/RNBQK1NR b KQkq - 2 3

        print "Done testing.<br>";

        exit;

        // path to stockfish exe
        //$path  = "./stockfish/stockfish-windows-x86-64.exe";
        //$path  = "build\stockfish\stockfish-windows-x86-64.exe";

        //print "realpath: ";
        $path = realpath("./build/stockfish/stockfish-windows-x86-64.exe");
        //exit;


        if (file_exists($path)) {
            print "stockfish exe found!<br>";
        } else {
            print "stockfish exe NOT found!<br>";
        }

        //print "cwd: " . getcwd() . "<br>";

        // thinking time
        $thinkingTime = 500;

        $testFen = "rnbqkb1r/pp1ppppp/5n2/2p5/4P3/2PB4/PP1P1PPP/RNBQK1NR b KQkq - 2 3";

        //$cwd = './';
        $cwd = getcwd();

        $descriptorspec = array(
            0 => array("pipe", "r"),
            1 => array("pipe", "w"),
        );

        $other_options = array('bypass_shell' => 'true');

        $descr = array(
            0 => array("pipe", "r"),
            1 => array("pipe", "w"),
            2 => array("pipe", "w")
        );

        //$process = proc_open($path, $descriptorspec, $pipes, $cwd, null, $other_options);
        $process = proc_open($path, $descr, $pipes, null, array('bypass_shell' => 'true'));

        print "Testing stockfish..<br>";

        if (is_resource($process)) {

            print "Process opened..<br>";

            fwrite($pipes[0], "uci\n");
            fwrite($pipes[0], "ucinewgame\n");
            fwrite($pipes[0], "position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - - 0 1\n");
            fwrite($pipes[0], "go depth 50\n");
            fclose($pipes[0]);

            print "-- OUTPUT:<br>";
            // Read all output from the pipe
            while (!feof($pipes[1])) {
                echo fgets($pipes[1]);
            }
            fclose($pipes[1]);

            print "-- ERRORS:<br>";
            // Read all output from the pipe
            while (!feof($pipes[2])) {
                echo fgets($pipes[2]);
            }
            fclose($pipes[2]);

            proc_close($process);

            exit;

            fwrite($pipes[0], "uci\n");
            fwrite($pipes[0], "ucinewgame\n");
            fwrite($pipes[0], "isready\n");

            fwrite($pipes[0], "position fen $testFen\n");
            fwrite($pipes[0], "go movetime $thinkingTime\n");

            $str = "";

            $i = 0;
            while (true) {
                usleep(100);
                $s = fgets($pipes[1], 4096);
                $str .= $s;
                if (strpos(' ' . $s, 'bestmove')) {
                    break;
                }

                // testing
                $i++;
                if ($i > 1000) {
                    break;
                }
            }

            fclose($pipes[0]);
            fclose($pipes[1]);
            proc_close($process);

            print "i: $i<br>";
            print "str: $str<br>";
            print "s: $s<br>";

            //
            $teile = explode(" ", $s);
            $zug = $teile[1];
            $str = $zug;
            for ($i = 0; $i < 4; $i++) {
                $str[$i];
            }

            print "bestmove: " . $str[0] . $str[1] . "-" . $str[2] . $str[3] . "<br>";
        }
    }

    private function analyseGame($uci, $game): array
    {
        $moves = [];

        $gameMoves = $game->getUciMoves();
        $gamePgn = $game->getPgn();
        $fen = $game->getFen();

        // start a new game
        $uci->newGame();

        // set the initial position
        $bestMoves = $uci->setPosition($fen);
        // get the current best move
        $bestCp = $bestMoves[1]["cp"];

        //print "Starting CP: $bestCp (" . $bestMoves[1]["move"] . ")<br>";

        $white = true;

        $prevWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $bestCp)) - 1));
        $accuracy = [];

        $mistakes = [];
        $includeInnacuracies = true;

        $halfMove = 1;
        $linePgn = "";
        $lineMoves = [];

        foreach ($gameMoves as $move) {

            $moves[] = $move['uci'];

            $bestMoves = $uci->setPosition("", $moves);

            $white = !$white;

            /*

            Determine which color we are.

            Base analysis off that color, currently always for white.

            */

            //print "Best Move: " . $bestMoves[1]["move"] . " (" . $bestMoves[1]["cp"] . ")<br>";

            $moveCp = $white ? $bestMoves[1]["cp"] : $bestMoves[1]["cp"] * -1;

            // if we played a white move and have the black move evaluations
            if (!$white) {
                $cpLoss = max(0, $bestCp - $moveCp);

                $winPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $moveCp)) - 1));

                $pctLoss = $prevWinPct == -1 ? 0 : max(0, ($prevWinPct - $winPct) / 100);

                $acc = 103.1668 * exp(-0.04354 * ($prevWinPct - min($prevWinPct, $winPct))) - 3.1669;
                $accuracy[] = $acc;

                $mistake = ["move" => $move["san"], "type" => "", "line" => ["pgn" => $linePgn, "moves" => $lineMoves]];

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
                        $mistakes[] = $mistake;
                    }
                } else if ($pctLoss < .2) {
                    // mistake
                    $mistake["type"] = "mistake";
                    $mistakes[] = $mistake;
                } else {
                    // blunder
                    $mistake["type"] = "blunder";
                    $mistakes[] = $mistake;
                }
            } else {
                $prevWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $moveCp)) - 1));
            }

            $bestCp = $moveCp;

            $linePgn .= ($linePgn != "" ? " " : "") . ($halfMove % 2 == 1 ? ceil($halfMove / 2) . ". " : "") . $move['san'];
            $lineMoves[] = $move['san'];

            $halfMove++;

            // max 15 moves?
            if ($halfMove >= 30) {
                break;
            }
        }

        return $mistakes;
    }

    #[Route('/admin/import', name: 'app_admin_import')]
    public function importPgnFiles()
    {


        //$repository = $this->em->getRepository(Moves::class);

        // set memory limit
        //ini_set('memory_limit', '512M');

        // set the upload folder
        $folder = './build/uploads/';
        // set the PGN files array
        //$files = ['lichess_elite_2023-01-1st-10-games.pgn'];


        // done
        //$files = ['lichess_elite_2023-01-1st-500k-lines.pgn'];
        //$files = ['lichess_elite_2023-01-500k-b.pgn'];

        // todo
        $files = ['lichess_elite_2023-01-500k-c.pgn'];
        //$files = ['lichess_elite_2023-01-500k-d.pgn'];
        //$files = ['lichess_elite_2023-01-500k-e.pgn'];
        //$files = ['lichess_elite_2023-01-500k-f.pgn'];
        //$files = ['lichess_elite_2023-01-500k-g.pgn'];
        //$files = ['lichess_elite_2023-01-500k-h.pgn'];


        print "disabled..<br>";

        $files = [];
        exit;


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

                // every 50k games or when memory is low
                if ($usage > 64 || $gameCount % 50000 == 0) {

                    //dd($totals);
                    //exit;

                    //print "--process<br>";
                    /*
                    $seconds = time() - $time;

                    $hours = floor($seconds / 3600);
                    $minutes = floor(($seconds - $hours * 3600) / 60);
                    $seconds = floor($seconds - ($hours * 3600) - ($minutes * 60));

                    //
                    print "Duration of the script until processMoves: " . $hours . "h " . $minutes . "m " . $seconds . "s<br>";
                    */

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

            //dd($totals);
            //exit;

            //print "--end ($gameCount)<br>";

            //
            $this->processMoves($totals);

            $processCount++;

            $totals = [];
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
        $i = 0;

        foreach ($moves as $fen => $fenMoves) {
            // reset the time limit so we don't timeout on large files
            set_time_limit(300);

            foreach ($fenMoves as $move => $score) {

                // skip the 'pgn' field, not an actual move..
                if ($move == 'pgn') {
                    continue;
                }

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

            $i++;

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
