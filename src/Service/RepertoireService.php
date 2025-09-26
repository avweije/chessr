<?php

namespace App\Service;

use App\Entity\MoveStats;
use App\Entity\User;
use App\Library\Debugger;
use App\Repository\RepertoireRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bundle\SecurityBundle\Security;

class RepertoireService
{
    private $user = null;
    private $settings = null;
    private $repo;
    private $chessHelper;
    private $debugger;

    // Lines
    private $_allReps = null;
    private $_movesPerFen = null;
    private $_focusMoves = null;

    private array $candidates = [
        'must'   => [],
        'high'   => [],
        'medium' => [],
        'low'    => [],
    ];

    public function __construct(
        ManagerRegistry $registry,
        private Security $security,
        RepertoireRepository $repository,
        ChessHelper $chessHelper,
        Debugger $debugger
    ) {
        $this->user = $security->getUser();
        if ($this->user instanceof User) {
            $this->settings = $this->user->getSettings();
        }
        $this->repo = $repository;
        $this->chessHelper = $chessHelper;
        $this->debugger = $debugger;
    }

    // get the roadmap (split by eco/moves??)
    public function getRoadmap(): array
    {
        return $this->getLines(null, true)[0];
    }

    // gets the white lines in the lines returned from getLines()
    public function getWhiteLines($lines)
    {
        // get the white lines
        $white = $this->collectLinesUntil($lines, 'white');

        // Remove the doubled lines (through transposition)
        $white = $this->removeDoubledMoves($white);

        //dd(count($test), count($white));

        // group by position and return
        return $this->groupByPosition($white, $lines);
    }

    // gets the black lines in the lines returned from getLines()
    public function getBlackLines($lines)
    {
        // get the black lines
        $black = $this->collectLinesUntil($lines, 'black');

        // Remove the doubled lines (through transposition)
        $black = $this->removeDoubledMoves($black);

        // group by position and return
        return $this->groupByPosition($black, $lines);
    }

    // gets the new lines in the lines returned from getLines()
    public function getNewLines($lines)
    {
        // get the new lines
        $new = $this->collectLinesUntil($lines, '', true);

        // Remove the doubled lines (through transposition)
        //$new = $this->removeDoubledMoves($new);

        // group by position and return
        return $this->groupByPosition($new, $lines);
    }

    // gets the recommended lines in the lines returned from getLines()
    public function getRecommendedLines(array $lines, bool $refresh = false): array
    {
        // see if we have recommended lines in our session
        if (!$refresh && isset($_SESSION['recommendedLines'])) {
            return $_SESSION['recommendedLines'];
        }

        // Update the recommended completed flag
        $_SESSION['recommendedCompleted'] = false;

        // compute global stats
        $globalStats = $this->computeGlobalStats($lines);

        $this->debugger::collect('globalStats', $globalStats);

        // reset candidates
        $this->candidates = [
            'must'   => [],
            'high'   => [],
            'medium' => [],
            'low'    => [],
        ];

        // Remove the doubled lines (through transposition)
        $lines = $this->removeDoubledMoves($lines);

        // recursively assign recommendation
        $lines = $this->assignRecommendation($lines, $globalStats);

        $this->debugger::collect('high', count($this->candidates['high']));
        $this->debugger::collect('medium', count($this->candidates['medium']));
        $this->debugger::collect('low', count($this->candidates['low']));

        $targetSize = $this->determineTargetSize($globalStats);
        $totalMoves = 0;

        $result = [];
        $usedMoves = []; // to mark moves that have been included

        foreach (['must', 'high', 'medium', 'low'] as $level) {
            if ($totalMoves >= $targetSize) break;

            $candidates = $this->candidates[$level] ?? [];

            // sort candidates by factor descending
            usort($candidates, function ($a, $b) {
                // Sort by factor descending
                $eq = $b['recommendation']['factor'] <=> $a['recommendation']['factor'];
                if ($eq === 0) {
                    // If equal, sort by PGN ascending
                    $eq = join('', $a['line']) <=> join('', $b['line']);
                }
                return $eq;
            });

            foreach ($candidates as $candidate) {
                if ($totalMoves >= $targetSize) break;

                $moveKey = $candidate['id'];
                if (isset($usedMoves[$moveKey])) continue;

                //
                // Threshold: use recommend interval settings to set this dynamically
                // Larger for more recommendations, more lenient
                // 
                $thresholds = [1.4, 1.8, 2.2, 2.6];

                // test a bit with the threshold (to keep moves in a line together)
                $threshold = $thresholds[$this->settings->getRecommendInterval() ?? 0] ?? 1;
                //$threshold = 0;

                $this->debugger::collect('threshold', $threshold);

                // Always start with -1, our own move is in the candidate
                $baseScore = -1;

                //dd($candidate);

                // Collect line until recommendation drops
                $lineUntil = $this->collectRecommendedUntil(['moves' => [$candidate]], $usedMoves, $baseScore, $threshold);

                // Make sure we have at least one move
                $moveCount = $this->countMoves($lineUntil);
                $totalMoves = $totalMoves + $moveCount;
                if ($moveCount > 0) {
                    foreach ($lineUntil as $move) {
                        $result[] = $move;
                        $usedMoves[$move['id']] = true;
                    }
                }
            }
        }

        //dd($result);

        // Reattach earlier cut off moves to their parents
        // We cut off moves based on the threshold, to ensure we get the highest recommended moves
        // If there aren't many and a cut off moves is also added as recommended later on
        // We reattach them to their parent so the lines are all consistent
        $reattached = $this->reattachTopMoves($result);

        // We need to remove the last opponent move that has no moves behind it
        // We had to leave them in to be able to reattch
        // We can now safely remove those last moves again to cleanup the lines
        $cleanedUp = $this->removeLastOpponentMoves($reattached);

        // group by position and return
        $recommended = $this->groupByPosition($cleanedUp, $lines);

        // store in session
        $_SESSION['recommendedLines'] = $recommended;

        return $recommended;
    }

    // Remove doubles, moves that can be reached in several ways
    function removeDoubledMoves($lines, &$usedMoves = null) {
        if ($usedMoves === null) {
            $usedMoves = [];
        }
        $result = [];
        //$usedMoves = [];
        foreach ($lines as $line) {
            //
            $isOurMove = $this->isOurMove($line['before'] ?? '', $line['color'] ?? '');

            $line['doubled-our-move'] = $isOurMove;
            $line['doubled-used-move-count'] = count($usedMoves);
            //
            if ($isOurMove) {
                //
                if (in_array($line['id'], $usedMoves)) {

                    //dd("Found doubled:", $line);
                    $this->debugger::collect("Doubled", [
                        'move' => $line['move'],
                        'before' => $line['before']
                    ]);

                    continue;
                }
                //
                $usedMoves[] = $line['id'];
            }

            // If we need to traverse the child moves
            if (count($line['moves']) > 0) {
                // Check for doubled moves in the child moves of this line
                $line['moves'] = $this->removeDoubledMoves($line['moves'], $usedMoves);
            }
            // Add the line
            $result[] = $line;
        }

        return $result;
    }

    // Remove the last opponent moves that have no moves of ours anymore
    function removeLastOpponentMoves($lines) {
        $result = [];
        foreach ($lines as $line) {
            //
            $isOurMove = $this->isOurMove($line['before'] ?? '', $line['color'] ?? '');
            //
            if (count($line['moves']) > 0) {
                //
                $line['moves'] = $this->removeLastOpponentMoves($line['moves']);
                //
                $result[] = $line;
            } elseif ($isOurMove) {
                //
                $result[] = $line;
            }
        }

        return $result;
    }

    function reattachTopMoves(array $topMoves): array
    {
        // Deep copy to avoid mutating original array
        //$moves = json_decode(json_encode($topMoves), true);
        $moves = $topMoves;


        $result = [];

        for ($i = 0; $i < count($moves); $i++) {
            $move = $moves[$i];
            $attached = false;

            //dd($move, $move['color'], $move['line'], $move['move']);

            // Try attaching to other top-level moves
            for ($j = 0; $j < count($moves); $j++) {
                if ($i === $j) continue;

                //$parent = $this->findExactParent($moves[$j], $move['color'], array_merge($move['line'], [$move['move']]));
                if ($this->findExactParent($moves[$j], $move['color'], $move['line'], $move)) {
                    $attached = true;

                    break;

                    //dd($move, $moves[$j], $result);
                }
            }

            if (!$attached) {
                //$result[] = $move;
                //$result[] = $moves[$i];
            }

            $moves[$i]["attached"] = $attached;
        }

        foreach ($moves as $move) {
            if (!$move['attached']) {
                $result[] = $move;
            }
        }

        //dd($moves);

        return $result;
    }

