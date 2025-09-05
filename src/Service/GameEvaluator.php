<?php

namespace App\Service;

use App\Entity\User;
use App\Library\ChessJs;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Class GameEvaluator
 * Service to evaluate chess games and identify mistakes.
 * This class processes game data, analyzes moves, and categorizes mistakes.
 * It uses the ChessJs library for chess logic and calculations.
 * 
 * ToDo:
 * - Add logging of steps for debug purposes.
 * - Split into smaller methods where needed.
 * 
 * - Add possibility of testing by just passing array of moves??
 * - will need to fetch all evaluations then.. no local stockfish option..
 */

class GameEvaluator
{
    private EntityManagerInterface $_em;
    private $user;
    private $settings;

    private array $_log;

    public function __construct(EntityManagerInterface $em, private Security $security)
    {
        $this->_em = $em;
        $this->_log = [];

        $this->user = $security->getUser();
        if ($this->user instanceof User) {
            $this->settings = $this->user->getSettings();
        }
    }

    private array $mistakesPoints = [
        "inaccuracy" => 1.5,
        "mistake"    => 2,
        "blunder"    => 3,
    ];

    /**
     * Evaluate a chess game and identify mistakes.
     * @param array $game The game data including FEN and moves.
     * @return array An array of identified mistakes with details.
     * 
     * The $game array structure expected by evaluateGame():
     *
     * [
     *   "color" => "white"|"black",      // Color to analyse
     *   "fen" => string|null,            // Initial FEN position (or null for standard)
     *   "moves" => [
     *     [
     *       "san" => string,             // Move in SAN notation
     *       "uci" => string,             // Move in UCI notation
     *       "ignore" => bool,            // Whether to ignore this move for mistake analysis
     *       "bestmoves" => [
     *         [
     *           "cp" => int,             // Centipawn evaluation
     *           "mate" => int|null,      // Mate in N moves (null if not mate)
     *           "move" => string,        // Best move in UCI notation
     *           "san" => string,         // Best move in SAN notation
     *           "line" => string[],      // Array of UCI moves for the best line
     *         ],
     *         // ... more best moves
     *       ],
     *       "fen" => string,             // FEN before this move
     *     ],
     *     // ... more moves
     *   ],
     * ]
     * 
     */
    public function evaluateGame(array $game): array
    {
        // Clear the log
        $this->_log = [];
        // Start a new chess game from the given FEN
        $chess = new ChessJs($game["fen"]);
        // Get the best starting moves
        $bestMoves = $game["moves"][0]["bestmoves"];
        // Get the initial centipawn and mate scores
        $bestCp = $bestMoves[0]["cp"] ?? 0;
        $bestMate = $bestMoves[0]["mate"] ?? null;

        $this->log('Initial bestMoves: ' . json_encode($bestMoves));

        // TEMP: manually set color for testing
        //$game["color"] = "white";

        // Determine if we are analyzing for black or white
        $analyseForBlack = $game["color"] === "black";
        $whiteToMove = true;
        // Calculate the initial win percentage
        $prevWinPct = $this->initialWinPct($bestCp, $bestMate);

        $accuracy = [];
        $mistakes = [];
        $centipawns = [];

        $halfMove = 1;
        $linePgn = "";
        $lineMoves = [];

        // The centipawn loss limit
        $cpLossLimits = [
            0 => 300, // 3 pawns
            1 => 600, // rook and pawn or 2 minor pieces
            2 => 800, // rook and minor
        ];

        // The centipawn loss limit for mistakes
        $cpLossLimit = $cpLossLimits[$this->settings->getMistakeTolerance() ?? 0];
        $cpLossTotal = 0;

        $this->log('Initial cp: ' . $bestCp . ', mate: ' . ($bestMate ?? 'n/a') . ', win%: ' . round($prevWinPct, 2) . ', analyse for black: ' . ($analyseForBlack ? 'yes' : 'no')  );

        // Loop through each move in the game
        foreach ($game["moves"] as $move) {
            // Store the FEN and best moves before making the move
            $fenBefore = $chess->fen();
            $bestMovesBefore = [...$bestMoves];
            // Make the move
            $chess->move($move["san"]);

            $this->log('Move ' . $move["san"] . ', fen: ' . $fenBefore . ', gameOver: ' . ($chess->gameOver() ? 'yes' : 'no'));

            // If the game is over, exit the loop
            if ($chess->gameOver()) {
                break;
            }

            // Get the best moves after making the move
            $bestMoves = $move["bestmoves"];
            $whiteToMove = !$whiteToMove;

            // Get the centipawn and mate scores for the current move
            $moveCp = $bestMoves[0]["cp"];
            $moveMate = $bestMoves[0]["mate"];

            $this->log('Best move cp: ' . $moveCp . ', mate: ' . ($moveMate ?? 'n/a') . ', engine:' . (isset($move['engine']) ? ($move['engine'] ? 'yes' : 'no') : 'n/a'));

            // skip first move to avoid false blunders
            //if ($halfMove > 1 && $this->shouldAnalyseMove($whiteToMove, $analyseForBlack)) {
            //if ($this->shouldAnalyseMove($whiteToMove, $analyseForBlack)) {
                // Calculate the win percentage and accuracy
                [$winPct, $acc] = $this->calculateWinPct($moveCp, $moveMate, $analyseForBlack, $prevWinPct);
                $accuracy[] = $acc;

                // Calculate the percentage loss in win probability
                $pctLoss = $this->calculatePctLoss($prevWinPct, $winPct);

                $this->log('Win%: ' . $winPct . ', acc: ' . $acc . ', %loss: ' . $pctLoss . ', ignore: ' . ($move["ignore"] ? 'yes' : 'no'));

            //
            if ($this->shouldAnalyseMove($whiteToMove, $analyseForBlack)) {
                // The centipawn loss for this move
                $cpLoss = max(0, $bestCp - $moveCp);
                // Keep track of total centipawn loss for mistakes
                if ($cpLoss > 0) {
                    $cpLossTotal += $bestCp - $moveCp;

                    $this->log('Centipawn loss: ' . $cpLoss . ', total: ' . $cpLossTotal);
                }

                // Build the mistake array
                $mistake = [
                    "move" => $move["san"],
                    "moveCp" => $moveCp,
                    "cpLoss" => $cpLoss,
                    "type" => $this->determineMistakeType($pctLoss, $this->settings),
                    "bestmoves" => [],
                    "fen" => $fenBefore,
                    "line" => ["pgn" => $linePgn, "moves" => $lineMoves],
                    "mate" => $moveMate
                ];

                // If it was a mistake and we shouldn't ignore it, add it
                if ($mistake["type"] !== "" && !$move["ignore"]) {

                    $this->log('Mistake detected: ' . json_encode($mistake));
                    
                    // Keep track of the total mistake points (for limiting)
                    //$mistakesTotal += $this->mistakesPoints[$mistake["type"]];
                    // Populate the best moves for the mistake
                    $this->populateBestMoves($chess, $bestMovesBefore, $mistake, $prevWinPct, $analyseForBlack, $move['san']);
                    //$this->populateBestMoves($chess, $bestMoves, $mistake, $prevWinPct, $analyseForBlack, $move['san']);
                    if (count($mistake["bestmoves"]) > 0) {
                        $mistakes[] = $mistake;
                    }
                }

                //dd($winPct, $acc, $prevWinPct, $fenBefore, $bestMovesBefore, $whiteToMove, $moveCp, $moveMate, $mistakesTotal, $mistakesLimit);

            } else {
                // If we are not analyzing this move, just update the previous win percentage
                //[$prevWinPct,] = $this->calculateWinPct($moveCp, $moveMate, $analyseForBlack, $prevWinPct);

                //dd($prevWinPct);
                //$this->log('Not analysing move, updated prevWinPct to: ' . round($prevWinPct, 2));
                $this->log('Not analysing move for mistakes');
            }

            // Remember the previous win percentage
            $prevWinPct = $winPct;

            // Remember the current move centipawn for next move
            $bestCp = $moveCp;
            $centipawns[] = [$move["san"], $moveCp];

            $linePgn .= ($linePgn != "" ? " " : "") . ($halfMove % 2 == 1 ? ceil($halfMove / 2) . ". " : "") . $move['san'];
            $lineMoves[] = $move['san'];

            $halfMove++;

            // If we've reached the mistake limit, exit the loop
            //if ($mistakesTotal >= $mistakesLimit) {
            if ($cpLossTotal >= $cpLossLimit) {

                $this->log('Reached centipawn loss limit of ' . $cpLossLimit . ', stopping analysis');

                break;
            }
        }

        // Keep the centipawns in there for debugging purposes
        $mistakes[] = ["centipawns" => $centipawns];

        return $mistakes;
    }

