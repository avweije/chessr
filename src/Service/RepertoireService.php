<?php

namespace App\Service;

use App\Entity\Moves;
use App\Entity\User;
use App\Repository\RepertoireRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bundle\SecurityBundle\Security;

class RepertoireService
{
    private $user = null;
    private $settings = null;
    private $repo;

    private array $candidates = [
        'must'   => [],
        'high'   => [],
        'medium' => [],
        'low'    => [],
    ];

    public function __construct(ManagerRegistry $registry, private Security $security, RepertoireRepository $repository)
    {
        $this->user = $security->getUser();
        if ($this->user instanceof User) {
            $this->settings = $this->user->getSettings();
        }
        $this->repo = $repository;
    }

    public function fenCompare($fenSource, $fenTarget): string
    {
        // split the FEN, get the parts and replace the ep square with a dash
        $parts = explode(" ", $fenSource);
        $fenSourceDash = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];
        $parts = explode(" ", $fenTarget);
        $fenTargetDash = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];

        return $fenSource == $fenTarget || $fenSource == $fenTargetDash || $fenSourceDash == $fenTarget || $fenSourceDash == $fenTargetDash;
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
        $white = $this->findLines($lines, 'white', false, false);
        // group by position and return
        return $this->groupByPosition($white, $lines);
    }

    // gets the black lines in the lines returned from getLines()
    public function getBlackLines($lines)
    {
        // get the black lines
        $black = $this->findLines($lines, 'black', false, false);
        // group by position and return
        return $this->groupByPosition($black, $lines);
    }

    // gets the new lines in the lines returned from getLines()
    public function getNewLines($lines)
    {
        // get the new lines
        //$new = $this->findLines($lines, '', true, false, true);

        $new = $this->collectNewMovesLineUntil($lines);

        //dd($new);

        // group by position and return
        return $this->groupByPosition($new, $lines);
    }

    // gets the recommended lines in the lines returned from getLines()
    public function getRecommendedLines(array $lines): array
    {
        // see if we have recommended lines in our session
        if (isset($_SESSION['recommendedLines']) && count($_SESSION['recommendedLines']) > 0) {
            return $_SESSION['recommendedLines'];
        }

        // compute global stats
        $globalStats = $this->computeGlobalStats($lines);

        // reset candidates
        $this->candidates = [
            'must'   => [],
            'high'   => [],
            'medium' => [],
            'low'    => [],
        ];

        // recursively assign recommendation
        $lines = $this->assignRecommendation($lines, $globalStats);
        //$this->assignRecommendation($lines, $globalStats);

        //dd($this->candidates);

        $targetSize = $this->determineTargetSize($globalStats);
        $totalMoves = 0;

        $result = [];
        $usedMoves = []; // to mark moves that have been included

        foreach (['must', 'high', 'medium', 'low'] as $level) {
            if ($totalMoves >= $targetSize) break;

            $candidates = $this->candidates[$level] ?? [];

            // sort candidates by factor descending
            usort($candidates, fn($a, $b) => $b['recommendation']['factor'] <=> $a['recommendation']['factor']);

            foreach ($candidates as $candidate) {
                if ($totalMoves >= $targetSize) break;

                $moveKey = $candidate['id'];
                if (isset($usedMoves[$moveKey])) continue;

                // get the composite score
                $baseScore = $this->isOurMove($candidate['before'] ?? '', $candidate['color'] ?? '') ? $this->getCompositeScore($candidate) : -1;

                // test a bit with the threshold
                $threshold = 1;
                // collect line until recommendation drops
                $lineUntil = $this->collectRecommendedUntil(['moves' => [$candidate]], $usedMoves, $baseScore, $threshold);

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

        // does group by position cause this?

        // group by position and return
        $recommended = $this->groupByPosition($result, $lines);
        //$recommended = $result;

        // store in session
        $_SESSION['recommendedLines'] = $recommended;

        return $recommended;
    }

    private function countMoves(array $lines): int
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


    public function updateSessionRecommended(int $id): void
    {
        if (!isset($_SESSION['recommendedLines'])) {
            return;
        }

        $_SESSION['recommendedLines'] = $this->updateSessionRecommendedMove($id, $_SESSION['recommendedLines']);
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
        if (isset($line['id']) && $line['id'] === $id) {
            $line['played'] = true;
        }

        if (!empty($line['moves'])) {
            foreach ($line['moves'] as $i => $child) {
                $line['moves'][$i] = $this->markMovePlayed($child, $id);
            }
        }

        return $line;
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

        foreach ($line['moves'] as $move) {
            $moveId = $move['id'] ?? null;
            if ($moveId === null || isset($usedMoves[$moveId])) {
                continue;
            }

            $thisBase = $baseScore;

            $isOurMove = $this->isOurMove($move['before'] ?? '', $move['color'] ?? '');

            $move['baseScore'] = $baseScore;
            $move['baseIsOurMove'] = $isOurMove;

            // If we don't have the base score yet (top level not our move)
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

                $move['baseDrop'] = $drop;
                $move['baseThreshold'] = $minThreshold;
                $move['compositeScore'] = $compositeScore;

                // stop if the drop exceeds the threshold
                if ($drop > $minThreshold) {
                    break;
                }
            }

            $move['thisBase'] = $thisBase;

            $usedMoves[$moveId] = true;

            if (!empty($move['moves'])) {
                $move['moves'] = $this->collectRecommendedUntil($move, $usedMoves, $thisBase, $minThreshold);
            }

            if ($isOurMove || count($move['moves']) > 0) {
                $result[] = $move;
            }
        }

        return $result;
    }

    private function isUnderRecommendationThreshold($move): bool
    {
        // Get the recommend interval (0-3)
        $recommendInterval = 4 - ($this->settings->getRecommendInterval() ?? 0);
        // Set the threshold based on the interval
        $threshold = 0.2 * $recommendInterval;

        return (isset($move['recommendation']) && $move['recommendation']['level'] == 'low' && $move['recommendation']['factor'] <= $threshold);
    }

    /**
     * Simple priority for levels
     */
    private function levelPriority(string $level): int
    {
        return match ($level) {
            'must' => 4,
            'high' => 3,
            'medium' => 2,
            'low' => 1,
            default => 0,
        };
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
    private function collectNewMovesLineUntil(array $lines, array $lineSoFar = [], array &$seen = []): array
    {
        $result = [];

        foreach ($lines as $move) {
            // Determine if this move is "our move"
            $ourMove = isset($move['before']) && isset($move['color']) ? $this->isOurMove($move['before'], $move['color']) : false;

            // Only consider moves that are "new" and our move
            $isNew = $ourMove && (!empty($move['new']) && $move['new'] == 1);

            // Build the line leading to this move
            $currentLine = $lineSoFar;

            // Track unique positions to prevent duplicates
            $uniqueKey = $move['after'] ?? null;

            // Start a new practice line if this move is new
            if ($isNew && isset($move['move']) && $uniqueKey && !isset($seen[$uniqueKey])) {
                $seen[$uniqueKey] = true;

                // Recursively collect moves in this contiguous block
                [$subMoves,] = $this->collectLineUntil($move['moves'], $seen);

                $result[] = [
                    'move' => $move['move'],
                    'line' => $currentLine,
                    'before' => $move['before'] ?? '',
                    'after' => $move['after'] ?? '',
                    'color' => $move['color'] ?? '',
                    'new' => $move['new'] ?? 0,
                    'recommended' => $move['recommended'] ?? 0,
                    'autoplay' => $move['autoplay'] ?? false,
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
                    $this->collectNewMovesLineUntil($move['moves'], $childLineSoFar, $seen)
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
    private function collectLineUntil(array $moves, array &$seen): array
    {
        $line = [];
        $ourMoveCount = 0;

        foreach ($moves as $move) {
            $ourMove = isset($move['before']) && isset($move['color']) ? $this->isOurMove($move['before'], $move['color']) : false;
            $isNew = $ourMove && (!empty($move['new']) && $move['new'] == 1);
            $autoplay = $move['autoplay'] ?? false;

            // Stop the block if it's our move and not new
            if ($ourMove && !$isNew) {
                continue;
            }

            $uniqueKey = $move['after'] ?? null;
            if ($isNew && $uniqueKey && !isset($seen[$uniqueKey])) {
                $seen[$uniqueKey] = true;
            }

            // Recursively include child moves
            [$subMoves, $subCount] = $this->collectLineUntil($move['moves'] ?? [], $seen);
            $ourMoveCount += $ourMove && !$autoplay ? 1 + $subCount : $subCount;

            $line[] = [
                'move' => $move['move'] ?? '',
                'before' => $move['before'] ?? '',
                'after' => $move['after'] ?? '',
                'color' => $move['color'] ?? '',
                'new' => $move['new'] ?? 0,
                'recommended' => $move['recommended'] ?? 0,
                'autoplay' => $autoplay,
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
        $recommendInterval = ($this->settings->getRecommendInterval() ?? 0) + 1;
        
        $min = 20;
        $max = 60;

        if ($globalStats['frequency'] !== null && $globalStats['frequency'] > 10) {
            // user practices rarely → give them more
            $min = 30;
            $max = 90;
        }

        // Multiply to account for the interval
        $min = $min * ($recommendInterval / 2);
        $max = $min * ($recommendInterval / 2);

        $highCount = count($this->candidates['high']);
        $mediumCount = count($this->candidates['medium']);
        $lowCount = count($this->candidates['low']);

        // weight high = 3, medium = 2, low = 1
        $score = $highCount * 3 + $mediumCount * 2 + $lowCount;
        $maxScore = ($highCount + $mediumCount + $lowCount) * 3;

        // scale linearly between min and max
        $targetSize = $min + ($max - $min) * ($score / max(1, $maxScore));

        return $targetSize;

        //return rand($min, $max);
    }

    // recursively assign recommendation to all lines
    private function assignRecommendation_xx(array &$lines, array $globalStats): void
    {
        foreach ($lines as &$line) {
            // if this is a move
            if (isset($line['move']) && $this->isOurMove($line['before'] ?? '', $line['color'] ?? '')) {
                // compute and assign recommendation
                $line['recommendation'] = $this->computeRecommendationForLine($line, $globalStats);
                // store candidates by level for potential further processing
                $this->candidates[$line['recommendation']['level']][] = &$line;
                //$this->candidates[$line['recommendation']['level']][] = $line;
            }
            // recurse into children
            if (!empty($line['moves'])) {
                $this->assignRecommendation($line['moves'], $globalStats);
            }
        }
    }

    private function assignRecommendation(array $lines, array $globalStats): array
    {
        $result = [];

        foreach ($lines as $line) {
            // if this is a move and its not an autoplay move
            if (isset($line['move']) && $this->isOurMove($line['before'] ?? '', $line['color'] ?? '')) {
                //  && !$line['autoplay']
                // compute and assign recommendation
                $line['recommendation'] = $this->computeRecommendationForLine($line, $globalStats);

                // skip if very low recommendation
                //if ($line['recommendation']['level'] !== 'low' || $line['recommendation']['factor'] > 0.2) {
                if (!$this->isUnderRecommendationThreshold($line)) {
                    // store candidates by level for potential further processing
                    // note: no reference here, store a copy instead
                    $this->candidates[$line['recommendation']['level']][] = $line;
                }
            }

            // recurse into children
            if (!empty($line['moves'])) {
                $line['moves'] = $this->assignRecommendation($line['moves'], $globalStats);
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

        $score = 0;

        // success factor
        if ($successRate < 0.5) $score += 0.6;
        elseif ($successRate < 0.8) $score += 0.3;

        // streak factor
        if ($streak < 3) $score += 0.3;

        // frequency factor
        if ($frequency !== null && $frequency > 7) $score += 0.4;

        // adjust with global stats
        if ($globalStats['successRate'] > 0.85) $score *= 0.9;
        elseif ($globalStats['successRate'] < 0.6) $score *= 1.2;

        if ($globalStats['frequency'] !== null && $globalStats['frequency'] > 10) {
            $score *= 1.2;
        }

        // classify level
        return [
            'level'  => $score > 1 ? 'high' : ($score > 0.4 ? 'medium' : 'low'),
            'factor' => min(1, $score),
        ];
    }




    // get the repertoire lines
    public function getLines(int $repertoireId = null, bool $isRoadmap = false, bool $statisticsOnly = false, $includeAll = false): array
    {
        // get the saved repository moves for this user
        $criteria = ['User' => $this->security->getUser()];
        if (!$includeAll) {
            $criteria["Exclude"] = false;
        }

        $res = $this->repo->findBy($criteria, ['HalfMove' => 'ASC']);

        $lines = [];

        // the groups & lines per group
        $groups = [];

        // the repertoire per fen before
        $repBefore = [];

        // the custom repertoire (from the roadmap)
        $repertoireItem = null;

        // find the 1st moves
        foreach ($res as $rep) {
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
                $lines[$idx]['moves'][] = [
                    'id' => $rep->getId(),
                    'color' => $rep->getColor(),
                    'initialFen' => $rep->getInitialFen(),
                    'move' => $rep->getMove(),
                    //'eco' => $eco,
                    'autoplay' => $rep->isAutoPlay(),
                    'halfmove' => $rep->getHalfMove(),
                    'before' => $rep->getFenBefore(),
                    'after' => $rep->getFenAfter(),
                    'new' => $rep->getPracticeCount() == 0 ? 1 : 0,
                    'practiceCount' => $rep->getPracticeCount(),
                    'practiceFailed' => $rep->getPracticeFailed(),
                    'practiceInARow' => $rep->getPracticeInARow(),
                    'lastUsed' => $rep->getLastUsed(),
                    'deltas' => $rep->getDeltas(),
                    'line' => [],
                    'moves' => []
                ];
            }

            // store the reps per fen before (for speed in getting the lines)
            if (!isset($repBefore[$rep->getFenBefore()])) {
                $repBefore[$rep->getFenBefore()] = [];
            }
            $repBefore[$rep->getFenBefore()][] = $rep;

            // if we need a specific repertoire line and we found it
            if ($repertoireId !== null && $rep->getId() == $repertoireId) {
                $repertoireItem = [
                    'id' => $rep->getId(),
                    'color' => $rep->getColor(),
                    'initialFen' => $rep->getInitialFen(),
                    'move' => $rep->getMove(),
                    //'eco' => ['code' => 'A00', 'name' => 'The Cow System'],
                    'autoplay' => $rep->isAutoPlay(),
                    'halfmove' => $rep->getHalfMove(),
                    'before' => $rep->getFenBefore(),
                    'after' => $rep->getFenAfter(),
                    'new' => $rep->getPracticeCount() == 0 ? 1 : 0,
                    'failPercentage' => $rep->getPracticeCount() < 5 ? 1 : $rep->getPracticeFailed() / $rep->getPracticeCount(),
                    'practiceCount' => $rep->getPracticeCount(),
                    'practiceFailed' => $rep->getPracticeFailed(),
                    'practiceInARow' => $rep->getPracticeInARow(),
                    'lastUsed' => $rep->getLastUsed(),
                    'deltas' => $rep->getDeltas(),
                    'line' => $this->getLineBefore($rep->getHalfMove(), $rep->getFenBefore(), $res),
                    'moves' => []
                ];
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
                $groups[$idx]["lines"][] = [
                    'id' => $rep->getId(),
                    'color' => $rep->getColor(),
                    'initialFen' => $rep->getInitialFen(),
                    'move' => $rep->getMove(),
                    //'eco' => ['code' => 'A00', 'name' => 'The Cow System'],
                    'autoplay' => $rep->isAutoPlay(),
                    'halfmove' => $rep->getHalfMove(),
                    'before' => $rep->getFenBefore(),
                    'after' => $rep->getFenAfter(),
                    'new' => $rep->getPracticeCount() == 0 ? 1 : 0,
                    'practiceCount' => $rep->getPracticeCount(),
                    'practiceFailed' => $rep->getPracticeFailed(),
                    'practiceInARow' => $rep->getPracticeInARow(),
                    'lastUsed' => $rep->getLastUsed(),
                    'deltas' => $rep->getDeltas(),
                    'line' => $this->getLineBefore($rep->getHalfMove(), $rep->getFenBefore(), $res),
                    'moves' => []
                ];
            }
        }

        // now add the lines based off the 1st moves (so we can have transpositions)
        for ($i = 0; $i < count($lines); $i++) {

            $lines[$i]['moves'] = $this->getLinesFor($lines[$i]['color'], $lines[$i]['after'], $repBefore, []);
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
                $repertoireItem['moves'] = $this->getLinesFor($repertoireItem['color'], $repertoireItem['after'], $repBefore, []);
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

                    $groups[$i]["lines"][$x]['moves'] = $this->getLinesFor($groups[$i]["lines"][$x]['color'], $groups[$i]["lines"][$x]['after'], $repBefore, []);
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
    private function getLinesFor(string $color, string $fen, array $repBefore, $lineMoves = [], int $step = 1): array
    {
        //$ecoRepo = $this->getEntityManager()->getRepository(ECO::class);

        $moves = [];

        // get the turn
        $turn = explode(" ", $fen)[1];

        // prevent doubles (in case of transposition)
        $usedFenAfters = [];

        $reps = isset($repBefore[$fen]) ? $repBefore[$fen] : [];

        // find the follow up moves for a certain color and position
        //foreach ($res as $rep) {
        foreach ($reps as $rep) {
            //for ($resIdx = 0; $resIdx < count($res); $resIdx += 2) {

            //$rep = $res[$resIdx];
            //$repEco = $res[$resIdx + 1];

            /*

            -
            - we need to compare on 2 fens here.. for transposition
            -

            */

            // if not excluded and a match
            //if ($rep->isExclude() == false && $rep->getColor() == $color && $rep->getFenBefore() == $fen) {
            //if ($rep->getColor() == $color && $rep->getFenBefore() == $fen) {
            if ($rep->getColor() == $color && $this->fenCompare($rep->getFenBefore(), $fen) && !in_array($rep->getFenAfter(), $usedFenAfters)) {
                // get the ECO code
                //$eco = $ecoRepo->findCode($rep->getPgn());

                // get the line moves for the child moves
                $temp = array_merge($lineMoves, [$rep->getMove()]);

                $childMoves = $this->getLinesFor($color, $rep->getFenAfter(), $repBefore, $temp, $step + 1);
                $multiple = [];

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

                // if we should add this move
                if (substr($color, 0, 1) == $turn || count($childMoves) > 0) {

                    // keep track of the FEN position to prevent doubles (in case of transposition)
                    $usedFenAfters[] = $rep->getFenAfter();

                    $failPercentage = $rep->getPracticeCount() == 0 ? 0 : max($rep->getPracticeFailed() / $rep->getPracticeCount(), 0);
                    $inARowNeeded = max(3, 3 + round($failPercentage / .5));
                    $daysNeeded = 7 * max(4 - (4 * $failPercentage), 1);

                    $moves[] = [
                        'id' => $rep->getId(),
                        'color' => $color,
                        'initialFen' => $rep->getInitialFen(),
                        'move' => $rep->getMove(),
                        //'eco' => $eco,
                        'autoplay' => $rep->isAutoPlay(),
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

    // get the line before a certain repertoire move
    private function getLineBefore($halfMove, $fenBefore, $res)
    {
        // get the halfmove before this one
        $halfMove--;

        if ($halfMove == 0) {
            return [];
        }

        $line = [];

        for ($i = 0; $i < count($res); $i++) {
            if ($res[$i]->getHalfMove() == $halfMove && $res[$i]->getFenAfter() == $fenBefore) {
                array_unshift($line, $res[$i]->getMove());

                $halfMove--;
                $fenBefore = $res[$i]->getFenBefore();

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

    // find a position inside a line
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

    //
    private function findMultiple($line, $res)
    {

        foreach ($res as $rec) {
            if ($rec['color'] == $line['color'] && $rec['after'] == $line['before']) {
                return $rec['multiple'];
            }

            $ret = $this->findMultiple($line, $rec['moves']);
            if ($ret !== false) {
                return $ret;
            }
        }

        return false;
    }

    //
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

    // find the lines of a certain type
    private function findLines(array $lines, string $color = "", bool $isNew = false, bool $isRecommended = false, bool $preventDoubles = false, array &$usedIds = [], string $rootColor = "", int $level = 1, $rootVariation = null): array
    {
        $res = [];

        // find the starting points for the lines
        foreach ($lines as $line) {
            // set the color (from the root object)
            if ($rootColor != "") {
                $line['color'] = $rootColor;
            }

            // is this our move?
            //$ourMove = ($line["color"] == "white" && $level % 2 == 1) || ($line["color"] == "black" && $level % 2 == 0);
            //$ourMove = ($line["color"] == "white" && $level % 2 == 0) || ($line["color"] == "black" && $level % 2 == 1);
            //$ourMove = isset($line['halfmove']) ? (($line['color'] == "white" && $line['halfmove'] % 2 == 1) || ($line['color'] == "black" && $line['halfmove'] % 2 == 0)) : $line['color'] == "white";

            // Use the FEN to determine whose move it is
            //$isWhiteToMove = $this->isWhiteMove($line['after']);
            // Get the halfmove number from the FEN
            //$halfmoveNumber = isset($line['halfmove']) ? $line['halfmove'] : null;
            // Determine if it's our move based on color and turn
            //$ourMove = $line['color'] == "white" && $isWhiteToMove || $line['color'] == "black" && !$isWhiteToMove;

            // Determine if it's our move based on color and turn
            $ourMove = $this->isOurMove($line['before'], $line['color']);

            //dd($line);

            // if we need a certain color and this is a match
            if (($ourMove || $level == 1) && $color != "" && $line['color'] == $color) {
                // prevent doubles
                if (!isset($line["id"]) || !in_array($line["id"], $usedIds)) {
                    // add to the lines
                    $res[] = $line;
                    //$res[] = $isRecommended && $rootVariation !== null ? $rootVariation : $line;

                    // if we need to prevent doubles
                    if ($preventDoubles && isset($line["id"])) {
                        $usedIds[] = $line["id"];
                    }
                }

                continue;
            }
            // if we need the new lines and this is a match
            if (($ourMove || $level == 1) && $isNew && $line['new'] == 1 && (!isset($line['autoplay']) || !$line['autoplay'])) {
                // prevent doubles
                if (!isset($line["id"]) || !in_array($line["id"], $usedIds)) {
                    // add to the lines
                    $res[] = $line;
                    //$res[] = $isRecommended && $rootVariation !== null ? $rootVariation : $line;

                    // if we need to prevent doubles
                    if ($preventDoubles && isset($line["id"])) {
                        $usedIds[] = $line["id"];
                    }
                }

                continue;
            }
            // if we need the recommended lines and this is a match
            if (($ourMove || $level == 1) && $isRecommended && $line['recommended'] == 1 && (!isset($line['autoplay']) || !$line['autoplay'])) {
                // prevent doubles
                if (!isset($line["id"]) || !in_array($line["id"], $usedIds)) {
                    // add to the lines
                    $res[] = $line;
                    //$res[] = $isRecommended && $rootVariation !== null ? $rootVariation : $line;

                    // if we need to prevent doubles
                    if ($preventDoubles && isset($line["id"])) {
                        $usedIds[] = $line["id"];
                    }
                }

                continue;
            }

            // set the root of the variation
            $rootVariation = $rootVariation == null || count($line['moves']) > 1 ? $line : $rootVariation;

            // check this line to see if any child moves match the criteria
            $temp = $this->findLines($line['moves'], $color, $isNew, $isRecommended, $preventDoubles, $usedIds, $line['color'], $level + 1, $rootVariation);

            //
            // TEMP: testing for recommended - we need the move before in case of multiple!!
            //

            //if ($level == 1 && count($temp) > 0) {
            // add this line also (the parent line of the line we actually want)
            //$res[] = $line;
            //}



            foreach ($temp as $t) {
                $res[] = $t;
                //$res[] = $rootVariation;
            }
        }

        // at top level of this function, return the lines until
        if ($level == 1) {
            // we need to split the lines into parts (that match the criteria)
            $parts = [];
            // split the lines at the part(s) where it stops matching (and later in the line matches again)
            foreach ($res as $line) {
                $temp = $this->splitLine($line, $color, $isNew, $isRecommended, $preventDoubles, $usedIds);

                //if ($isNew) {
                //dd($temp, $line);
                //}

                $parts[] = $line;
                foreach ($temp as $t) {
                    $parts[] = $t;
                }
            }

            $linesUntil = [];

            //if ($isNew) {
            //  dd($parts);
            //}

            // only prevent doubles from here on.. needs more testing
            //$preventDoubles = false;
            $usedIds = [];

            $ourMoveCount = 0;

            // get the line until
            for ($i = 0; $i < count($parts); $i++) {
                [$parts[$i]['moves'], $lineMoveCount] = $this->getLineUntil($parts[$i]['moves'], $color, $isNew, $isRecommended, $preventDoubles, $usedIds);

                //if ($isNew && $i == 1) {
                //  dd($i, $parts[$i], $lineMoveCount, isset($parts[$i]["move"]), count($parts[$i]['moves']));
                //}

                if (isset($parts[$i]["move"]) || count($parts[$i]['moves']) > 0) {
                    // if our move, add 1 ?
                    $ourMove = $parts[$i]["before"] == $parts[$i]["after"] ? false : (explode(" ", $parts[$i]["before"])[1] == substr($parts[$i]['color'], 0, 1));
                    //$ourMove = isset($parts[$i]['halfmove']) ? (($parts[$i]['color'] == "white" && $parts[$i]['halfmove'] % 2 == 1) || ($parts[$i]['color'] == "black" && $parts[$i]['halfmove'] % 2 == 0)) : $parts[$i]['color'] == $color;

                    // Determine if it's our move based on color and turn
                    $ourMove = $parts[$i]["before"] == $parts[$i]["after"] ? false : $this->isOurMove($parts[$i]['before'], $parts[$i]['color']);

                    //dd($parts[$i], $ourMove);


                    $autoplay = isset($move['autoplay']) ? $move['autoplay'] : false;
                    if ($ourMove && !$autoplay) {
                        $lineMoveCount++;
                    }

                    $parts[$i]["ourMoveCount"] = $lineMoveCount;

                    $linesUntil[] = $parts[$i];

                    $ourMoveCount = $ourMoveCount + $lineMoveCount;
                }
            }

            return $linesUntil;
        } else {
            // return the line back to the findLines internal call
            return $res;
        }
    }

    // split the line into parts that match
    private function splitLine($line, string $color = "", bool $isNew = false, bool $isRecommended = false, bool $preventDoubles = false, array &$usedIds = [], bool $match = true, $level = 1, $rootVariation = null, $lineBefore = []): array
    {
        $parts = [];

        // is this our move?
        $ourMove = ($line['color'] == "white" && $level % 2 == 1) || ($line['color'] == "black" && $level % 2 == 0);
        //$ourMove = ($color == "white" && $level % 2 == 0) || ($color == "black" && $level % 2 == 1);

        // Determine if it's our move based on color and turn
        //$ourMove = $this->isOurMove($line['after'], $line['color']);

        $ourMove = ($line["before"] == $line["after"]) ? false : $this->isOurMove($line['before'], $line['color']);

        //$ourMove = $this->isOurMove($line['before'], $line['color']);

        //dd($ourMove, $line);

        $rootVariation = $rootVariation == null || count($line['moves']) > 1 ? $line : $rootVariation;

        foreach ($line['moves'] as $move) {
            $temp = [];

            $autoplay = isset($move['autoplay']) ? $move['autoplay'] : false;

            // if the last move was a match
            if ($match) {
                // if this move matches also
                if (!$ourMove || ($color != '' && $move['color'] == $color) || ($isNew && $move['new'] == 1 && !$autoplay) || ($isRecommended && $move['recommended'] == 1 && !$autoplay)) {
                    // prevent doubles
                    if (!isset($move["id"]) || !in_array($move["id"], $usedIds)) {
                        // check next move for a non-match
                        $temp = $this->splitLine($move, $color, $isNew, $isRecommended, $preventDoubles, $usedIds, true, $level + 1, $rootVariation, [...$lineBefore, isset($move["move"]) ? $move["move"] : "xx"]);

                        // if we need to prevent doubles
                        if ($preventDoubles && isset($move["id"])) {
                            $usedIds[] = $move["id"];
                        }
                    }
                } else {
                    // prevent doubles
                    if (!isset($move["id"]) || !in_array($move["id"], $usedIds)) {
                        // check next move for match
                        $temp = $this->splitLine($move, $color, $isNew, $isRecommended, $preventDoubles, $usedIds, false, $level + 1, $rootVariation, [...$lineBefore, isset($move["move"]) ? $move["move"] : "xx"]);

                        // if we need to prevent doubles
                        if ($preventDoubles && isset($move["id"])) {
                            $usedIds[] = $move["id"];
                        }
                    }
                }
            } else {
                // if this move matches
                if ($ourMove && (($color != '' && $move['color'] == $color) || ($isNew && $move['new'] == 1 && !$autoplay) || ($isRecommended && $move['recommended'] == 1 && !$autoplay))) {
                    // prevent doubles
                    if (!isset($move["id"]) || !in_array($move["id"], $usedIds)) {
                        // add this this line as a part
                        $parts[] = $move;
                        //$parts[] = $isRecommended ? $rootVariation : $move;

                        // if we need to prevent doubles
                        if ($preventDoubles && isset($move["id"])) {
                            $usedIds[] = $move["id"];
                        }
                    }
                } else {
                    // prevent doubles
                    if (!isset($move["id"]) || !in_array($move["id"], $usedIds)) {
                        // check next move for match
                        $temp = $this->splitLine($move, $color, $isNew, $isRecommended, $preventDoubles, $usedIds, false, $level + 1, $rootVariation, [...$lineBefore, isset($move["move"]) ? $move["move"] : "xx"]);

                        // if we need to prevent doubles
                        if ($preventDoubles && isset($move["id"])) {
                            $usedIds[] = $move["id"];
                        }
                    }
                }
            }

            $parts = array_merge($parts, $temp);
        }

        return $parts;
    }

    private function isOurMove($fen, $color): bool
    {
        if ($fen === '' || $color === '') {
            return false;
        }

        $isWhiteToMove = $this->isWhiteMove($fen);

        return ($color == "white" && $isWhiteToMove) || ($color == "black" && !$isWhiteToMove);
    }

    // get the line until the criteria doesn't match anymore
    private function getLineUntil(array $moves, string $color = '', bool $isNew = false, bool $isRecommended = false, bool $preventDoubles = false, array &$usedIds = [], $level = 1, $match = false): array
    {
        $line = [];
        $ourMoveCount = 0;

        // is this our move
        //$ourMove = ($color == "white" && $level % 2 == 1) || ($color == "black" && $level % 2 == 0);

        // check the line to see if it matches
        foreach ($moves as $move) {

            // is this our move
            //$ourMove = ($move['color'] == "white" && $level % 2 == 1) || ($move['color'] == "black" && $level % 2 == 0);
            //$ourMove = isset($move['halfmove']) ? (($move['color'] == "white" && $move['halfmove'] % 2 == 1) || ($move['color'] == "black" && $move['halfmove'] % 2 == 0)) : $move['color'] == $color;

            //$ourMove = $move["before"] == $move["after"] ? false : (explode(" ", $move["before"])[1] == substr($move['color'], 0, 1));

            // Use the FEN to determine whose move it is
            //$isWhiteToMove = $this->isWhiteMove($move['after']);
            // Determine if it's our move based on color and turn
            //$ourMove = $move['color'] == "white" && $isWhiteToMove || $move['color'] == "black" && !$isWhiteToMove;

            // Determine if it's our move based on color and turn
            $ourMove = $move["before"] == $move["after"] ? false : $this->isOurMove($move['before'], $move['color']);
            //$ourMove = $this->isOurMove($move['after'], $move['color']);

            //dd($ourMove, $move);

            $autoplay = isset($move['autoplay']) ? $move['autoplay'] : false;

            $isMatch = (($color != '' && $move['color'] == $color) || ($isNew && $move['new'] == 1 && !$autoplay) || ($isRecommended && $move['recommended'] == 1 && !$autoplay));

            // if this move matches the criteria
            if (!$ourMove || $isMatch) {

                $match = $isMatch;

                if ($ourMove && !$autoplay) {
                    $ourMoveCount++;
                }

                // get the rest of the line
                [$temp, $lineMoveCount] = $this->getLineUntil($move['moves'], $color, $isNew, $isRecommended, $preventDoubles, $usedIds, $level + 1, $match);

                $ourMoveCount = $ourMoveCount + $lineMoveCount;

                // add this move if its our move or there are child moves
                if ($ourMove || count($temp) > 0) {
                    // prevent doubles
                    if (!isset($move["id"]) || !in_array($move["id"], $usedIds)) {
                        // add to the lines
                        $line[] = [
                            'id' => isset($move['id']) ? $move['id'] : 0,
                            'initialFen' => isset($move['initialFen']) ? $move['initialFen'] : "",
                            'before' => isset($move['before']) ? $move['before'] : "",
                            'after' => isset($move['after']) ? $move['after'] : "",
                            'move' => $move['move'],
                            'ourMove' => $ourMove,
                            'autoplay' => isset($move['autoplay']) ? $move['autoplay'] : false,
                            'new' => isset($move['new']) ? $move['new'] : 0,
                            'recommended' => isset($move['recommended']) ? $move['recommended'] : 0,
                            'moves' => $temp,
                            'multiple' => $move['multiple'],
                            'practiceCount' => isset($move['practiceCount']) ? $move['practiceCount'] : 0,
                            'practiceFailed' => isset($move['practiceFailed']) ? $move['practiceFailed'] : 0,
                            'practiceInARow' => isset($move['practiceInARow']) ? $move['practiceInARow'] : 0
                        ];

                        // if we need to prevent doubles
                        if ($preventDoubles && isset($move["id"])) {
                            $usedIds[] = $move["id"];
                        }
                    }
                }
            }
        }

        return [$line, $ourMoveCount];
    }

    // group the lines per starting position/color
    public function groupByPosition(array $lines, array $res = []): array
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
                $multiple = $this->findMultiple($line, $res);

                // if this is not the starting position
                $temp[] = [
                    'color' => $line['color'],
                    'initialFen' => isset($line['initialFen']) ? $line['initialFen'] : '',
                    //'eco' => isset($line['eco']) ? $line['eco'] : null,
                    'fen' => $line['before'],
                    'id' => isset($line['id']) ? $line['id'] : 0,
                    'line' => isset($line['line']) ? $line['line'] : [],
                    //'moves' => $line['before'] == $line['after'] ? $line['moves'] : [$line],
                    'moves' => $line['before'] == $line['after'] ? $line['moves'] : [$line],
                    'multiple' => $multiple,
                    'multiple_old' => $line['before'] == $line['after'] ? $line['multiple'] : [$line['move']],
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
                    $temp[$idx]['multiple_old'][] = $line['move'];
                    $temp[$idx]['ourMoveCount'] = $temp[$idx]['ourMoveCount'] ?? 0 + $line['ourMoveCount'] ?? 0;
                }
                //$temp[$idx]['multiple'] = $line['multiple'];
                //$temp[$idx]['multiplex'] = $line['multiple'];
            }
        }

        return $temp;
    }

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

            // testing..
            //if (substr($movePgn, 0, strlen("1. e4 c5 2. Nf3 d6")) == "1. e4 c5 2. Nf3 d6") {
            //if (isset($lines[$i]["practiceCount"]) && $lines[$i]["practiceCount"] > 0) {
            //$lineFailPercentage = 0.8;
            //$lineFailCount = 1;
            //$linePracticeCount = 10;
            //$linePracticeFailed = 8;
            //} else {
            //  $lineFailPercentage = 0;
            //                $lineFailCount = 0;
            //              $linePracticeCount = 0;
            //            $linePracticeFailed = 0;
            //      }
            //}


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

    public function getRoadmapFor($color, $lines, $forEverySplit = false, $parentEco = null): array
    {
        $roadmap = [];
        $i = 0;

        $mrepo = $this->repo->getEntityManager()->getRepository(Moves::class);

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
                                ->from('App\Entity\Moves', 'm')
                                ->where('m.Fen = :fen')
                                ->orderBy('m.Wins + m.Draws + m.Losses', 'DESC')
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