    // Recursive function to find exact parent
    private function findExactParent(array &$node, string $color, array $lineToAttach, array $move, $parentMatch = false): bool
    {

        $nodeLinePlusMove = array_merge(
            $node['line'] ?? [],
            $node['move'] !== null ? [$node['move']] : []
        );

        // If the color is a mismatch, we can stop here
        if ($color !== $node['color']) return false;

        // If the line for the parent candidate is longer, it's not a match
        if (count($nodeLinePlusMove) > count($lineToAttach)) return false;

        // If the 1st line moves aren't a match, we can stop here
        $first = array_slice($lineToAttach, 0, count($nodeLinePlusMove), true);

        if ($first !== $nodeLinePlusMove) {
            return false;
        }

        //if ($node['id'] == 291) {
            //dd($lineToAttach, $nodeLinePlusMove, $node);
        //}

        //dd($nodeLinePlusMove, $first, $lineToAttach, $move);

        $this->debugger::collect('NearMatch',[
            'lineToAttach' => join(' ', $lineToAttach),
            'nodeLinePlusMove' => join(' ', $nodeLinePlusMove)
        ]);

        //
        $match = $lineToAttach === $nodeLinePlusMove;

        // Exact match
        if ($match) {
            //return $node;
            if (!isset($node['moves'])) $node['moves'] = [];
            $node['moves'][] = $move;   // mutates the original

            //dd("Found");

            return true;
        }

        // Recurse through children
        if (!empty($node['moves'])) {
            foreach ($node['moves'] as &$child) {
                
                if ($match) {
                   //dd("Checking children", $child, $color, $lineToAttach, $move);
                }

                if ($this->findExactParent($child, $color, $lineToAttach, $move, $match)) {
                    return true;
                }
            }
        }

        return false;
    }

    public function countMoves(array $lines, $includePlayed = true): int
    {
        $count = 0;
        foreach ($lines as $line) {
            // count only our moves
            if ($this->isOurMove($line['before'] ?? '', $line['color'] ?? '')) {
                $count++;
            }
            if (!empty($line['moves'])) {
                $count += $this->countMoves($line['moves']);
            }
        }
        return $count;
    }

    // Update the session recommended lines, set move as played
    public function updateSessionRecommended(int $id): void
    {
        if (!isset($_SESSION['recommendedLines'])) {
            //dd("updateSessionRecommended: No recommended lines, returning");
            return;
        }
        // Update the session recommended lines
        $_SESSION['recommendedLines'] = $this->updateSessionRecommendedMove($id, $_SESSION['recommendedLines']);

        // Update the recommended completed flag
        $_SESSION['recommendedCompleted'] = count($_SESSION['recommendedLines']) === 0;
    }

    /**
     * Recursively update a move in recommended lines and remove lines if all our moves are done
     *
     * @param int $id The move ID that was played
     * @param array $lines The current set of lines
     * @return array Updated lines
     */
    private function updateSessionRecommendedMove(int $id, array $lines): array
    {
        $updatedLines = [];

        foreach ($lines as $line) {
            $line = $this->markMovePlayed($line, $id);

            // Check if all "our moves" are played (assuming opponent moves don't have 'id')
            $allOurMovesPlayed = $this->allOurMovesPlayed($line);

            // Keep the line only if not all moves are played
            if (!$allOurMovesPlayed) {
                $updatedLines[] = $line;
            }
        }

        return $updatedLines;
    }

    /**
     * Recursively mark the move with $id as played
     */
    private function markMovePlayed(array $line, int $id): array
    {
        if (isset($line['id']) && $line['id'] == $id) {
            $line['played'] = true;

            // What if we just set autoplay here?
            // If the line isn't completely done, the played moves will be auto-played..
            // Should be a great fix ?
            $line['autoplay'] = true;
        }

        // We only want to keep the lines that arent completely played
        $unplayed = $line;
        $unplayed['moves'] = [];

        if (!empty($line['moves'])) {
            foreach ($line['moves'] as $i => $child) {
                $line['moves'][$i] = $this->markMovePlayed($child, $id);
                // Add if not all moves have been played (in practice, recommended)
                if (!$this->allOurMovesPlayed($line['moves'][$i])) {
                    $unplayed['moves'][] = $line['moves'][$i];
                }
            }
        }

        //return $line;
        return $unplayed;
    }

    /**
     * Recursively check if all "our moves" in a line are played
     */
    private function allOurMovesPlayed(array $line): bool
    {
        // If this is our move
        if ($this->isOurMove($line['before'] ?? '', $line['color'] ?? '')) {
            if (empty($line['played']) || !$line['played']) {
                return false;
            }
        }

        if (!empty($line['moves'])) {
            foreach ($line['moves'] as $child) {
                if (!$this->allOurMovesPlayed($child)) {
                    return false;
                }
            }
        }

        return true;
    }

    private function getCompositeScore($move)
    {
        if (!isset($move['recommendation'])) {
            return -3;
        }
        $levelMap = ['low' => 1, 'medium' => 2, 'high' => 3, 'must' => 4];
        $levelValue = $levelMap[$move['recommendation']['level']] ?? 0;
        $factor = $move['recommendation']['factor'] ?? 0;
        return $levelValue + $factor;
    }

    /**
     * Recursively collect moves following $move until recommendation drops below threshold
     */
    private function collectRecommendedUntil(array $line, array &$usedMoves, float $baseScore, float $minThreshold = 1): array
    {
        $result = [];

        //dd($minThreshold);

        foreach ($line['moves'] as $move) {
            $moveId = $move['id'] ?? null;

            /**
             * We can have a situation where we have 3 moves that follow each other,
             * but the last in the variation has the highest factor.
             * So we 1st get the 3rd move, than the 2nd, than the 1st.
             * In practice, you will have the moves in the wrong order.
             * 
             * Maybe if a move already exists, we can check if it's a 
             * top level move. If it is, we can 'remove' that array item
             * and replace it by the current. To which the other move will be added.
             */
            if ($moveId === null || isset($usedMoves[$moveId])) {
                continue;
            }

            $thisBase = $baseScore;

            $isOurMove = $this->isOurMove($move['before'] ?? '', $move['color'] ?? '');

            $move['baseScore'] = $baseScore;
            $move['baseIsOurMove'] = $isOurMove;

            // If we don't have the base score yet (top level call)
            if ($baseScore == -1) {
                $thisBase = $isOurMove ? $this->getCompositeScore($move) : -1;
            } else if ($isOurMove) {

                // if under a certain threshold, never include
                if ($this->isUnderRecommendationThreshold($move)) {
                    break;
                }

                // get the composite score
                $compositeScore = $this->getCompositeScore($move);
                $drop = $baseScore - $compositeScore;

                //dd($baseScore, $compositeScore, $drop, $move);

                $move['baseDrop'] = $drop;
                $move['baseThreshold'] = $minThreshold;
                $move['compositeScore'] = $compositeScore;

                // stop if the drop exceeds the threshold
                if ($drop > $minThreshold) {

                    //dd("dropped", $drop, $compositeScore, $baseScore);

                    break;
                }

                //dd("We got 1", $baseScore, $compositeScore, $drop, $minThreshold);
            } else {
                // Not our move, reset base
                //$thisBase = -1;
            }

            $move['thisBase'] = $thisBase;

            $usedMoves[$moveId] = true;

            if (!empty($move['moves'])) {
                $move['moves'] = $this->collectRecommendedUntil($move, $usedMoves, $thisBase, $minThreshold);
            }

            if ($isOurMove || count($move['moves']) > 0) {
                // Add the move count (our moves)
                $move['ourMoveCount'] = 1 + $this->countMoves($move['moves']);

                $result[] = $move;
            } elseif (!$isOurMove && count($move['moves']) == 0) {
                // We need to keep the last opponent move in there
                // Otherwise we can't reattach earlier cut-off lines
                // In practice.js, we need to skip the opponent moves that have no moves of its own
                //
                // Is there a nicer way of doing this?
                // It's cleaner not to send the last opponent move
                // As it's not being used for anything in practice
                //
                // We can make another function to clear the last opponent moves in each line
                // Wouldnt be a lot of work...
                $result[] = $move;
            }

            //if ($moveId == 290) {
                //dd($isOurMove, $move);
            //}
        }

        return $result;
    }

    private function isUnderRecommendationThreshold($move): bool
    {
        // Get the recommend interval (0-3)
        $recommendInterval = 4 - ($this->settings->getRecommendInterval() ?? 1);
        // Set the threshold based on the interval
        //$threshold = 0.2 * $recommendInterval;
        //$threshold = 0.1 * $recommendInterval;
        $threshold = 0.2;

        return (isset($move['recommendation']) && $move['recommendation']['level'] == 'low' && $move['recommendation']['factor'] < $threshold);
    }