    // Return the log
    public function getLog(): array
    {
        return $this->_log;
    }

    //
    // Calculate win percentage, accuracy and percentage loss
    //

    private function _calculateWinPct(int $cp, ?int $mate): float
    {
        if (!empty($mate) && $mate !== 0) return 100;
        return 50 + 50 * (2 / (1 + exp(-0.00368208 * $cp)) - 1);
    }

    private function _calculateAccuracy(float $prevWinPct, float $winPct): float
    {
        return 103.1668 * exp(-0.04354 * ($prevWinPct - min($prevWinPct, $winPct))) - 3.1669;
    }

    private function calculatePctLoss(float $prevWinPct, float $winPct): float
    {
        return $prevWinPct == -1 ? 0 : max(0, ($prevWinPct - $winPct) / 100);
    }

    //
    // Helpers for evaluateGame()
    //

    private function initialWinPct(int $cp, ?int $mate): float
    {
        if (!empty($mate) && $mate !== 0) {
            
            $this->log('Initial mate detected, setting win% to 100');

            return 100;
        }

        $this->log('--- cp: ' . $cp . ', win%: ' . (50 + 50 * (2 / (1 + exp(-0.00368208 * $cp)) - 1)));

        return 50 + 50 * (2 / (1 + exp(-0.00368208 * $cp)) - 1);
    }

