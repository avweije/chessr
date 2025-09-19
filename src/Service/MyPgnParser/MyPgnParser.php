<?php

namespace App\Service\MyPgnParser;

class MyPgnParser
{
    /**
     * Absolute path, e.g. "/path/to/games.pgn".
     * @var string
     */
    private $filePath;

    /**
     * If "filePath" is "/path/to/games.pgn", this is "games.pgn".
     * @var string
     */
    private $fileName;

    private $multiLineAnnotationDepth = 0;

    /**
     * @var Game
     */
    private $currentGame;

    private function createCurrentGame()
    {
        $game = new MyGame();
        $game->setFromPgnDatabase($this->fileName);
        $this->multiLineAnnotationDepth = 0;

        return $game;
    }

    public function parsePgn($filePath, $asText = false, $limit = null, $skip = null, $timer = null)
    {
        $this->filePath = $filePath;
        $this->fileName = basename($filePath);

        //
        if ($timer) $timer->startSub('fopen');

        $handle = fopen($filePath, "r");

        if ($timer) $timer->stopSub('fopen');

        if (!$asText) {
            
            //
            //if ($timer) $timer->startSub('new MyGame');

            //$game = new MyGame();

            //
            //if ($timer) $timer->stopSub('new MyGame');
        }

        //$this->createCurrentGame();
        $pgnBuffer = null;
        $movesBuffer = null;
        $haveMoves = false;
        $bytesRead = 0;
        $i = 0;
        $skip = $skip ?? 0;


        //
        // Do our own stuff, we only need the moves and the result
        // Should speed things up a lot..
        //
        $moves = [];
        $result = "";


        while (($line = fgets($handle, 4096)) !== false) {

            //
            //if ($timer) $timer->startSub('ParseLine');

            // When reading files line-by-line, there is a \n at the end, so remove it.
            $line = trim($line);
            $bytesRead = $bytesRead + strlen($line);
            if (empty($line)) {
                continue;
            }

            if (substr($line, 0, 3) == pack("CCC", 0xef, 0xbb, 0xbf)) {
                $line = substr($line, 3);
            }

            //if (strpos($line, '[') === 0 && $this->multiLineAnnotationDepth === 0) {
            if (strpos($line, '[') === 0) {

                

                // Starts with [ so must be meta-data.
                // If already have meta-data AND moves, then we are now at the end of a game's
                // moves and this is the start of a new game.
                if ($haveMoves) {

                    $i++;

                    // if we need to skip this one
                    if ($i <= $skip) {

                        $moves = [];
                        $result = "";

                        continue;
                    }

                    // if we reached our limit
                    if ($limit !== null && $i >= $skip + $limit) {
                        break;
                    }

                    if (!$asText) {

                        //
                        if ($timer) $timer->startSub('completeGame');

                        //$this->completeCurrentGame($game, $pgnBuffer);

                        //
                        if ($timer) $timer->stopSub('completeGame');
                    }

                    // yield the game (for the iterator)
                    if ($asText) {
                        yield ["pgn" => $pgnBuffer, "moves" => $movesBuffer];
                    } else {
                        //yield ["game" => $game, "bytesRead" => $bytesRead];
                        yield ["game" => [
                            "moves" => $moves,
                            "result" => $result
                        ], "bytesRead" => $bytesRead];
                    }

                    if (!$asText) {

                        //
                        if ($timer) $timer->startSub('createGame');

                        //$game = $this->createCurrentGame();

                        //
                        if ($timer) $timer->stopSub('createGame');
                    }

                    $haveMoves = false;
                    $pgnBuffer = null;
                    $movesBuffer = null;

                    $moves = [];
                    $result = "";

                }

                if (!$asText) {
                    
                    //$this->addMetaData($game, $line);
                    [$key, $val] = $this->getMetaData($line);

                    if ($key == "result") {
                        $result = $val;
                    }

                }
                $pgnBuffer .= $line . "\n";
            } else {
                // This is a line of moves.
                if (!$asText) {

                    //
                    if ($timer) $timer->startSub('addMoves');

                    //$this->addMoves($game, $line, $timer);

                    //
                    // We need to parse the line
                    // Remove move numbers
                    // Possible remove comments? variations? etc
                    //

                    // not the best, but for now do it here..
                    // if we already have 20 moves, skip this part..

                    if (count($moves) < 30) {
                        $clean = $this->cleanupMovesLine($line);

                        $lineMoves = explode(' ', $clean);
                        array_push($moves, ...$lineMoves);
                    }

                    $haveMoves = true;

                    
                    //
                    // if we already have 20 moves, 
                    // we can skip the rest of this game ??
                    // for later, can improve speed more..
                    //

                    //
                    if ($timer) $timer->stopSub('addMoves');
                }
                $haveMoves = true;
                $pgnBuffer .= "\n" . $line;
                $movesBuffer .= $line . "\n";
            }
        }

        if (!$asText) {

            //
            if ($timer) $timer->startSub('completeGame');

            //$this->completeCurrentGame($game, $pgnBuffer);

            //
            if ($timer) $timer->stopSub('completeGame');
        }

        //
        if ($timer) $timer->startSub('fclose');

        fclose($handle);

        if ($timer) $timer->stopSub('fclose');

        // yield the game (for the iterator)
        if ($asText) {
            yield ["pgn" => $pgnBuffer, "moves" => $movesBuffer];
        } else {
            //yield ["game" => $game, "bytesRead" => $bytesRead];
            yield ["game" => [
                        "moves" => $moves,
                        "result" => $result
                        ], 
                    "bytesRead" => $bytesRead];
            
        }
    }