    // get all lines, including the excluded ones
    public function getAllLines(): array
    {
        return $this->getLines(null, false, false, true);
    }



    /**
     * Recursively collect contiguous blocks of "new" moves in a tree.
     *
     * @param array $lines       Current level of moves
     * @param array $lineSoFar   Array of moves leading to current position
     * @param array &$seen       Keeps track of seen positions to prevent duplicates
     * @return array             Array of moves with full info and preceding line
     */
    private function collectLinesUntil(array $lines, string $color = '', bool $newOnly = false, array $lineSoFar = [], array &$seen = []): array
    {
        $result = [];

        $ourMoveCount = 0;

        foreach ($lines as $move) {
            // Determine if this move is "our move"
            $ourMove = isset($move['before']) && isset($move['color']) ? $this->isOurMove($move['before'], $move['color']) : false;

            // Get if this move is new and matches the color filter
            $isNew = $ourMove && (!empty($move['new']) && $move['new'] == 1);
            $isRightColor = empty($color) || ($move['color'] ?? '') == $color;

            // Determine if this move matches our criteria
            $isMatch = ($newOnly && $isNew) || (!$newOnly && $isRightColor);

            // Build the line leading to this move
            $currentLine = $lineSoFar;

            // Track unique positions to prevent duplicates
            $uniqueKey = $move['after'] ?? null;

            // Start a new practice line if this move is new
            if ($isMatch && isset($move['move']) && $uniqueKey && !isset($seen[$uniqueKey])) {
                //if ($isMatch && isset($move['move']) && $uniqueKey) {
                $seen[$uniqueKey] = true;

                // Increase our move count
                //$ourMoveCount++;

                // Recursively collect moves in this contiguous block
                [$subMoves, $lineMoveCount] = $this->collectLineUntil($move['moves'], $color, $newOnly, $seen);

                // Add the line move count (our moves)
                $ourMoveCount += $lineMoveCount;

                $result[] = [
                    'move' => $move['move'],
                    'line' => $currentLine,
                    'before' => $move['before'] ?? '',
                    'after' => $move['after'] ?? '',
                    'color' => $move['color'] ?? '',
                    'new' => $move['new'] ?? 0,
                    'recommended' => $move['recommended'] ?? 0,
                    'autoplay' => $move['autoplay'] ?? false,
                    'focused' => $move['focused'] ?? false,
                    'focusedParent' => $move['focusedParent'] ?? false,
                    'notes' => $move['notes'] ?? '',
                    'ourMoveCount' => $ourMoveCount,
                    'moves' => $subMoves,
                    'id' => $move['id'] ?? 0,
                    'initialFen' => $move['initialFen'] ?? '',
                    'multiple' => $move['multiple'] ?? false,
                    'practiceCount' => $move['practiceCount'] ?? 0,
                    'practiceFailed' => $move['practiceFailed'] ?? 0,
                    'practiceInARow' => $move['practiceInARow'] ?? 0,
                ];
            }

            // Always recurse further to find later matching blocks
            if (!empty($move['moves'])) {
                $childLineSoFar = $currentLine;
                if (!empty($move['move'] ?? null)) {
                    $childLineSoFar[] = $move['move'];
                }
                $result = array_merge(
                    $result,
                    $this->collectLinesUntil($move['moves'], $color, $newOnly, $childLineSoFar, $seen)
                );
            }
        }

        return $result;
    }

    /**
     * Helper to recursively collect moves **until the filter stops matching**
     * Includes opponent moves, stops at first non-matching "our move"
     *
     * @param array $moves
     * @param array &$seen
     * @return array [subMoves, ourMoveCount]
     */
    private function collectLineUntil(array $moves, string $color = '', bool $newOnly = false, array &$seen): array
    {
        $line = [];
        $ourMoveCount = 0;

        foreach ($moves as $move) {
            $ourMove = isset($move['before']) && isset($move['color']) ? $this->isOurMove($move['before'], $move['color']) : false;
            $autoplay = $move['autoplay'] ?? false;

            // Get if this move is new and matches the color filter
            $isNew = $ourMove && (!empty($move['new']) && $move['new'] == 1);
            $isRightColor = empty($color) || ($move['color'] ?? '') == $color;

            // Determine if this move matches our criteria
            $isMatch = ($newOnly && $isNew) || (!$newOnly && $isRightColor);

            // Stop the block if it's our move and not new
            if ($ourMove && !$isMatch) {
                continue;
            }

            $uniqueKey = $move['after'] ?? null;
            if ($isMatch && $uniqueKey && !isset($seen[$uniqueKey])) {
                $seen[$uniqueKey] = true;
            }

            // Recursively include child moves
            [$subMoves, $subCount] = $this->collectLineUntil($move['moves'] ?? [], $color, $newOnly, $seen);

            $ourMoveCount += $ourMove && !$autoplay ? 1 + $subCount : $subCount;
            // Only count this move if it's ours and new (and not autoplay)
            //$ourMoveCount += $ourMove && !$autoplay && (!$newOnly || $isNew) ? 1 + $subCount : $subCount;

            $line[] = [
                'move' => $move['move'] ?? '',
                'before' => $move['before'] ?? '',
                'after' => $move['after'] ?? '',
                'color' => $move['color'] ?? '',
                'new' => $move['new'] ?? 0,
                'recommended' => $move['recommended'] ?? 0,
                'autoplay' => $autoplay,
                'focused' => $move['focused'] ?? false,
                'focusedParent' => $move['focusedParent'] ?? false,
                'notes' => $move['notes'] ?? '',
                'moves' => $subMoves,
                'id' => $move['id'] ?? 0,
                'initialFen' => $move['initialFen'] ?? '',
                'multiple' => $move['multiple'] ?? false,
                'practiceCount' => $move['practiceCount'] ?? 0,
                'practiceFailed' => $move['practiceFailed'] ?? 0,
                'practiceInARow' => $move['practiceInARow'] ?? 0,
                'ourMove' => $ourMove,
            ];
        }

        return [$line, $ourMoveCount];
    }


    private function collectGlobalStats(array $lines): array
    {
        $totalAttempts = 0;
        $totalSuccess  = 0;
        $allDeltas     = [];

        foreach ($lines as $line) {
            // if this is a move
            if (isset($line['move'])) {

                $count  = $line['practiceCount'] ?? 0;
                $failed = $line['practiceFailed'] ?? 0;

                $totalAttempts += $count;
                $totalSuccess  += ($count - $failed);

                if (!empty($line['deltas'])) {
                    $allDeltas = array_merge($allDeltas, $line['deltas']);
                }
            }

            if (!empty($line['moves'])) {
                $childStats = $this->collectGlobalStats($line['moves']);
                $totalAttempts += $childStats['attempts'];
                $totalSuccess  += $childStats['success'];
                $allDeltas     = array_merge($allDeltas, $childStats['deltas']);
            }
        }

        return [
            'attempts' => $totalAttempts,
            'success'  => $totalSuccess,
            'deltas'   => $allDeltas,
        ];
    }

    private function computeGlobalStats(array $lines): array
    {
        $stats = $this->collectGlobalStats($lines);

        $globalSuccessRate = $stats['attempts'] > 0 ? $stats['success'] / $stats['attempts'] : 0;
        $globalFrequency   = !empty($stats['deltas'])
            ? array_sum($stats['deltas']) / count($stats['deltas'])
            : null;

        return [
            'successRate' => $globalSuccessRate,
            'frequency'   => $globalFrequency,
        ];
    }

    private function determineTargetSize(array $globalStats): int
    {

        // Use user settings to determine min/max targetSize (0-3)
        $recommendInterval = $this->settings->getRecommendInterval() ?? 1;

        // multiple factors based on user settings
        $factors = [0.6, 1, 1.5, 2.0];

        $min = 10;
        $max = 40;

        if ($globalStats['frequency'] !== null && $globalStats['frequency'] > 10) {
            // user practices rarely → give them more
            $min = 20;
            $max = 50;
        }

        $this->debugger::collect('globalStats', $globalStats);

        // Multiply to account for the interval
        //$min = $min * ($recommendInterval / 2);
        //$max = $max * ($recommendInterval / 2);
        $min = $min * $factors[$recommendInterval];
        $max = $max * $factors[$recommendInterval];

        $highCount = count($this->candidates['high']);
        $mediumCount = count($this->candidates['medium']);
        $lowCount = count($this->candidates['low']);

        // weight high = 3, medium = 2, low = 1
        $score = $highCount * 3 + $mediumCount * 2 + $lowCount;
        $maxScore = ($highCount + $mediumCount + $lowCount) * 3;

        // add or subtract a random number
        $randomize = rand(-5, 5) * $factors[$recommendInterval];

        // scale linearly between min and max
        $targetSize = round($min + $randomize + ($max - $min) * ($score / max(1, $maxScore)));

        //dd($min,$max,$recommendInterval,$highCount,$mediumCount,$lowCount,$score,$maxScore,$targetSize);
        $this->debugger::collect('targetSize', [
            'min' => $min,
            'max' => $max,
            'highCount' => $highCount,
            'mediumCount' => $mediumCount,
            'lowCount' => $lowCount,
            'score' => $score,
            'maxScore' => $maxScore,
            'randomize' => $randomize,
            'targetSize' => $targetSize
        ]);

        return $targetSize;

        //return rand($min, $max);
    }