    private function shouldAnalyseMove(bool $whiteToMove, bool $analyseForBlack): bool
    {
        return (!$whiteToMove && !$analyseForBlack) || ($whiteToMove && $analyseForBlack);
    }

    private function calculateWinPct(int $cp, ?int $mate, bool $analyseForBlack, $prevWinPct = 0.0): array
    {
        if (!empty($mate) && $mate !== 0) {
            $winPct = 100;
        } else {
            $winPct = 50 + 50 * (2 / (1 + exp(-0.00368208 * $cp)) - 1);
            if ($analyseForBlack) {
                $winPct = 100 - $winPct;
            }
        }
        $acc = 103.1668 * exp(-0.04354 * ($prevWinPct - min($prevWinPct, $winPct))) - 3.1669;
        return [$winPct, $acc];
    }

    private function determineMistakeType(float $pctLoss, $settings): string
    {
        if ($pctLoss == 0) return "";
        if ($pctLoss < 0.02) return ""; // excellent move
        if ($pctLoss < 0.05) return ""; // good move
        if ($pctLoss < 0.1) {
            return $settings->isAnalyseIgnoreInaccuracy() ? "" : "inaccuracy";
        }
        if ($pctLoss < 0.2) return "mistake";
        return "blunder";
    }

    // Get the move details from UCI notation
    private function getUciMoveDetails(string $uci): array
    {
        $fromSquare = substr($uci, 0, 2);
        $toSquare = substr($uci, 2, 2);
        $promotion = strlen($uci == 5) ? substr($uci, 5) : "";
        return [$fromSquare, $toSquare, $promotion];
    }

