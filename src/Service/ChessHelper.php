<?php

namespace App\Service;

use App\Library\ChessJs;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

class ChessHelper
{
    public function __construct(private EntityManagerInterface $em, private Security $security) {}

    /**
     * Normalize FEN for evaluation
     * Keeps: piece placement, active color, castling rights, en passant
     * Strips: halfmove clock, fullmove number
     */
    public function normalizeFenForEvaluation(string $fen, bool $replaceEnPassant = false): string
    {
        $parts = explode(' ', $fen);
        // Replace en passant with - if needed
        if ($replaceEnPassant) {
            $parts[3] = '-';
        }
        // Take piece placement, active color, castling rights and en passant
        return join(" ", array_slice($parts, 0, 4));
    }

    /**
     * Normalize FEN for evaluation
     * Keeps: piece placement, active color, castling rights
     * Strips: en passant, halfmove clock, fullmove number
     */
    public function normalizeFenForMoveStats(string $fen): string
    {
        $parts = explode(' ', $fen);
        // Take piece placement, active color, and castling rights
        return join(" ", array_slice($parts, 0, 3));
    }

    public function normalizeFenForRepertoire(string $fen): string
    {
        return $this->normalizeFenForMoveStats(($fen));
    }

    /**
     * Get the SAN notation for the 1st move in an engine eval
     */
    public function getFirstSanMoveFromLine(ChessJs $chess, string $fen, string $line): ?string
    {
        if (!$chess) {
            $chess = new ChessJs();
        }

        $parts = explode(" ", $fen);
        $fenWithout = join(" ", array_slice($parts, 0, 4));
        $chess->load($fenWithout . " 0 1");

        //$chess->load($fen);

        $moves = explode(" ", trim($line));
        if (empty($moves)) return null;

        $uciMove = $moves[0];
        $fromSquare = substr($uciMove, 0, 2);
        $toSquare = substr($uciMove, 2, 2);
        $promotion = strlen($uciMove) == 5 ? substr($uciMove, 4, 1) : "";

        $ret = $chess->move([
            "from" => $fromSquare,
            "to" => $toSquare,
            "promotion" => $promotion
        ]);

        if ($ret !== null) {
            $history = $chess->history(['verbose' => true]);
            $last = array_pop($history);
            //$chess->undo(); // not really needed anymore, we load fen everytime..

            return $last['san'] ?? null;
        }

        return null;
    }

    public function fenCompare($fenSource, $fenTarget): string
    {
        // Normalize the FEN for repertoire
        $fenSource = $this->normalizeFenForRepertoire($fenSource);
        $fenTarget = $this->normalizeFenForRepertoire($fenTarget);

        return $fenSource == $fenTarget;
    }


