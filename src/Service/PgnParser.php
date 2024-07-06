<?php

namespace App\Service;

use AmyBoyd\PgnParser\Game;
//use AmyBoyd\PgnParser\PgnParser;

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
        $game = new Game();
        $game->setFromPgnDatabase($this->fileName);
        $this->multiLineAnnotationDepth = 0;

        return $game;
    }

    public function parsePgn($filePath)
    {
        $this->filePath = $filePath;
        $this->fileName = basename($filePath);

        $handle = fopen($filePath, "r");

        $game = new Game();

        //$this->createCurrentGame();
        $pgnBuffer = null;
        $haveMoves = false;
        while (($line = fgets($handle, 4096)) !== false) {
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

                    $this->completeCurrentGame($game, $pgnBuffer);

                    // yield the game (for the iterator)
                    //yield $this->currentGame;
                    yield $game;

                    $game = $this->createCurrentGame();

                    $haveMoves = false;
                    $pgnBuffer = null;
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

        fclose($handle);

        // yield the game (for the iterator)
        //yield $this->currentGame;
        yield $game;
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
    private function addMetaData($game, $line)
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
            default:
                // Ignore others
                break;
        }
    }
    /**
     * @param string $line "Qe7 22. Nhg4 Nxg4 23. Nxg4 Na5 24. b3 Nc6"
     */
    private function addMoves($game, $line)
    {
        $line = $this->removeAnnotations($line);

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

        $game->setMoves($game->getMoves() ? $game->getMoves() . " " . $line : $line);
    }

    private function completeCurrentGame($game, $pgn)
    {
        $game->setPgn($pgn);
        $this->multiLineAnnotationDepth = 0;
    }
}