    private function cleanupMovesLine($line)
    {
        // Remove comments
        $clean = preg_replace('/\{.*?\}/s', '', $line);

        // Remove variations (anything in parentheses)
        $clean = preg_replace('/\([^\)]*\)/', '', $clean);

        // Remove move numbers (1., 2., 3..., etc.)
        $clean = preg_replace('/\b\d+\.(\.\.)?\s*/', '', $clean);

        // Remove result notation (optional)
        $clean = preg_replace('/\s*(1-0|0-1|1\/2-1\/2)\s*/', '', $clean);

        // Trim leading/trailing whitespace
        $clean = trim($clean);

        return $clean;
    }

    public function parsePgnFromText($pgnString, $singleGame = false)
    {
        $lines = explode("\n", $pgnString);
        //dd($lines);

        $game = new MyGame();

        //$this->createCurrentGame();
        $pgnBuffer = null;
        $haveMoves = false;
        foreach ($lines as $line) {
            // When reading files line-by-line, there is a \n at the end, so remove it.
            $line = trim($line);
            if (empty($line)) {
                continue;
            }

            if (strpos($line, '[') === 0 && $this->multiLineAnnotationDepth === 0) {
                // Starts with [ so must be meta-data.
                // If already have meta-data AND moves, then we are now at the end of a game's
                // moves and this is the start of a new game.
                if ($haveMoves) {

                    // we want only 1 game
                    break;

                    /*
                    $this->completeCurrentGame($game, $pgnBuffer);

                    // yield the game (for the iterator)
                    yield $game;

                    $game = $this->createCurrentGame();

                    $haveMoves = false;
                    $pgnBuffer = null;
                    */
                }

                $this->addMetaData($game, $line);
                $pgnBuffer .= $line . "\n";
            } else {
                // This is a line of moves.
                $this->addMoves($game, $line);
                $haveMoves = true;
                $pgnBuffer .= "\n" . $line;
            }
        }

        $this->completeCurrentGame($game, $pgnBuffer);

        // return the game
        return $game;
    }
    private function removeAnnotations($line)
    {
        $result = null;
        foreach (str_split($line) as $char) {
            if ($char === '{' || $char === '(') {
                $this->multiLineAnnotationDepth++;
            }
            if ($this->multiLineAnnotationDepth === 0) {
                $result .= $char;
            }
            if ($char === '}' || $char === ')') {
                $this->multiLineAnnotationDepth--;
            }
        }

        return $result;
    }

    /**
     * @param string $line "[Date "1953.??.??"]"
     */
    private function getMetaData($line)
    {
        if (strpos($line, ' ') === false) {
            throw new \Exception("Invalid metadata: " . $line);
        }

        list($key, $val) = explode(' ', $line, 2);
        $key = strtolower(trim($key, '['));
        $val = trim($val, '"]');

        return [$key, $val];
    }

    /**
     * @param string $line "[Date "1953.??.??"]"
     */
    private function addMetaData(MyGame $game, $line)
    {
        if (strpos($line, ' ') === false) {
            throw new \Exception("Invalid metadata: " . $line);
        }

        list($key, $val) = explode(' ', $line, 2);
        $key = strtolower(trim($key, '['));
        $val = trim($val, '"]');

        switch ($key) {
            case 'result':
                $game->setResult($val);
                break;
            case 'white':
                $game->setWhite($val);
                break;
            case 'black':
                $game->setBlack($val);
                break;
            case 'whiteelo':
                $game->setWhiteElo($val);
                break;
            case 'blackelo':
                $game->setBlackElo($val);
                break;
            case 'fen':
                $game->setFen($val);
                break;
            case 'link': // chess.com
            case 'site': // lichess
                $game->setLink($val);
                break;
            default:
                // Ignore others
                break;
        }
    }
    /**
     * @param string $line "Qe7 22. Nhg4 Nxg4 23. Nxg4 Na5 24. b3 Nc6"
     */
    private function addMoves(MyGame $game, $line, $timer = null)
    {
        $line = $this->removeAnnotations($line);

        //
        if ($timer) $timer->startSub('addMoves-pregs');

        // Remove the move numbers, so "1. e4 e5 2. f4" becomes "e4 e5 f4"
        $line = preg_replace('/\d+\./', '', $line);

        // Remove the result (1-0, 1/2-1/2, 0-1) from the end of the line, if there is one.
        $line = preg_replace('/(1-0|0-1|1\/2-1\/2|\*)$/', '', $line);

        // If black's move is after an annotation, it is formatted as: "annotation } 17...h5".
        // Remove those dots (one is already gonee after removing "17." earlier.
        $line = str_replace('..', '', $line);

        $line = preg_replace('/\$[0-9]+/', '', $line);
        $line = preg_replace('/\([^\(\)]+\)/', '', $line);

        // And finally remove excess white-space.
        $line = trim(preg_replace('/\s{2,}/', ' ', $line));

        //
        if ($timer) $timer->stopSub('addMoves-pregs');

        //
        if ($timer) $timer->startSub('addMoves-setMoves');

        $firstMoves = array_slice(explode(' ', $line), 0, 5);

        if ($timer) $timer->debugVar("firstMoves", $firstMoves);
        
        $game->setMoves($game->getMoves() ? $game->getMoves() . " " . $line : $line);

        //
        if ($timer) $timer->stopSub('addMoves-setMoves');
    }

    private function completeCurrentGame(MyGame $game, $pgn)
    {
        $game->setPgn($pgn);
        $this->multiLineAnnotationDepth = 0;
    }
}