    // recursively assign recommendation to all lines
    private function assignRecommendation(array $lines, array $globalStats): array
    {
        $result = [];

        foreach ($lines as $line) {
            // Rcurse into children first (so we have recommendation in the line)
            if (!empty($line['moves'])) {
                $line['moves'] = $this->assignRecommendation($line['moves'], $globalStats);
            }

            // If this is a move and its not an autoplay move
            if (isset($line['move']) && $this->isOurMove($line['before'] ?? '', $line['color'] ?? '')) {
                // Compute and assign recommendation
                $line['recommendation'] = $this->computeRecommendationForLine($line, $globalStats);
                // We don't want to recommend new moves, they are in their own category
                $isNew = isset($line['new']) && $line['new'] == 1;
                // Skip if new or very low recommendation
                if (!$isNew && !$this->isUnderRecommendationThreshold($line)) {
                    // store candidates by level for potential further processing
                    // note: no reference here, store a copy instead
                    $this->candidates[$line['recommendation']['level']][] = $line;
                }
            }

            $result[] = $line;
        }

        return $result;
    }


    // compute recommendation for a single line
    private function computeRecommendationForLine($line, $globalStats)
    {
        $count  = $line['practiceCount'] ?? 0;
        $failed = $line['practiceFailed'] ?? 0;

        $successRate = $count > 0 ? ($count - $failed) / $count : 0;
        $streak      = $line['practiceInARow'] ?? 0;
        $frequency   = !empty($line['deltas'])
            ? array_sum($line['deltas']) / count($line['deltas'])
            : null;
        
        $daysSince = null;
        //if (!empty($line['lastPracticedAt'])) {
        if (!empty($line['deltas']) && count($line['deltas']) > 0) {
            //$daysSince = (time() - strtotime($line['lastPracticedAt'])) / 86400;
            $daysSince = $line['deltas'][count($line['deltas'])-1];
        } else {
            // If never practiced, make it appear somewhat stale but also show high priority via success logic:
            // choose to treat as 14 days (or another value) so brand-new doesn't automatically dominate
            $daysSince = 14;
        }
        
        // Weights
        $successWeight = 2.0;
        $staleWeight   = 2.0;
        $streakBoost   = 0.5;
        $maxStaleDays  = 60;
        $frequencyWeight = 0.7;

        $score = 0;

        $debug = [
            'count' => $count,
            'failed' => $failed,
            'successRate' => $successRate,
            'streak', $streak,
            'frequency' => $frequency
        ];

        // success factor
        $score += $successWeight * (1 - $successRate);

        $debug['successScore'] = $score;

        // Staleness: normalize days (cap at maxStaleDays)
        $staleFactor = min($daysSince / max(1, $maxStaleDays), 1.0); // 0..1
        $staleScore = $staleWeight * $staleFactor; // up to staleWeight
        $score += $staleScore;
        
        $debug['staleScore'] = $staleScore;

        // streak factor
        //if ($streak < 3) $score += 0.3;
        if ($streak < 3) $score += $streakBoost;

        $debug['streakScore'] = $score;

        // Lower the score for a good streak
        if ($streak > 5) $score = $score *= 0.75;
        elseif ($streak > 3) $score = $score *= 0.85;

        $debug['goodStreakScore'] = $score;


        // frequency factor
        if ($frequency !== null && $frequency > 0) {
            //$score += min($frequency, 7) / 7 * 0.8;

            //$debug['frequencyScore'] = $score;

            $frequencyScore = 1 - exp(-$frequency / 15); // gentler slope
            $frequencyScore *= $frequencyWeight;

            $debug['frequencyScore'] = $score;
        }

        // adjust with global stats
        if ($globalStats['successRate'] > 0.85) $score *= 0.9;
        elseif ($globalStats['successRate'] < 0.6) $score *= 1.1;

        $debug['globalScore'] = $score;

        // Optional small tie-breaker from frequency (if you keep it)
        if ($frequency !== null) {
            // here frequency is average gap; larger gap -> larger score (but capped small)
            $freqScore = min($frequency, 14) / 14 * 0.4; // up to +0.4
            $score += $freqScore;
            $debug['freqScore'] = $freqScore;
        }

        // Get the recommend interval user setting
        $recommendInterval = $this->settings->getRecommendInterval() ?? 1;
        // Adjust the score based on the preference
        $prefFactors = [0 => 0.9, 1 => 1.0, 2 => 1.1, 3 => 1.25];
        // Adjust the score
        $score *= $prefFactors[$recommendInterval] ?? 1.0;

        $debug['intervalScore'] = $score;

        // classification thresholds (tuneable)
        $level = $score > 1.25 ? 'high' : ($score > 0.6 ? 'medium' : 'low');

        // classify level
        return [
            'level'  => $level,
            'factor' => min(3, $score),
            'successRate' => $successRate,
            'streak' => $streak,
            'frequency' => $frequency,
            'debug' => $debug
        ];
    }



    private function getRepertoireByHalfMove(bool $includeAll = false): array 
    {
        // Filter on the current user and optionally exclude the moves marked as 'exclude'
        $criteria = ['User' => $this->security->getUser()];
        if (!$includeAll) {
            $criteria["Exclude"] = false;
        }
        // Get the repository moves for this user
        return $this->repo->findBy($criteria, ['HalfMove' => 'ASC']);
    }

    /**
     * Returns the top level moves within this repertoire.
     * 
     * @param {array} $reps : the repertoire moves, they need to be sorted by halfmove
     */
    private function getRepertoireTopMoves($reps): array 
    {
        $lines = [];
        // Find the top level moves
        foreach ($reps as $rep) {
            // if this is a 1st move
            if ($rep->getHalfMove() == 1) {
                // see if we have this color / starting position already
                $idx = 0;
                foreach ($lines as $line) {
                    if ($line["color"] == $rep->getColor() && $line["before"] == $rep->getFenBefore()) {
                        break;
                    }
                    $idx++;
                }

                if ($idx >= count($lines)) {
                    // get the ECO code
                    //$eco = $ecoRepo->findCode($rep->getPgn());

                    $lines[] = [
                        'id' => $rep->getId(),
                        'color' => $rep->getColor(),
                        'initialFen' => $rep->getInitialFen(),
                        //'eco' => $eco,
                        'before' => $rep->getFenBefore(),
                        'after' => $rep->getFenBefore(),
                        'new' => 1,
                        'recommended' => 1,
                        'moves' => []
                    ];
                }

                // add the move
                $lines[$idx]['moves'][] = $this->getMoveArray($rep, [], []);
            }
        }

        return $lines;
    }

    /**
     * Returns an array with the moves per FEN position.
     */
    private function getRepertoireMovesPerFen($reps): array
    {
        $fenBefore = [];
        // find the 1st moves
        foreach ($reps as $rep) {
            // store the reps per fen before (for speed in getting the lines)
            if (!isset($fenBefore[$rep->getFenBefore()])) {
                $fenBefore[$rep->getFenBefore()] = [];
            }
            $fenBefore[$rep->getFenBefore()][] = $rep;
        }

        return $fenBefore;
    }

    /**
     * Returns an array with the lines per group.
     * If the user has certain repertoire moves added to a group, those lines will be returned.
     */
    private function getRepertoireGroupLines($reps): array
    {
        $groups = [];
        // find the 1st moves
        foreach ($reps as $rep) {
            // if this move belongs to a group
            foreach ($rep->getRepertoireGroups() as $grp) {
                $idx = -1;
                // find the group in our array
                for ($i = 0; $i < count($groups); $i++) {
                    if ($groups[$i]["id"] == $grp->getGrp()->getId()) {
                        $idx = $i;
                        break;
                    }
                }

                // add the group if needed
                if ($idx == -1) {
                    $idx = count($groups);

                    $groups[] = [
                        "id" => $grp->getGrp()->getId(),
                        "name" => $grp->getGrp()->getName(),
                        "lines" => []
                    ];
                }

                // Get the line leading up to this move
                $lineTo = $this->getLineBefore($rep->getHalfMove(), $rep->getFenBefore(), $reps);
                // store the group lines
                $groups[$idx]["lines"][] = $this->getMoveArray($rep, $lineTo, []);
            }
        }

        return $groups;
    }

