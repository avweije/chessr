<?php

namespace App\Library;

use AmyBoyd\PgnParser\Game;

/**
 * MyGame - Game class extension.
 * 
 * Added functions for the (initial) FEN header in the PGN.
 */
class MyGame extends Game
{
    protected $fen;

    /**
     * Set initial FEN
     * @param string $date
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

    public function getUciMoves(): array
    {
        //
        $chess = new ChessJs($this->getFen());

        foreach ($this->getMovesArray() as $move) {
            $chess->move($move);
        }

        //dd($gamePgn);

        $history = $chess->history(['verbose' => true]);

        //dd($history);

        $uciMoves = [];
        foreach ($history as $move) {
            $uciMoves[] = [
                'uci' => $move['from'] . $move['to'] . ($move['promotion'] !== null ? $move['promotion'] : ""),
                'san' => $move['san']
            ];
        }

        return $uciMoves;
    }
}