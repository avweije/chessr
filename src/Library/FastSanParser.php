<?php

namespace App\Library;

class FastSanParser
{
    private array $board;
    private string $turn = 'w'; // 'w' or 'b'
    private string $castlingWhite = 'KQ';
    private string $castlingBlack = 'kq';

    const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    public function __construct(string $fen = self::INITIAL_FEN)
    {
        $this->loadFen($fen);
    }

    public function loadFen(string $fen): void
    {
        [$boardPart, $turn] = explode(' ', $fen, 2);
        $this->turn = $turn[0] ?? 'w';
        $this->board = [];
        $rows = explode('/', $boardPart);
        foreach ($rows as $r => $row) {
            $this->board[$r] = [];
            $f = 0;
            for ($i = 0; $i < strlen($row); $i++) {
                $c = $row[$i];
                if (is_numeric($c)) {
                    for ($j = 0; $j < (int)$c; $j++) {
                        $this->board[$r][$f++] = null;
                    }
                } else {
                    $this->board[$r][$f++] = $c;
                }
            }
        }
    }

    public function getFromTo(string $san): array
    {

        // handle castling
        if (strtoupper($san) === 'O-O' || strtoupper($san) === 'O-O-O') {
            return $this->handleCastling($san);
        }

        // parse SAN move
        if (!preg_match('/^([NBRQK]?)([a-h]?)([1-8]?)(x?)([a-h][1-8])(=?[NBRQ]?)/', $san, $matches)) {
            throw new \Exception("Invalid SAN: $san");
        }

        [$full, $piece, $fileHint, $rankHint, $capture, $to, $promotion] = $matches;
        //$piece = $piece ?: ($this->turn === 'w' ? 'P' : 'p'); // pawn default based on turn
        $piece = $piece ?: 'P';

        // Make lowercase if black'it's s turn
        if ($this->turn === 'b') {
            $piece = strtolower($piece);
        }

        if ($san == 'Bg4') {
            //dd($san, $full, $piece, $fileHint, $rankHint, $capture, $to, $promotion);
        }

        // convert $to to 0-based indices
        $toFile = ord($to[0]) - ord('a');
        $toRank = 8 - (int)$to[1];

        // find candidate pieces
        $candidates = [];
        foreach ($this->board as $r => $row) {
            foreach ($row as $f => $p) {

                if ($san == 'Bg4' && strtolower($p) == 'b') {
                    //dd("xx", $san, $piece, $fileHint, $rankHint, $p, $r, $f, $toRank, $toFile);
                }

                if ($p === null) continue;
                if ($p !== $piece) continue;
                // match hints
                if ($fileHint !== '' && ($f !== ord($fileHint) - ord('a'))) continue;
                if ($rankHint !== '' && ($r !== 8 - (int)$rankHint)) continue;

                if ($san == 'Bg4' && $r != 7) {
                    //dd("test", $san, $piece, $fileHint, $rankHint, $p, $r, $f, $toRank, $toFile);
                }

                // pawn forward move
                if (strtoupper($piece) === 'P' && $capture === '') {
                    $delta = $this->turn === 'w' ? -1 : 1;
                    if ($r + $delta !== $toRank) {
                        // check two-square initial move
                        $startRank = $this->turn === 'w' ? 6 : 1;
                        $toRankOne = $this->turn === 'w' ? 5 : 2;
                        $toRankTwo = $this->turn === 'w' ? 4 : 3;
                        // If two square move, square needs to be vacant
                        if ($toRankTwo === $toRank && ($this->board[$toRankOne][$toFile] !== null || $this->board[$toRankTwo][$toFile] !== null)) continue;

                        if ($toRankTwo === $toRank && $r == 1 && $f == 1 && $san == 'b5') {
                            //dd($san, $r, $f, $toRankTwo, $toFile, $this->getFen(), $this->board);
                        }
                        // 
                        if ($r !== $startRank || $r + 2 * $delta !== $toRank) continue;
                    }
                    if ($f !== $toFile) continue;
                }

                if ($san == 'Kxd8') {
                    //dd($san, $p, $r, $f, $toRank, $toFile, $this->canPieceReach($p, $r, $f, $toRank, $toFile));
                }

                // Check if the piece can actually reach the target
                if (!$this->canPieceReach($p, $r, $f, $toRank, $toFile)) continue;

                // here we could validate legal move, but for PGN import we assume legal
                $candidates[] = ['fromRank' => $r, 'fromFile' => $f];
            }
        }

        //dd($candidates);

        if (count($candidates) !== 1) {

            dd($san, $this->getFen(), $candidates);

            throw new \Exception("Ambiguous SAN: $san | FEN: " . $this->getFen());
        }

        $from = $candidates[0];
        $fromSq = chr($from['fromFile'] + ord('a')) . (8 - $from['fromRank']);
        $toSq = $to;

        // update board
        $this->board[$toRank][$toFile] = $this->board[$from['fromRank']][$from['fromFile']];
        $this->board[$from['fromRank']][$from['fromFile']] = null;

        // Update castling rights
        $this->updateCastlingRights($san, $from['fromRank'], $from['fromFile']);

        //if ($san == 'Kxd8') {
          //  dd($san, $from, $this->castlingWhite, $this->castlingBlack);
        //}

        // toggle turn
        $this->turn = $this->turn === 'w' ? 'b' : 'w';

        return ['from' => $fromSq, 'to' => $toSq];
    }