    /**
     * Get the complete lines for a selection of moves.
     */
    private function getRepertoireLines(array $moves, array $fenBefore): array
    {
        // now add the lines based off the 1st moves (so we can have transpositions)
        for ($i = 0; $i < count($moves); $i++) {

            $moves[$i]['moves'] = $this->getLinesFor($moves[$i]['color'], $moves[$i]['after'], $fenBefore, []);
            $moves[$i]['multiple'] = [];

            // if we have multiple moves here, add them to an array
            if (count($moves[$i]['moves']) > 1) {
                foreach ($moves[$i]['moves'] as $move) {
                    //$lines[$i]['multiple'][] = $move['move'];
                    $moves[$i]['multiple'][] = [
                        "move" => $move['move'],
                        "cp" => isset($move['cp']) ? $move['cp'] : null,
                        "mate" => isset($move['mate']) ? $move['mate'] : null,
                        "pv" => isset($move['line']) ? $move['line'] : null
                    ];
                }
            }
        }

        return $moves;
    }

    /**
     * Returns a move array from a repertoire entity record.
     * The move array is used by the practice page.
     */
    private function getMoveArray($rep, array $line = [], array $moves = []): array
    {
        return [
            'id' => $rep->getId(),
            'color' => $rep->getColor(),
            'initialFen' => $rep->getInitialFen(),
            'move' => $rep->getMove(),
            //'eco' => ['code' => 'A00', 'name' => 'The Cow System'],
            'autoplay' => $rep->isAutoPlay(),
            'focused' => $rep->isFocused(),
            'focusedParent' => $rep->getFocusedParent()?->getId(),
            'notes' => $rep->getNotes(),
            'halfmove' => $rep->getHalfMove(),
            'before' => $rep->getFenBefore(),
            'after' => $rep->getFenAfter(),
            'new' => $rep->getPracticeCount() == 0 ? 1 : 0,
            'practiceCount' => $rep->getPracticeCount(),
            'practiceFailed' => $rep->getPracticeFailed(),
            'practiceInARow' => $rep->getPracticeInARow(),
            'lastUsed' => $rep->getLastUsed(),
            'deltas' => $rep->getDeltas(),
            'line' => $line ?? [],
            'moves' => $moves ?? [],
            'multiple' => []
        ];
    }

    /**
     * Get the lines for a specific repertoire record.
     */
    public function getLinesForMove($repertoireId): array
    {
        // Find the repository move
        $rep = $this->repo->findOneBy([
            'id' => $repertoireId,
            'User' => $this->security->getUser()
        ]);

        // If not found, return here
        if (!$rep) return [];

        // TODO: Leaving out failPercentage for now, don't think we use it anymore..

        //$repertoireItem = [
            // 'failPercentage' => $rep->getPracticeCount() < 5 ? 1 : $rep->getPracticeFailed() / $rep->getPracticeCount(),
        //];

        // Get all the repertoire moves
        $reps = $this->getRepertoireByHalfMove(true);
        // Get the moves per FEN position
        $fenBefore = $this->getRepertoireMovesPerFen($reps);

        // Get the line up to this move
        $lineTo = $this->getLineBefore($rep->getHalfMove(), $rep->getFenBefore(), $reps);
        // Get the moves following this move
        $moves = $this->getLinesFor($rep->getColor(), $rep->getFenAfter(), $fenBefore, []);

        // Get the move array
        $moveArray = $this->getMoveArray($rep, $lineTo, $moves);

        // TODO: Add the multiple - move this to getMoveArray ?
        $moveArray['multiple'] = [];

        // if we have multiple moves here, add them to an array
        if (count($moveArray['moves']) > 1) {
            foreach ($moveArray['moves'] as $move) {
                //$lines[$i]['multiple'][] = $move['move'];
                $moveArray['multiple'][] = [
                    "move" => $move['move'],
                    "cp" => isset($move['cp']) ? $move['cp'] : null,
                    "mate" => isset($move['mate']) ? $move['mate'] : null,
                    "pv" => isset($move['line']) ? $move['line'] : null
                ];
            }
        }

        // Get the top level lines
        $topMoves = $this->getRepertoireTopMoves($reps);
        // Get the complete lines
        $lines = $this->getRepertoireLines($topMoves, $fenBefore);

        // Group the lines by position
        return $this->groupByPosition([$moveArray], $lines);
    }

    /**
     * Get the focus moves.
     */
    public function getFocusMoves() {
        // If we don't have the focus moves yet
        if ($this->_focusMoves == null) {
            // Get the lines (which will also get the focus moves array)
            $this->getLines();
        }

        // Get the line to and the move arrays
        $result = [];
        foreach ($this->_focusMoves as $move) {
            // Get the line up to this move
            $lineTo = $this->getLineBefore($move->getHalfMove(), $move->getFenBefore(), $this->_allReps);
            // Get the moves following this move (only 1 level deep)
            $moves = $this->getLinesFor($move->getColor(), $move->getFenAfter(), $this->_movesPerFen, [], 1);
            // Add it
            $result[] = $this->getMoveArray($move, $lineTo, $moves);
        }

        return $result;
    }

