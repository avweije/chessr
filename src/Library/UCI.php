<?php

namespace App\Library;

use AmyBoyd\PgnParser\Game;
//use AmyBoyd\PgnParser\PgnParser;

define("UCI_MAX_THINK_TIME", 5);


class UCI
{
    private $resource;

    private $pipes;

    private $skill    = 10;

    //private static $instance;

    /**
     * Absolute path, e.g. "/path/to/stockfish.exe".
     * @var string
     */
    private $path = "";

    public function __construct()
    {
        // initialise vars
        $this->resource = null;
        print "CWD: " . getcwd() . "<br>";
        $this->path = realpath("./build/stockfish/stockfish-windows-x86-64.exe");
        print "path: " . $this->path . "<br>";
        // open the process
        $this->open();
    }

    // opens the process, prepares UCI
    protected function open()
    {
        if (!$this->resource) {
            $descriptorspec = array(
                0 => array("pipe", "r"),  // stdin is a pipe that the child will read from
                1 => array("pipe", "w"),  // stdout is a pipe that the child will write to
                2 => array("pipe", "w") // write errors to pipe
            );

            //$cwd = '/tmp';
            //$cwd = getcwd();

            //$env = array();

            $this->resource = proc_open($this->path, $descriptorspec, $this->pipes, null, array(
                'bypass_shell' => 'true',
                'blocking_pipes' => 'false'
            ));
        }

        if (!is_resource($this->resource)) {
            $this->close();

            throw new \Exception("Resource unavailable !");
        } else {
            // prepare UCI
            $this->writeCommand("uci");

            return true;
        }
    }

    public function newGame()
    {
        $bool = $this->writeCommand("ucinewgame", $response);

        print "-- newGame ($bool): $response<br>";
    }

    public function limitStrength($elo)
    {
        $elo = max(1320, $elo);
        $elo = min(3190, $elo);

        $this->setOption("UCI_LimitStrength", 'true');
        $this->setOption("UCI_Elo", $elo);
    }

    public function setOption($name, $value = null)
    {
        $cmd = "setoption name $name";
        if ($value !== null) {
            $cmd .= " value $value";
        }
        $this->writeCommand($cmd);
    }

    public function setPosition($fen = "", $moves = [], $moveTime = 500)
    {
        $cmd = "position " . ($fen == "" ? "startpos" : "fen " . $fen);
        if (count($moves) > 0) {
            $cmd .= " moves " . join(" ", $moves);
        }

        // set the position
        $this->writeCommand($cmd);

        // calculate the best moves
        $bestMoves = [];
        $this->writeCommand("go movetime $moveTime", $bestMoves);

        return $bestMoves;
    }

    /**
     * writeCommand
     * 
     * On windows, non-blocking pipes are not possible. For that reason we send an 'isready' command after each command.
     * We can then stop reading lines when we receive the 'readyok' line.
     *
     * @param  mixed $command
     * @param  mixed $response
     * @return bool
     */
    private function writeCommand($command, &$response = ""): bool
    {

        // is this the 'go' command?
        $goCommand = strpos($command, "go ") === 0;

        //print "Writing command (" . ($goCommand ? "go" : "x") . ": <b>$command</b><br>";

        // write the command
        fwrite($this->pipes[0], $command . "\n");

        usleep(500);

        // if this is not the 'go' command, send the 'isready' command
        if (!$goCommand) {
            fwrite($this->pipes[0], "isready\n");
        }

        // we need to stop reading the stream when 'readyok' or 'bestmove' are written
        $stopReadingMatch = $goCommand ? "bestmove" : "readyok";

        // get the current time
        $start_thinking_time = time();

        $response = "";
        $lines = [];

        // wait for the response
        while (true) {

            // read the next line
            $line = fgets($this->pipes[1]);

            if ($line == "") {
                print "-- no line..<br>";
            } else if ($line == false) {
                print "-- fgets failed..<br>";
            }

            // if we have the response
            if ($line != "") {

                //print "[LINE] " . $line . "<br>";

                // if we need to stop reading the stream
                if (strpos($line, $stopReadingMatch) === 0) {

                    //print "-- '" . $stopReadingMatch . "' found, stop reading stream--<br>";

                    //
                    if ($goCommand) {

                        $response = $this->parsePrincipalVariations($lines);
                    } else {
                        //print "Response:<br>";
                        //print nl2br($response);
                        //print "<br>";
                    }

                    break;
                }

                // add to the response string
                $response .= $line;
                // add to the response lines
                $lines[] = $line;
            }

            // if we've waited long enough
            if ((time() - $start_thinking_time) > UCI_MAX_THINK_TIME) {

                print "-- waiting too long for response..<br>";

                //throw new \Exception("UCI didn't respond after time limit ! Halting !");

                return false;
            } else if ($line === false) {

                print "-- no response yet, sleep-500<br>";

                // no response yet, keep trying
                usleep(500);

                continue;
            }
        }

        return true;
    }