    /**
     * Sort the best moves by centipawn or mate score.
     * Test the moves for validity.
     * Calculate win percentage to make sure it's not an inaccuracy.
     * Add to the mistake bestmoves if valid and it's a good move.
     */
    private function populateBestMoves($chess, array $bestMovesBefore, array &$mistake, float $prevWinPct, bool $analyseForBlack, $moveSan): void
    {
        $historyFirst = $chess->history(['verbose' => true]);
        // undo the current move so we can test the best moves
        $chess->undo();
        // make sure the best moves are sorted according to color
        $bestMovesBefore = $this->sortBestMoves($bestMovesBefore, $analyseForBlack);
        // loop through the best moves and test them
        foreach ($bestMovesBefore as $bm) {

            $this->log("BestMove: " . $bm["move"]);

            // get the move details
            [$fromSquare, $toSquare, $promotion] = $this->getUciMoveDetails($bm["move"]);
            //$fromSquare = substr($bm["move"], 0, 2);
            //$toSquare = substr($bm["move"], 2, 2);
            //$promotion = strlen($bm["move"] == 5) ? substr($bm["move"], 5) : "";

            //print "move(2): " . $bm["move"] . "--";

            $historyBefore = $chess->history(['verbose' => true]);

            // make the move
            $ret = $chess->move(["from" => $fromSquare, "to" => $toSquare, "promotion" => $promotion]);
            if ($ret == null) {

                print "Invalid move: " . $bm['move'] . "<br>";

                dd($chess->fen(), $historyFirst, $historyBefore, $this->_log);

                // invalid move.. ? do something.. ?

            } else {
                // get the last move
                $history = $chess->history(['verbose' => true]);
                $last = array_pop($history);

                //print "undo move(2)--";

                // undo the last move
                $chess->undo();

                /*

                For 2nd and 3rd best moves:
                            
                - we need to check if the move itself is not a mistake... 
                - if it is, we would be suggesting a slightly worse mistake instead of the mistake made
                - check using win pct??

                */

                // if this is the move we made (2nd or 3rd best)
                if ($moveSan == $last["san"]) {
                    // we have all the better moves, exit foreach
                    break;
                }

                // add the move
                $add = true;

                // if this is not the 1st best move
                if (count($mistake["bestmoves"]) > 0) {
                    // calculate the win percentage for this move
                    [$moveWinPct,] = $this->calculateWinPct($bm['cp'], $bm['mate'], $analyseForBlack, $prevWinPct);

                    // calculate the move percentage loss
                    $movePctLoss = $this->calculatePctLoss($prevWinPct, $moveWinPct);

                    // add if not an inaccuracy or worse
                    $add = $movePctLoss < .1;
                }

                // add to the bestmoves
                if ($add) {
                    // get the san moves from the uci moves..
                    foreach ($bm["line"] as $lmove) {
                        // get the move details
                        $fromSquare = substr($lmove, 0, 2);
                        $toSquare = substr($lmove, 2, 2);
                        $promotion = strlen($lmove == 5) ? substr($lmove, 5) : "";
                        // make the move
                        $ret = $chess->move(["from" => $fromSquare, "to" => $toSquare, "promotion" => $promotion]);
                        if ($ret == null) {
                            print "move is null?<br>";
                            dd($lmove, $chess->history(['verbose' => true]));
                        }
                    }

                    $sanMoves = [];
                    foreach ($bm["line"] as $lmove) {
                        // get the last move
                        $history = $chess->history(['verbose' => true]);
                        $last = array_pop($history);
                        array_unshift($sanMoves, $last["san"]);
                        // undo the last move
                        $chess->undo();
                    }

                    $mistake["bestmoves"][] = [
                        "move" => $bm["move"],
                        "san" => $last["san"],
                        "cp" => $bm["cp"],
                        "mate" => $bm["mate"],
                        //"line" => $bm["line"],
                        "line" => $sanMoves
                    ];

                    // if we have 3 best moves, break the loop (lichess evals sometimes has more than 3)
                    if (count($mistake["bestmoves"]) == 3) {
                        break;
                    }
                }
            }
        }

        //print "move(3): " . $move["san"] . "--";

        // redo the current move
        $chess->move($moveSan);

        /*

        If no best moves known, do we need to add?
        Not sure how this could happen, but as safety measure perhaps.. ?

        */

        // add the mistake
        if (count($mistake["bestmoves"]) > 0) {
            $mistakes[] = $mistake;
        }
    }

    // Sort best moves based on analysis color
    private function sortBestMoves(array $bestMoves, bool $analyseForBlack): array
    {
        if ($analyseForBlack) {
            usort($bestMoves, function ($a, $b) {
                if ($a["mate"] !== null && $b["mate"] == null) return -1;
                if ($a["mate"] == null && $b["mate"] !== null) return 1;
                if ($a["mate"] !== null && $b["mate"] !== null) {
                    if ($a["mate"] < $b["mate"]) return -1;
                    if ($a["mate"] > $b["mate"]) return 1;
                }
                if ($a["cp"] > $b["cp"]) return 1;
                if ($a["cp"] < $b["cp"]) return -1;
                return 0;
            });
        } else {
            usort($bestMoves, function ($a, $b) {
                if ($a["mate"] !== null && $b["mate"] == null) return -1;
                if ($a["mate"] == null && $b["mate"] !== null) return 1;
                if ($a["mate"] !== null && $b["mate"] !== null) {
                    if ($a["mate"] < $b["mate"]) return -1;
                    if ($a["mate"] > $b["mate"]) return 1;
                }
                if ($a["cp"] > $b["cp"]) return -1;
                if ($a["cp"] < $b["cp"]) return 1;
                return 0;
            });
        }
        return $bestMoves;
    }

    // Simple logging function (to be expanded later)
    private function log(string $message): void
    {
        $this->_log[] = $message;
    }
}