    /**
     * Gets the repertoire lines. Builds up the lines from the top level moves to the last move,
     * resulting in a tree of moves for the entire repertoire.
     * 
     * TODO: Need to split this into separate functions.
     * 
     * - getLinesForRepertoire ? maybe.. we can combine parts or reuse sections
     * - getRepertoireLines - get top level moves, moves per FEN position and moves per group
     */
    public function getLines(int $repertoireId = null, bool $isRoadmap = false, bool $statisticsOnly = false, $includeAll = false): array
    {
        // get the saved repository moves for this user
        $criteria = ['User' => $this->security->getUser()];
        if (!$includeAll) {
            $criteria["Exclude"] = false;
        }

        // Get the entire repertoire, sorted by halfmove
        $this->_allReps = $this->repo->findBy($criteria, ['HalfMove' => 'ASC']);

        // Reset the arrays
        $this->_movesPerFen = [];
        $this->_focusMoves = [];

        $lines = [];

        // the groups & lines per group
        $groups = [];

        // the repertoire per fen before
        $repBefore = [];

        // the custom repertoire (from the roadmap)
        $repertoireItem = null;

        // find the 1st moves
        foreach ($this->_allReps as $rep) {
            // if this is a 1st move
            if ($rep->getHalfMove() == 1) {
                // see if we have this color / starting position already
                $idx = 0;
                foreach ($lines as $line) {
                    if ($line["color"] == $rep->getColor() && $line["before"] == $rep->getFenBefore()) {
                        break;
                    }
                    $idx++;
                }

                if ($idx >= count($lines)) {
                    // get the ECO code
                    //$eco = $ecoRepo->findCode($rep->getPgn());

                    $lines[] = [
                        'id' => $rep->getId(),
                        'color' => $rep->getColor(),
                        'initialFen' => $rep->getInitialFen(),
                        //'eco' => $eco,
                        'before' => $rep->getFenBefore(),
                        'after' => $rep->getFenBefore(),
                        'new' => 1,
                        'recommended' => 1,
                        'moves' => []
                    ];
                }

                // add the move
                //$lines[($rep->getColor() == 'white' ? 0 : 1)]['moves'][] = [
                $lines[$idx]['moves'][] = $this->getMoveArray($rep);
            }

            // store the reps per fen before (for speed in getting the lines)
            if (!isset($this->_movesPerFen[$rep->getFenBefore()])) {
                $this->_movesPerFen[$rep->getFenBefore()] = [];
            }
            $this->_movesPerFen[$rep->getFenBefore()][] = $rep;

            // if we need a specific repertoire line and we found it
            if ($repertoireId !== null && $rep->getId() == $repertoireId) {
                // Get the move array
                $repertoireItem = $this->getMoveArray($rep, $this->getLineBefore($rep->getHalfMove(), $rep->getFenBefore(), $this->_allReps));

                // 'failPercentage' => $rep->getPracticeCount() < 5 ? 1 : $rep->getPracticeFailed() / $rep->getPracticeCount(),

            }

            // If this is a focused move, add it
            if ($rep->isFocused()) {
                $this->_focusMoves[] = $rep;
            }

            // next part is not needed for the roadmap or specific repertoire line
            if ($isRoadmap || $repertoireId !== null || $statisticsOnly) {
                continue;
            }

            // if this move belongs to a group
            foreach ($rep->getRepertoireGroups() as $grp) {
                $idx = -1;
                // find the group in our array
                for ($i = 0; $i < count($groups); $i++) {
                    if ($groups[$i]["id"] == $grp->getGrp()->getId()) {
                        $idx = $i;
                        break;
                    }
                }

                // add the group if needed
                if ($idx == -1) {
                    $idx = count($groups);

                    $groups[] = [
                        "id" => $grp->getGrp()->getId(),
                        "name" => $grp->getGrp()->getName(),
                        "lines" => []
                    ];
                }

                // store the group lines
                $groups[$idx]["lines"][] = $this->getMoveArray($rep, $this->getLineBefore($rep->getHalfMove(), $rep->getFenBefore(), $this->_allReps));
            }
        }

        // now add the lines based off the 1st moves (so we can have transpositions)
        for ($i = 0; $i < count($lines); $i++) {

            $lines[$i]['moves'] = $this->getLinesFor($lines[$i]['color'], $lines[$i]['after'], $this->_movesPerFen, []);
            $lines[$i]['multiple'] = [];

            // if we have multiple moves here, add them to an array
            if (count($lines[$i]['moves']) > 1) {
                foreach ($lines[$i]['moves'] as $move) {
                    //$lines[$i]['multiple'][] = $move['move'];
                    $lines[$i]['multiple'][] = [
                        "move" => $move['move'],
                        "cp" => isset($move['cp']) ? $move['cp'] : null,
                        "mate" => isset($move['mate']) ? $move['mate'] : null,
                        "pv" => isset($move['line']) ? $move['line'] : null
                    ];
                }
            }
        }

        // if we need a specific repertoire line
        if ($repertoireId !== null) {
            // if we found it
            if ($repertoireItem !== null) {
                // get the lines
                $repertoireItem['moves'] = $this->getLinesFor($repertoireItem['color'], $repertoireItem['after'], $this->_movesPerFen, []);
                $repertoireItem['multiple'] = [];

                // if we have multiple moves here, add them to an array
                if (count($repertoireItem['moves']) > 1) {
                    foreach ($repertoireItem['moves'] as $move) {
                        //$lines[$i]['multiple'][] = $move['move'];
                        $repertoireItem['multiple'][] = [
                            "move" => $move['move'],
                            "cp" => isset($move['cp']) ? $move['cp'] : null,
                            "mate" => isset($move['mate']) ? $move['mate'] : null,
                            "pv" => isset($move['line']) ? $move['line'] : null
                        ];
                    }
                }

                // group the lines by position
                $repertoireItem = $this->groupByPosition([$repertoireItem], $lines);
            }

            return $repertoireItem;
        }

        // not needed for the roadmap or the custom repertoire id
        if (!$isRoadmap && $repertoireId == null && !$statisticsOnly) {
            // now add the group lines based off the 1st moves
            for ($i = 0; $i < count($groups); $i++) {
                for ($x = 0; $x < count($groups[$i]["lines"]); $x++) {

                    $groups[$i]["lines"][$x]['moves'] = $this->getLinesFor($groups[$i]["lines"][$x]['color'], $groups[$i]["lines"][$x]['after'], $this->_movesPerFen, []);
                    $groups[$i]["lines"][$x]['multiple'] = [];

                    // if we have multiple moves here, add them to an array
                    if (count($groups[$i]["lines"][$x]['moves']) > 1) {
                        foreach ($groups[$i]["lines"][$x]['moves'] as $move) {
                            //$lines[$i]['multiple'][] = $move['move'];
                            $groups[$i]["lines"][$x]['multiple'][] = [
                                "move" => $move['move'],
                                "cp" => isset($move['cp']) ? $move['cp'] : null,
                                "mate" => isset($move['mate']) ? $move['mate'] : null,
                                "pv" => isset($move['line']) ? $move['line'] : null
                            ];
                        }
                    }
                }

                // group the lines per starting position / color
                $groups[$i]["lines"] = $this->groupByPosition($groups[$i]["lines"], $lines);
            }
        }

        return [$lines, $groups];
    }

    // get the group lines
    private function getGroupLines($res): array
    {
        $groups = [];

        // prepare the select statement
        $sql = 'SELECT r.*, g.id AS grp_id, g.name 
        FROM repertoire r 
        INNER JOIN repertoire_group rg ON rg.repertoire_id = r.id 
        INNER JOIN `group` g ON g.id = rg.grp_id 
        WHERE r.user_id = :user ORDER BY g.id';
        $stmtFind = $this->repo->getEntityManager()->getConnection()->prepare($sql);

        if ($this->user instanceof User) {
            $stmtFind->bindValue('user', $this->user->getId());
        }

        $result = $stmtFind->executeQuery();

        while (($rep = $result->fetchAssociative()) !== false) {
            $idx = -1;
            // find the group in our array
            for ($i = 0; $i < count($groups); $i++) {
                if ($groups[$i]["id"] == $rep["grp_id"]) {
                    $idx = $i;
                    break;
                }
            }

            // add the group if needed
            if ($idx == -1) {
                $idx = count($groups);

                $groups[] = [
                    "id" => $rep["grp_id"],
                    "name" => $rep["name"],
                    "lines" => []
                ];
            }

            // store the group lines
            $groups[$idx]["lines"][] = [
                'id' => $rep["id"],
                'color' => $rep["color"],
                'initialFen' => $rep["initial_fen"],
                'move' => $rep["move"],
                //'eco' => ['code' => 'A00', 'name' => 'The Cow System'],
                'autoplay' => $rep["auto_play"],
                'focused' => $rep["focused"] ?? false,
                'focusedParent' => $rep["focusedParent"] ?? false,
                'notes' => $rep["notes"] ?? '',
                'halfmove' => $rep["half_move"],
                'before' => $rep["fen_before"],
                'after' => $rep["fen_after"],
                'new' => $rep["practice_count"] == 0 ? 1 : 0,
                'failPercentage' => $rep["practice_count"] < 5 ? 1 : $rep["practice_failed"] / $rep["practice_count"],
                'recommended' => 0,
                'practiceCount' => $rep["practice_count"],
                'practiceFailed' => $rep["practice_failed"],
                'practiceInARow' => $rep["practice_in_arow"],
                'line' => $this->getLineBefore($rep["half_move"], $rep["fen_before"], $res),
                'moves' => []
            ];
        }


        return $groups;
    }

    // get the complete lines for a certain color and starting position
    private function getLinesFor(string $color, string $fen, array $repBefore, $lineMoves = [], int $maxDepth = 999, int $parentId = null, int $step = 1): array
    {
        //$ecoRepo = $this->getEntityManager()->getRepository(ECO::class);

        $moves = [];

        // get the turn
        $turn = explode(" ", $fen)[1];

        // prevent doubles (in case of transposition)
        $usedFenAfters = [];

        $reps = isset($repBefore[$fen]) ? $repBefore[$fen] : [];

        // find the follow up moves for a certain color and position
        foreach ($reps as $rep) {

            /*
             we need to compare on 2 fens here.. for transposition
            */

            // if not excluded and a match
            if ($rep->getColor() == $color && $this->chessHelper->fenCompare($rep->getFenBefore(), $fen) && !in_array($rep->getFenAfter(), $usedFenAfters)) {
                // get the ECO code
                //$eco = $ecoRepo->findCode($rep->getPgn());

                // get the line moves for the child moves
                $temp = array_merge($lineMoves, [$rep->getMove()]);

                $childMoves = [];
                $multiple = [];

                // If we can go deeper
                if ($step < $maxDepth) {
                    // Get the child moves
                    $childMoves = $this->getLinesFor($color, $rep->getFenAfter(), $repBefore, $temp, $maxDepth, $rep->getId(), $step + 1);
                    // if we have multiple moves here, add them to an array
                    if (count($childMoves) > 1) {
                        foreach ($childMoves as $move) {
                            $multiple[] = [
                                "move" => $move['move'],
                                "cp" => isset($move['cp']) ? $move['cp'] : null,
                                "mate" => isset($move['mate']) ? $move['mate'] : null,
                                "line" => isset($move['line']) ? $move['line'] : null
                            ];
                        }
                    }
                }

                // if we should add this move
                if (substr($color, 0, 1) == $turn || count($childMoves) > 0) {

                    // keep track of the FEN position to prevent doubles (in case of transposition)
                    $usedFenAfters[] = $rep->getFenAfter();

                    $moves[] = [
                        'id' => $rep->getId(),
                        'parent' => $parentId,
                        'color' => $color,
                        'initialFen' => $rep->getInitialFen(),
                        'move' => $rep->getMove(),
                        //'eco' => $eco,
                        'autoplay' => $rep->isAutoPlay(),
                        'focused' => $rep->isFocused(),
                        'focusedParent' => $rep->getFocusedParent(),
                        'notes' => $rep->getNotes(),
                        'halfmove' => $rep->getHalfMove(),
                        'before' => $rep->getFenBefore(),
                        'after' => $rep->getFenAfter(),
                        'new' => $rep->getPracticeCount() == 0 ? 1 : 0,
                        'practiceCount' => $rep->getPracticeCount(),
                        'practiceFailed' => $rep->getPracticeFailed(),
                        'practiceInARow' => $rep->getPracticeInARow(),
                        'lastUsed' => $rep->getLastUsed(),
                        'deltas' => $rep->getDeltas(),
                        'line' => $lineMoves,
                        'moves' => $childMoves,
                        'multiple' => $multiple
                    ];
                }
            }
        }

        return $moves;
    }