    /**
     * Checks if a FEN string is from a standard chess game or a variant.
     * It's not 100%, because it can't be for all positions, but this will
     * filter out most variants while they are in the early phases of the game.
     */
    function isLikelyStandardChessFEN(string $fen): bool
    {
        $parts = explode(' ', trim($fen));
        if (count($parts) > 6) {
            return false; // standard FEN always has 6 fields (can be less if it omits move number for evaluations and such)
        }

        $placement = $parts[0] ?? '';
        $turn = $parts[1] ?? '';
        $castling = $parts[2] ?? '';
        $ep = $parts[3] ?? '';
        $halfmove = $parts[4] ?? '';
        $fullmove = $parts[5] ?? '';

        $ranks = explode('/', $placement);
        if (count($ranks) !== 8) {
            return false; // must have 8 ranks
        }

        $board = [];
        $whiteKings = 0;
        $blackKings = 0;
        $whiteLightBishop = false;
        $whiteDarkBishop = false;
        $blackLightBishop = false;
        $blackDarkBishop = false;

        foreach ($ranks as $rankIndex => $rank) {
            $row = [];
            $len = 0;
            for ($i = 0; $i < strlen($rank); $i++) {
                $c = $rank[$i];
                if (ctype_digit($c)) {
                    $len += (int)$c;
                } elseif (ctype_alpha($c)) {
                    $row[] = $c;
                    $len++;
                    if ($c === 'K') $whiteKings++;
                    if ($c === 'k') $blackKings++;

                    // Track bishops by color and light/dark square
                    if ($c === 'B') {
                        if (($rankIndex + $len - 1) % 2 === 0) $whiteLightBishop = true; // light square
                        else $whiteDarkBishop = true; // dark square
                    }
                    if ($c === 'b') {
                        if (($rankIndex + $len - 1) % 2 === 0) $blackLightBishop = true;
                        else $blackDarkBishop = true;
                    }
                } else {
                    return false; // invalid char
                }
            }
            if ($len !== 8) {
                return false; // each rank must be 8 files
            }
            $board[] = $row;
        }

        // must have exactly 1 white king and 1 black king
        if ($whiteKings !== 1 || $blackKings !== 1) {
            return false;
        }

        // verify castling rights are only KQkq or -
        if ($castling !== '-' && !preg_match('/^[KQkq]+$/', $castling)) {
            return false;
        }

        $rank1 = $this->expandRank($ranks[7]); // white back rank
        $rank2 = $this->expandRank($ranks[6]); // white pawn rank
        $rank7 = $this->expandRank($ranks[1]); // black pawn rank
        $rank8 = $this->expandRank($ranks[0]); // black back rank

        // ---- Bishop behind unmoved pawns ----
        // White c1 bishop if b2 and d2 pawns unmoved
        if ($whiteDarkBishop && $rank2[1] === 'P' && $rank2[3] === 'P' && $rank1[2] !== 'B') {
            //dd("1", $fen, $rank1, $rank2, $rank7, $rank8);
            return false;
        }
        // White f1 bishop if e2 and g2 pawns unmoved
        if ($whiteLightBishop && $rank2[4] === 'P' && $rank2[6] === 'P' && $rank1[5] !== 'B') {
            //dd("2", $fen, $rank1, $rank2, $rank7, $rank8);
            return false;
        }

        // Black c8 bishop if b7 and d7 pawns unmoved
        if ($blackLightBishop && $rank7[1] === 'p' && $rank7[3] === 'p' && $rank8[2] !== 'b') {
            //dd("3", $fen, $rank1, $rank2, $rank7, $rank8);
            return false;
        }
        // Black f8 bishop if e7 and g7 pawns unmoved
        if ($blackDarkBishop && $rank7[4] === 'p' && $rank7[6] === 'p' && $rank8[5] !== 'b') {
            //dd("4", $fen, $rank1, $rank2, $rank7, $rank8);
            return false;
        }

        //
        // Lichess FEN strings castling rights seem wrong, needs more testing..
        // Disable this check for now.
        //

        /**
         * We can add more checks for other variants.
         * No more than 8 pawns for either side
         * No more than 2 knights, 2 bishops, 1 queen, 2 rooks
         */

        return true;

        // ---- Rooks based on castling rights ----
        if (strpos($castling, 'Q') !== false && $rank1[0] !== 'R') {
            dd("5", $fen, $rank1, $rank2, $rank7, $rank8);
            return false;
        }
        if (strpos($castling, 'K') !== false && $rank1[7] !== 'R') {
            dd("6", $fen, $rank1, $rank2, $rank7, $rank8);
            return false;
        }
        if (strpos($castling, 'q') !== false && $rank8[0] !== 'r') {
            dd("7", $fen, $rank1, $rank2, $rank7, $rank8);
            return false;
        }
        if (strpos($castling, 'k') !== false && $rank8[7] !== 'r') {
            dd("8", $fen, $rank1, $rank2, $rank7, $rank8);
            return false;
        }

        // This filters out Chess960 and most variants, keeps standard chess only
        return true;
    }

    // helper: expand a FEN rank into an 8-char string
    private function expandRank(string $rank): string
    {
        $expanded = '';
        for ($i = 0; $i < strlen($rank); $i++) {
            $c = $rank[$i];
            if (ctype_digit($c)) {
                $expanded .= str_repeat(' ', (int)$c);
            } else {
                $expanded .= $c;
            }
        }
        return $expanded;
    }
}
