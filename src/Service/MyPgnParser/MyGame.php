<?php

namespace App\Service\MyPgnParser;

use AmyBoyd\PgnParser\Game;

/**
 * MyGame - Game class extension.
 * 
 * Added functions for the (initial) FEN header in the PGN.
 */
class MyGame extends Game
{
    protected $fen;
    protected $link;

    public function getMovesPgn()
    {
        $pgn = "";
        $moves = $this->getMovesArray();
        for ($i = 0; $i < count($moves); $i++) {
            if ($i % 2 == 0) {
                $pgn .= ($pgn == "" ? "" : " ") . ($i / 2 + 1) . ".";
            }
            $pgn .= " " . $moves[$i];
        }
        return $pgn;
    }

    /**
     * Set initial FEN
     * @param string $fen
     */
    public function setFen($fen)
    {
        $this->fen = $fen;
    }

    /**
     * Get initial FEN
     * @return string
     */
    public function getFen()
    {
        return $this->fen;
    }

    /**
     * Set game link
     * @param string $link
     */
    public function setLink($link)
    {
        $this->link = $link;
    }

    /**
     * Get game link
     * @return string
     */
    public function getLink()
    {
        return $this->link;
    }

    /**
     * Set white
     * @param string $white
     */
    public function setWhite($white)
    {
        $this->white = MyUtil::normalizePlayerName($white);
    }

    /**
     * Get white
     * @return string
     */
    public function getWhite()
    {
        return $this->white;
    }

    /**
     * Set black
     * @param string $black
     */
    public function setBlack($black)
    {
        $this->black = MyUtil::normalizePlayerName($black);
    }

    /**
     * Get black
     * @return string
     */
    public function getBlack()
    {
        return $this->black;
    }
}