    /**
     * Returns the line of moves to get to a certain position.
     * 
     * @param {int} $halfMove     : the halfmove of the position
     * @param {string} $fenBefore : the FEN string of the before position
     * @param {array} $allMoves   : the original array containing all the repertoire moves
     */
    private function getLineBefore($halfMove, $fenBefore, $allMoves)
    {
        // get the halfmove before this one
        $halfMove--;

        if ($halfMove == 0) {
            return [];
        }

        $line = [];

        for ($i = 0; $i < count($allMoves); $i++) {
            if ($allMoves[$i]->getHalfMove() == $halfMove && $allMoves[$i]->getFenAfter() == $fenBefore) {
                array_unshift($line, $allMoves[$i]->getMove());

                $halfMove--;
                $fenBefore = $allMoves[$i]->getFenBefore();

                if ($halfMove == 0) {
                    break;
                }

                // reset the loop
                $i = -1;

                continue;
            }
        }

        return $line;
    }

    /**
     * Finds a position within a certain line.
     */
    public function findPosition(string $fen, array $line): mixed
    {
        // if this is the top level line
        if (!isset($line["moves"])) {
            foreach ($line as $ln) {
                $ret = $this->findPosition($fen, $ln);
                if ($ret !== false) {
                    return $ret;
                }
            }
        } else {
            // if this is the position
            if (isset($line["after"]) && $line["after"] == $fen) {
                return $line;
            }

            // go through the moves in this line
            foreach ($line["moves"] as $move) {
                $ret = $this->findPosition($fen, $move);
                if ($ret !== false) {
                    return $ret;
                }
            }
        }

        return false;
    }

    /**
     * Find and return the 'multiple' moves for a certain move.
     * 
     * @param array $move     : the move to find the multiples for
     * @param array $allLines : the original array containing all the lines
     */
    private function findMultiple($move, $allLines)
    {

        foreach ($allLines as $line) {
            if ($line['color'] == $move['color'] && $line['after'] == $move['before']) {
                return $line['multiple'];
            }

            $ret = $this->findMultiple($move, $line['moves']);
            if ($ret !== false) {
                return $ret;
            }
        }

        return false;
    }

    /**
     * Returns true if it's white's turn based on the FEN string.
     */
    private function isWhiteMove(string $fen): bool
    {
        // Split FEN into its fields
        $parts = explode(' ', trim($fen));
        // FEN should always have at least 2 fields
        if (count($parts) < 2) {
            return false;
        }

        // The second field is the active color
        return $parts[1] === 'w';
    }

    /**
     * Checks wether a move is our move or the opponent's move based on the FEN before and the color.
     */
    private function isOurMove($fen, $color): bool
    {
        // If no FEN or color, not our move
        if ($fen === '' || $color === '') return false;
        // Determine white or black move
        $isWhiteToMove = $this->isWhiteMove($fen);

        return ($color == "white" && $isWhiteToMove) || ($color == "black" && !$isWhiteToMove);
    }

    /**
     * Group the lines by position. If there are multiple lines with the same starting position,
     * they will be merged together into the moves array. So each starting position occurs only
     * once in the resulting array.
     * 
     * @param {array} $lines    : the selection of lines to group together
     * @param {array} $res      : the original array containing all the lines
     * 
     * @returns {array} $result : the lines grouped by position
     */
    public function groupByPosition(array $lines, array $allLines = []): array
    {
        $temp = [];
        foreach ($lines as $line) {
            $idx = -1;
            for ($i = 0; $i < count($temp); $i++) {
                if ($temp[$i]['fen'] == $line['before'] && $temp[$i]['color'] == $line['color']) {
                    $idx = $i;
                    break;
                }
            }

            // if we don't  have this FEN position yet
            if ($idx == -1) {
                // find the multiple moves from the original lines (we need all multiple moves, not just the new/recommended ones)
                $multiple = $this->findMultiple($line, $allLines);

                // if this is not the starting position
                $temp[] = [
                    'color' => $line['color'],
                    'initialFen' => isset($line['initialFen']) ? $line['initialFen'] : '',
                    //'eco' => isset($line['eco']) ? $line['eco'] : null,
                    'fen' => $line['before'],
                    'id' => isset($line['parent']) ? $line['parent'] : 0,
                    'line' => isset($line['line']) ? $line['line'] : [],
                    'moves' => $line['before'] == $line['after'] ? $line['moves'] : [$line],
                    'multiple' => $multiple,
                    'practiceCount' => isset($line['practiceCount']) ? $line['practiceCount'] : 0,
                    'practiceFailed' => isset($line['practiceFailed']) ? $line['practiceFailed'] : 0,
                    'practiceInARow' => isset($line['practiceInARow']) ? $line['practiceInARow'] : 0,
                    'ourMove' => isset($line['ourMove']) ? $line['ourMove'] : "",
                    'ourMoveCount' => isset($line['ourMoveCount']) ? $line['ourMoveCount'] : 0
                ];
            } else {
                // make sure the move doesn't exist already (through transposition)
                $found = false;
                foreach ($temp[$idx]['moves'] as $move) {
                    if ($move['move'] == $line['move']) {
                        $found = true;
                        break;
                    }
                }
                // add it if not found
                if (!$found) {
                    $temp[$idx]['moves'][] = $line;
                    $temp[$idx]['ourMoveCount'] = $temp[$idx]['ourMoveCount'] ?? 0 + $line['ourMoveCount'] ?? 0;
                }
            }
        }

        return $temp;
    }