    private function parsePrincipalVariations($data)
    {
        //
        $lines = [];
        //
        foreach ($data as $line) {
            $parts = explode(" ", $line);
            if ($parts[0] == "info" && $parts[1] == "depth") {

                $bestMoveIdx = $parts[6];

                $moves = [];
                $add = false;

                for ($i = 10; $i < count($parts); $i++) {
                    if ($add) {
                        $moves[] = $parts[$i];
                    } else {
                        $add = $parts[$i] == "pv";
                    }
                }

                //print $line . "<br>";

                $lines[$bestMoveIdx] = [
                    "depth" => $parts[2],
                    "cp" => $parts[9],
                    "move" => count($moves) > 0 ? $moves[0] : "",
                    "line" => $moves
                ];
            }
        }

        return $lines;
    }

    public function setSkillLevel($level)
    {
        $this->skill    = (int) $level;
    }

    /**
     *
     * @param array $moves Algebraic notation moves
     * @param array Assoc. array of additional properties to pass to "go" function
     *	(e.g. wtime => 50000)
     */
    public function getBestMove(array $moves, array $properties = array())
    {
        $moves    = implode(" ", $moves);

        if (!is_resource($this->resource)) {
            $this->open();
        }

        // $pipes now looks like this:
        // 0 => writeable handle connected to child stdin
        // 1 => readable handle connected to child stdout
        // Any error output will be appended to /tmp/error-output.txt


        fwrite($this->pipes[0], "uci\n");
        fwrite($this->pipes[0], "ucinewgame\n");
        //		fwrite($this->pipes[0], "setoption name Skill Level value {$this->skill}\n");
        fwrite($this->pipes[0], "isready\n");
        usleep(500);


        if (empty($moves)) {
            fwrite($this->pipes[0], "position startpos\n");
        } else {
            fwrite($this->pipes[0], "position startpos moves $moves\n");
        }

        //		echo "\n\n----------------\n\n$moves\n\n---------------\n\n"; die();

        $go_modifiers = "";

        if (!empty($properties)) {
            foreach ($properties as $name => $value) {
                $go_modifiers .= "$name $value ";
            }
        }

        if (!isset($properties['movetime'])) {
            $go_modifiers    .= "movetime 500 ";
        }

        //		echo "go $go_modifiers\n\n<br/>";

        fwrite($this->pipes[0], "go $go_modifiers\n");
        fclose($this->pipes[0]);

        $start_thinking_time    = time();

        while (true) {

            $return = stream_get_contents($this->pipes[1]);

            //			echo "\n\n --- $return \n\n";

            if (preg_match("/bestmove\s(?P<bestmove>[a-h]\d[a-h]\dq?)/i", $return, $matches)) {
                break;
            } elseif (preg_match("/bestmove\s\(none\)/i", $return)) {
                //				$this->shutDown();

                return null;
            } else if ((time() - $start_thinking_time) > UCI_MAX_THINK_TIME) {
                //				$this->shutDown();

                throw new \Exception("UCI didn't respond after time limit ! Halting !");
            } else {
                usleep(500);

                continue;
            }
        }

        //		$this->shutDown();

        return $matches;
    }

    public function __destruct()
    {
        $this->close();
    }

    protected function close()
    {
        print "Closing.<br>";

        @fclose($this->pipes[0]);
        @fclose($this->pipes[1]);
        @fclose($this->pipes[2]);
        @proc_close($this->resource);
    }
}