    private function updateCastlingRights(string $san, int $fromRank, int $fromFile): void
{
        // King moves (including castling)
    if (strtoupper($san) === 'O-O' || strtoupper($san) === 'O-O-O' || strtoupper($san[0]) === 'K') {

        if (strtoupper($san) === 'Kxd8') {
            dd($san, $this->turn, $this->getFen(), $this->castlingWhite, $this->castlingBlack);
        }

        if ($this->turn === 'w') {
            $this->castlingWhite = '';
        } else {
            $this->castlingBlack = '';
        }
        return;
    }

    // Rook moves
    if (strtoupper($san[0]) === 'R') {
        if ($this->turn === 'w') {
            // Queenside rook a1
            if ($fromRank === 7 && $fromFile === 0) {
                $this->castlingWhite = str_replace('Q', '', $this->castlingWhite);
            }
            // Kingside rook h1
            if ($fromRank === 7 && $fromFile === 7) {
                $this->castlingWhite = str_replace('K', '', $this->castlingWhite);
            }
        } else {
            // Queenside rook a8
            if ($fromRank === 0 && $fromFile === 0) {
                $this->castlingBlack = str_replace('q', '', $this->castlingBlack);
            }
            // Kingside rook h8
            if ($fromRank === 0 && $fromFile === 7) {
                $this->castlingBlack = str_replace('k', '', $this->castlingBlack);
            }
        }
    }
}


    private function handleCastling($san)
    {
        // Update castling rights
        $this->updateCastlingRights($san, 0, 0);

        // Get the turn
        $turn = $this->turn;
        // toggle turn
        $this->turn = $this->turn === 'w' ? 'b' : 'w';

        // handle castling
        if ($san === 'O-O' || strtoupper($san[0]) === 'K') {
            if ($turn === 'w') {
                // King
                $this->board[7][4] = null;
                $this->board[7][6] = 'K';
                // Rook
                $this->board[7][7] = null;
                $this->board[7][5] = 'R';
                return ['from' => 'e1', 'to' => 'g1'];
            } else {
                $this->board[0][4] = null;
                $this->board[0][6] = 'k';
                $this->board[0][7] = null;
                $this->board[0][5] = 'r';
                return ['from' => 'e8', 'to' => 'g8'];
            }
        }

        if ($san === 'O-O-O' || strtoupper($san[0]) === 'K') {
            if ($turn === 'w') {
                $this->board[7][4] = null;
                $this->board[7][2] = 'K';
                $this->board[7][0] = null;
                $this->board[7][3] = 'R';
                return ['from' => 'e1', 'to' => 'c1'];
            } else {
                $this->board[0][4] = null;
                $this->board[0][2] = 'k';
                $this->board[0][0] = null;
                $this->board[0][3] = 'r';
                return ['from' => 'e8', 'to' => 'c8'];
            }
        }
    }

    public function getFen(): string
    {
        $rows = [];
        foreach ($this->board as $r) {
            $empty = 0;
            $row = '';
            foreach ($r as $c) {
                if ($c === null) {
                    $empty++;
                } else {
                    if ($empty > 0) {
                        $row .= $empty;
                        $empty = 0;
                    }
                    $row .= $c;
                }
            }
            if ($empty > 0) $row .= $empty;
            $rows[] = $row;
        }

        return implode('/', $rows) . ' ' . $this->turn . ' ' . $this->castlingWhite . $this->castlingBlack .(empty($this->castlingWhite . $this->castlingBlack) ? '' : ' ') . '- 0 1';
    }