    /**
     * Gets the statistics for a group of lines.
     * 
     * TODO: Needs more explanation.
     */
    public function addRoadmap(&$lines, $idx = 0, $pgn = "", $eco = [], $hasMore = true): array
    {
        $failPercentage = 0;
        $failCount = 0;
        $practiceCount = 0;
        $practiceFailed = 0;

        $parentEcoCount = 0;
        $parentEcoFailed = 0;

        $ourMoveCount = 0;
        $variationCount = 0;

        for ($i = 0; $i < count($lines); $i++) {

            //$lines[$i]["xxx"] = 1;

            $movePgn = $pgn;
            $moveIdx = $idx;

            $lineMoveCount = 0;
            $lineVariationCount = 0;

            // if we have a move
            if (isset($lines[$i]["move"])) {
                // add the move number
                if ($idx % 2 == 0) {
                    $movePgn .= $idx == 0 ? "" : " ";
                    $movePgn .= ($idx / 2) + 1;
                    $movePgn .= ".";
                }
                // add the move
                $movePgn .= " " . $lines[$i]["move"];
                $moveIdx++;

                if (isset($lines[$i]["ourMove"]) && $lines[$i]["ourMove"]) {
                    $lineMoveCount++;
                }
            } else if (isset($lines[$i]["line"])) {
                //
                foreach ($lines[$i]["line"] as $move) {
                    // add the move number
                    if ($moveIdx % 2 == 0) {
                        $movePgn .= $moveIdx == 0 ? "" : " ";
                        $movePgn .= ($moveIdx / 2) + 1;
                        $movePgn .= ".";
                    }
                    // add the move
                    $movePgn .= " " . $move;
                    $moveIdx++;
                }
            }

            //
            $moveEco = $eco;

            // get ECO code
            if ($movePgn != "" && $hasMore) {
                $qb = $this->repo->getEntityManager()->createQueryBuilder('ECO');
                $query = $qb->select('e')
                    ->from('App\Entity\ECO', 'e')
                    ->where($qb->expr()->like(':pgn', 'CONCAT(e.PGN, \'%\')'))
                    ->setParameter('pgn', $movePgn)
                    ->orderBy('e.PGN', 'DESC')
                    ->setMaxResults(1)
                    ->getQuery();

                $res = $query->getArrayResult();

                if (count($res) > 0) {
                    $moveEco = ["code" => $res[0]["Code"], "name" => $res[0]["Name"]];
                }

                $qb = $this->repo->getEntityManager()->createQueryBuilder('ECO');
                $query = $qb->select('e')
                    ->from('App\Entity\ECO', 'e')
                    ->where($qb->expr()->like('e.PGN', ':pgn'))
                    ->setParameter('pgn', $movePgn . ' %')
                    ->orderBy('e.PGN', 'ASC')
                    ->setMaxResults(1)
                    ->getQuery();

                $res2 = $query->getArrayResult();

                $hasMore = count($res2) > 0;
            }

            $lines[$i]["pgn"] = $movePgn;
            $lines[$i]["eco"] = $moveEco;

            $lineFailPercentage = 0;
            $lineFailCount = 0;

            $linePracticeCount = isset($lines[$i]["practiceCount"]) ? $lines[$i]["practiceCount"] : 0;
            $linePracticeFailed = isset($lines[$i]["practiceFailed"]) ? $lines[$i]["practiceFailed"] : 0;

            //
            $ecoMatch = (isset($eco["code"]) ? $eco["code"] : "") == (isset($moveEco["code"]) ? $moveEco["code"] : "")
                && (isset($eco["name"]) ? $eco["name"] : "") == (isset($moveEco["name"]) ? $moveEco["name"] : "");

            //
            if ($ecoMatch) {
                $parentEcoCount += $linePracticeCount;
                $parentEcoFailed += $linePracticeFailed;
            }

            $moveEcoCount = $linePracticeCount;
            $moveEcoFailed = $linePracticeFailed;

            //
            if (isset($lines[$i]["practiceCount"]) && $lines[$i]["practiceCount"] > 0) {
                $lineFailPercentage = $lines[$i]["practiceFailed"] / $lines[$i]["practiceCount"];
                $lineFailCount = 1;
            }

            // if we have child moves
            if (isset($lines[$i]["moves"]) && count($lines[$i]["moves"]) > 0) {
                [$pct, $count, $pcount, $pfailed, $mcount, $vcount] = $this->addRoadmap($lines[$i]["moves"], $moveIdx, $movePgn, $moveEco, $hasMore);

                $lineFailPercentage += $pct;
                $lineFailCount += $count;

                $linePracticeCount += $pcount;
                $linePracticeFailed += $pfailed;

                $moveEcoCount += $pcount;
                $moveEcoFailed += $pfailed;

                $lineMoveCount += $mcount;
                $lineVariationCount += $vcount;

                //
                if ($ecoMatch) {
                    $parentEcoCount += $pcount;
                    $parentEcoFailed += $pfailed;
                }
            }

            //$lines[$i]["lineFailPercentage"] = $lineFailCount == 0 ? 0 : $lineFailPercentage / $lineFailCount;
            //$lines[$i]["lineFailPercentage"] = $linePracticeCount == 0 ? 0 : $linePracticeFailed / $linePracticeCount;
            $lines[$i]["lineFailPercentage"] = $moveEcoCount == 0 ? 0 : $moveEcoFailed / $moveEcoCount;
            $lines[$i]["linePracticeCount"] = $moveEcoCount;
            $lines[$i]["linePracticeFailed"] = $moveEcoFailed;

            $lines[$i]["lineMoveCount"] = $lineMoveCount;
            $lines[$i]["lineVariationCount"] = $lineVariationCount;

            $ourMoveCount += $lineMoveCount;
            $variationCount += $lineVariationCount;

            $failPercentage += $lineFailPercentage;
            $failCount += $lineFailCount;

            $practiceCount += $linePracticeCount;
            $practiceFailed += $linePracticeFailed;
        }

        //if ($failCount > 0) {
        //$failPercentage = $failPercentage / $failCount;
        //}

        $variationCount += count($lines) > 1 ? count($lines) : 0;

        return [$failPercentage, $failCount, $parentEcoCount, $parentEcoFailed, $ourMoveCount, $variationCount];
    }

    /**
     * Returns the roadmap for a certain color.
     */
    public function getRoadmapFor($color, $lines, $forEverySplit = false, $parentEco = null): array
    {
        $roadmap = [];
        $i = 0;

        foreach ($lines as $line) {

            $parentCode = isset($parentEco["code"]) ? $parentEco["code"] : "";
            $parentName = isset($parentEco["name"]) ? $parentEco["name"] : "";
            $lineCode = isset($line['eco']["code"]) ? $line['eco']["code"] : "";
            $lineName = isset($line['eco']["name"]) ? $line['eco']["name"] : "";

            $split = $forEverySplit ? count($lines) > 1 : $parentEco == null || ($parentCode !== $lineCode || $parentName !== $lineName);

            if ($split) {

                $temp = $this->getRoadmapFor($color, $line["moves"], $forEverySplit, $line['eco']);

                //
                // if we have an ECO code, add it as new line
                //
                // - only if splitting by ECO ??
                //

                if ($lineCode != "" || $forEverySplit) {

                    // get the line up to this move
                    $ln = [];
                    $pgna = explode(" ", $line["pgn"]);
                    for ($i = 0; $i < count($pgna); $i++) {
                        if (preg_match('/^\\d+\\./', $pgna[$i]) !== 1 && trim($pgna[$i]) != "") {
                            $ln[] = $pgna[$i];
                        }
                    }

                    // the missing top played moves
                    $missing = [];

                    // get the top played responses to this move that we don't have in our repertoire
                    if (count($line["moves"]) > 0 && isset($line["before"]) && $line["before"] != "" && isset($line["after"]) && $line["after"] != "") {
                        $turn = explode(" ", $line["before"])[1];

                        // if this is our move
                        if ($turn == substr($color, 0, 1)) {
                            //
                            // check the opponent moves after this move and check for missing top level moves
                            //
                            // get the most played moves for this position
                            $qb = $this->repo->getEntityManager()->createQueryBuilder();
                            $qb->select('m')
                                ->from('App\Entity\MoveStats', 'm')
                                ->join('m.fen', 'f')
                                ->where('f.fen = :fen')
                                ->orderBy('m.wins + m.draws + m.losses', 'DESC')
                                ->setParameter('fen', $line["after"]);

                            $res = $qb->getQuery()->getResult();

                            $top = [];
                            $total = 0;

                            foreach ($res as $mov) {
                                // get the total
                                $subtotal = $mov->getWins() + $mov->getDraws() + $mov->getLosses();
                                // add to grand total
                                $total += $subtotal;
                                // add the move
                                $top[] = [
                                    'move' => $mov->getMove(),
                                    'subtotal' => $subtotal,
                                    'wins' => $mov->getWins(),
                                    'draws' => $mov->getDraws(),
                                    'losses' => $mov->getLosses()
                                ];
                            }

                            // get the top moves only
                            foreach ($top as $mov) {
                                // if played at least 10% of the time
                                if ($mov["subtotal"] >= $total / 10) {
                                    // check to see if we have this move in our repertoire
                                    $found = false;
                                    foreach ($line["moves"] as $mv) {
                                        if ($mv["move"] == $mov["move"]) {
                                            $found = true;
                                            break;
                                        }
                                    }

                                    if (!$found) {
                                        // add % played
                                        $mov['percentage'] = round(($mov["subtotal"] / $total) * 100);

                                        $missing[] = $mov;
                                    }
                                }
                            }

                            // $line["moves"]
                        }
                    }

                    // add to the roadmap
                    $roadmap[] = [
                        'id' => isset($line['id']) ? $line['id'] : 0,
                        'eco' => $line['eco'],
                        'pgn' => $line['pgn'],
                        'move' => isset($line['move']) ? $line['move'] : "",
                        'line' => $ln,
                        'before' => isset($line['before']) ? $line['before'] : "",
                        'fail' => $line['lineFailPercentage'],
                        'pcount' => $line['linePracticeCount'],
                        'pfailed' => $line['linePracticeFailed'],
                        'mcount' => isset($line['lineMoveCount']) ? $line['lineMoveCount'] : null,
                        'vcount' => isset($line['lineVariationCount']) ? $line['lineVariationCount'] : null,
                        'missing' => $missing,
                        'lines' => $temp
                    ];
                } else {
                    if (count($temp) > 0) {
                        foreach ($temp as $t) {
                            $roadmap[] = $t;
                        }
                    }
                }
            } else {
                //
                $temp = $this->getRoadmapFor($color, $line["moves"], $forEverySplit, $parentEco);
                //
                if (count($temp) > 0) {
                    foreach ($temp as $t) {
                        $roadmap[] = $t;
                    }
                }
            }
        }

        return $roadmap;
    }
}