    /**
     * Checks if a piece at (fromRank, fromFile) can reach (toRank, toFile) 
     * according to movement rules (ignores checks for PGN import)
     */
    private function canPieceReach(string $piece, int $fromRank, int $fromFile, int $toRank, int $toFile): bool
    {
        $rankDiff = $toRank - $fromRank;
        $fileDiff = $toFile - $fromFile;

        switch (strtolower($piece)) {
            case 'p': // pawn
                $dir = $this->turn === 'w' ? -1 : 1;
                // Single forward
                if ($fileDiff === 0 && $rankDiff === $dir) return true;
                // Double forward from initial rank
                if ($fileDiff === 0 && $rankDiff === 2 * $dir && (($fromRank === 6 && $this->turn === 'w') || ($fromRank === 1 && $this->turn === 'b'))) return true;
                // Capture
                if (abs($fileDiff) === 1 && $rankDiff === $dir) return true;
                return false;

            case 'n': // knight

                //
                // Need to include if piece can move, due to exposing K to attack..
                // If the knight is pinned, it can't be a candidate.
                //
                // Same goes for other pieces, we need to have a check
                // to see if K will be in check after a certain move..
                //
                //
                //

                return ($rankDiff * $rankDiff + $fileDiff * $fileDiff) === 5;

            case 'b': // bishop
                //dd("b", $fromRank, $toRank, $fromFile, $toFile, abs($rankDiff), abs($fileDiff));
                if (abs($rankDiff) !== abs($fileDiff)) return false;
                $stepR = $rankDiff > 0 ? 1 : -1;
                $stepF = $fileDiff > 0 ? 1 : -1;
                $r = $fromRank + $stepR;
                $f = $fromFile + $stepF;
                while ($r !== $toRank && $f !== $toFile) {
                    if ($this->board[$r][$f] !== null) {
                        //dd("Bishop", $r, $f, $this->board);
                        return false;
                    }
                    $r += $stepR;
                    $f += $stepF;
                }
                return true;

            case 'r': // rook
                if ($rankDiff !== 0 && $fileDiff !== 0) return false;
                return $this->isPathClear($fromRank, $fromFile, $toRank, $toFile);

            case 'q': // queen
                if ($rankDiff !== 0 && $fileDiff !== 0 && abs($rankDiff) !== abs($fileDiff)) return false;
                return $this->isPathClear($fromRank, $fromFile, $toRank, $toFile);

            case 'k': // king
                return max(abs($rankDiff), abs($fileDiff)) === 1;

            default:
                return false;
        }
    }

    /**
     * Checks if all squares between from and to are empty (for sliding pieces)
     */
    private function isPathClear(int $fromRank, int $fromFile, int $toRank, int $toFile): bool
    {
        $rankStep = $toRank === $fromRank ? 0 : ($toRank > $fromRank ? 1 : -1);
        $fileStep = $toFile === $fromFile ? 0 : ($toFile > $fromFile ? 1 : -1);

        $r = $fromRank + $rankStep;
        $f = $fromFile + $fileStep;

        while ($r !== $toRank || $f !== $toFile) {
            if ($this->board[$r][$f] !== null) return false;
            $r += $rankStep;
            $f += $fileStep;
        }

        return true;
    }

    private function _canPieceReach(string $piece, int $fromRank, int $fromFile, int $toRank, int $toFile, array $board): bool
    {
        $dr = $toRank - $fromRank;
        $df = $toFile - $fromFile;

        switch (strtoupper($piece)) {
            case 'P':
                // already handled in the loop
                return true;
            case 'N':
                return in_array([$dr, $df], [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]);
            case 'B':
                if (abs($dr) !== abs($df)) return false;
                $stepR = $dr > 0 ? 1 : -1;
                $stepF = $df > 0 ? 1 : -1;
                $r = $fromRank + $stepR;
                $f = $fromFile + $stepF;
                while ($r !== $toRank && $f !== $toFile) {
                    if ($board[$r][$f] !== null) return false;
                    $r += $stepR;
                    $f += $stepF;
                }
                return true;
            case 'R':
                if ($dr !== 0 && $df !== 0) return false;
                $stepR = $dr === 0 ? 0 : ($dr > 0 ? 1 : -1);
                $stepF = $df === 0 ? 0 : ($df > 0 ? 1 : -1);
                $r = $fromRank + $stepR;
                $f = $fromFile + $stepF;
                while ($r !== $toRank || $f !== $toFile) {
                    if ($board[$r][$f] !== null) return false;
                    $r += $stepR;
                    $f += $stepF;
                }
                return true;
            case 'Q':
                // combination of rook + bishop
                return $this->canPieceReach('R', $fromRank, $fromFile, $toRank, $toFile)
                    || $this->canPieceReach('B', $fromRank, $fromFile, $toRank, $toFile);
            case 'K':
                return max(abs($dr), abs($df)) === 1;
        }

        return false;
    }
}
