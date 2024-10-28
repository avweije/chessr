<?php

namespace App\Repository;

use App\Entity\Main\ECO;
use App\Entity\Main\Repertoire;
use DateTime;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * @extends ServiceEntityRepository<Repertoire>
 */
class RepertoireRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry, private Security $security)
    {
        parent::__construct($registry, Repertoire::class);
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

    public function findOneBy(array $criteria, array|null $orderBy = null): object|null
    {
        // if the FenBefore is set
        if (isset($criteria['FenBefore'])) {
            // get the FenBefore with a dash instead of ep
            $parts = explode(" ", $criteria['FenBefore']);
            $fenBeforeDash = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];
            // if the FenBefore with a dash differs, search for both
            if ($fenBeforeDash != $criteria['FenBefore']) {
                $criteria['FenBefore'] = [$criteria['FenBefore'], $fenBeforeDash];
            }
        }
        // if the FenAfter is set
        if (isset($criteria['FenAfter'])) {
            // get the FenAfter with a dash instead of ep
            $parts = explode(" ", $criteria['FenAfter']);
            $fenAfterDash = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];
            // if the FenBefore with a dash differs, search for both
            if ($fenAfterDash != $criteria['FenAfter']) {
                $criteria['FenAfter'] = [$criteria['FenAfter'], $fenAfterDash];
            }
        }

        return parent::findOneBy($criteria, $orderBy);
    }

    public function findBy(array $criteria, array|null $orderBy = null, int|null $limit = null, int|null $offset = null): array
    {
        // if the FenBefore is set
        if (isset($criteria['FenBefore'])) {
            // get the FenBefore with a dash instead of ep
            $parts = explode(" ", $criteria['FenBefore']);
            $fenBeforeDash = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];
            // if the FenBefore with a dash differs, search for both
            if ($fenBeforeDash != $criteria['FenBefore']) {
                $criteria['FenBefore'] = [$criteria['FenBefore'], $fenBeforeDash];
            }
        }
        // if the FenAfter is set
        if (isset($criteria['FenAfter'])) {
            // get the FenAfter with a dash instead of ep
            $parts = explode(" ", $criteria['FenAfter']);
            $fenAfterDash = implode(" ", array_slice($parts, 0, 3)) . " - " . $parts[4];
            // if the FenBefore with a dash differs, search for both
            if ($fenAfterDash != $criteria['FenAfter']) {
                $criteria['FenAfter'] = [$criteria['FenAfter'], $fenAfterDash];
            }
        }

        return parent::findBy($criteria, $orderBy, $limit, $offset);
    }

    // is the current position included or are all parent moves at some point excluded
    public function isIncluded(string $fenBefore): bool
    {
        $included = false;

        $res = $this->findBy([
            "User" => $this->security->getUser(),
            "FenAfter" => $fenBefore
        ]);
        foreach ($res as $rec) {
            // if this move is included
            if (!$rec->isExclude()) {
                // if this is not the root position
                if ($rec->getFenBefore() !== $rec->getFenAfter()) {
                    // check if one of the parent moves is included
                    $included = $this->isIncluded($rec->getFenBefore());
                    if ($included) {
                        break;
                    }
                } else {
                    $included = true;
                    break;
                }
            }
        }

        return count($res) == 0 ? true : $included;
    }

    private function isRecommended(Repertoire $rep): bool
    {
        // if new, don't recommend
        if ($rep->getPracticeCount() == 0) {
            return false;
        }

        // get the fail percentage
        $failPercentage = $rep->getPracticeCount() == 0 ? 0 : max($rep->getPracticeFailed() / $rep->getPracticeCount(), 0);

        // get the days since last practice
        $daysSince = 999;
        if ($rep->getLastUsed() !== null) {
            $now = new DateTime();
            $daysSince = $now->diff($rep->getLastUsed())->format("%a");
        }

        // if still new (< 10 practices) recommended after a week not used
        if ($rep->getPracticeCount() < 9 && $daysSince >= 7) {
            return true;
        }

        //
        // - what other method did we have ??
        //
        // - 
        //

        // need at least 3 correct guesses in a row for low fail %, up to 5 in a row for high fail %
        $inARowNeeded = max(3, 3 + round($failPercentage * 2));

        // recommend periodically, based on fail %: every 1-4 weeks
        $daysNeeded = 7 * max(4 - (3 * $failPercentage), 1);

        // if practice in a row less than required (3-5) or based on last used and fail percentage
        return $rep->getPracticeInARow() < $inARowNeeded || $daysSince >= $daysNeeded;
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
        $new = $this->findLines($lines, '', true, false, true);
        // group by position and return
        return $this->groupByPosition($new, $lines);
    }

    // gets the recommended lines in the lines returned from getLines()
    public function getRecommendedLines($lines)
    {
        $usedIds = [];
        // get the white lines
        $recommended = $this->findLines($lines, '', false, true, true, $usedIds);

        //sort($usedIds);
        //dd($usedIds, $recommended);

        // 1. d4 Nf6 2. c4 e6 3. Nc3 d5 4. Nf3 Bb4 5. Qa4+ Nc6
        // 1. d4 Nf6 2. Nf3 d5 3. c4 e6 4. Nc3 Bb4 5. Qa4+ Nc6

        // Qa4+ = 2158
        // 

        // group by position and return
        return $this->groupByPosition($recommended, $lines);
    }

    // get the repertoire lines
    public function getLines(int $repertoireId = null, bool $isRoadmap = false, bool $statisticsOnly = false): array
    {
        // get the saved repository moves for this user
        $res = $this->findBy([
            'User' => $this->security->getUser(),
            'Exclude' => false
        ], ['HalfMove' => 'ASC']);

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

                $failPercentage = $rep->getPracticeCount() == 0 ? 0 : max($rep->getPracticeFailed() / $rep->getPracticeCount(), 0);
                $inARowNeeded = max(3, 3 + round($failPercentage / .5));
                $daysNeeded = 7 * max(4 - (4 * $failPercentage), 1);

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
                    'failPercentage' => $failPercentage,
                    'inARowNeeded' => $inARowNeeded,
                    'daysNeeded' => $daysNeeded,
                    'recommended' => $rep->isAutoPlay() ? 0 : ($this->isRecommended($rep) ? 1 : 0),
                    'practiceCount' => $rep->getPracticeCount(),
                    'practiceFailed' => $rep->getPracticeFailed(),
                    'practiceInARow' => $rep->getPracticeInARow(),
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
                    'recommended' => $this->isRecommended($rep) ? 1 : 0,
                    'practiceCount' => $rep->getPracticeCount(),
                    'practiceFailed' => $rep->getPracticeFailed(),
                    'practiceInARow' => $rep->getPracticeInARow(),
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
                    'failPercentage' => $rep->getPracticeCount() < 5 ? 1 : $rep->getPracticeFailed() / $rep->getPracticeCount(),
                    'recommended' => $this->isRecommended($rep) ? 1 : 0,
                    'practiceCount' => $rep->getPracticeCount(),
                    'practiceFailed' => $rep->getPracticeFailed(),
                    'practiceInARow' => $rep->getPracticeInARow(),
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
        $stmtFind = $this->getEntityManager()->getConnection()->prepare($sql);

        $stmtFind->bindValue('user', $this->security->getUser()->getId());

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
                        'failPercentage' => $failPercentage,
                        'inARowNeeded' => $inARowNeeded,
                        'daysNeeded' => $daysNeeded,
                        'recommended' => $rep->isAutoPlay() ? 0 : ($this->isRecommended($rep) ? 1 : 0),
                        'practiceCount' => $rep->getPracticeCount(),
                        'practiceFailed' => $rep->getPracticeFailed(),
                        'practiceInARow' => $rep->getPracticeInARow(),
                        'line' => $lineMoves,
                        'moves' => $childMoves,
                        'multiple' => $multiple
                    ];
                }
            }
        }

        /*
        // if we have any moves
        if (count($moves) > 0) {
            // get the complete lines
            for ($i = 0; $i < count($moves); $i++) {

                //$temp = array_key_exists('move', $moves[$i]) ? array_merge($lineMoves, [$moves[$i]['move']]) : $lineMoves;
                $temp = array_merge($lineMoves, [$moves[$i]['move']]);

                $moves[$i]['moves'] = $this->getLinesFor($color, $moves[$i]['after'], $repBefore, $temp, $step + 1);

                // if we have multiple moves here, add them to an array
                if (count($moves[$i]['moves']) > 1) {
                    foreach ($moves[$i]['moves'] as $move) {
                        //$moves[$i]['multiple'][] = $move['move'];
                        $moves[$i]['multiple'][] = [
                            "move" => $move['move'],
                            "cp" => isset($move['cp']) ? $move['cp'] : null,
                            "mate" => isset($move['mate']) ? $move['mate'] : null,
                            "line" => isset($move['line']) ? $move['line'] : null
                        ];
                    }
                }
            }
        }
            */

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
            $ourMove = isset($line['halfmove']) ? (($line['color'] == "white" && $line['halfmove'] % 2 == 1) || ($line['color'] == "black" && $line['halfmove'] % 2 == 0)) : $line['color'] == "white";

            // if we need a certain color and this is a match
            if ($ourMove && $color != "" && $line['color'] == $color) {
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
            if ($ourMove && $isNew && $line['new'] == 1 && (!isset($line['autoplay']) || !$line['autoplay'])) {
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
            if ($ourMove && $isRecommended && $line['recommended'] == 1 && (!isset($line['autoplay']) || !$line['autoplay'])) {
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

                $parts[] = $line;
                foreach ($temp as $t) {
                    $parts[] = $t;
                }
            }

            $linesUntil = [];

            // only prevent doubles from here on.. needs more testing
            //$preventDoubles = false;
            $usedIds = [];

            $ourMoveCount = 0;

            // get the line until
            for ($i = 0; $i < count($parts); $i++) {
                [$parts[$i]['moves'], $lineMoveCount] = $this->getLineUntil($parts[$i]['moves'], $color, $isNew, $isRecommended, $preventDoubles, $usedIds);
                if (isset($parts[$i]["move"]) || count($parts[$i]['moves']) > 0) {

                    // if our move, add 1 ?
                    $ourMove = $parts[$i]["before"] == $parts[$i]["after"] ? false : (explode(" ", $parts[$i]["before"])[1] == substr($parts[$i]['color'], 0, 1));
                    //$ourMove = isset($parts[$i]['halfmove']) ? (($parts[$i]['color'] == "white" && $parts[$i]['halfmove'] % 2 == 1) || ($parts[$i]['color'] == "black" && $parts[$i]['halfmove'] % 2 == 0)) : $parts[$i]['color'] == $color;
                    $autoplay = isset($move['autoplay']) ? $move['autoplay'] : false;
                    if ($ourMove && !$autoplay) {
                        $lineMoveCount++;
                    }

                    $parts[$i]["ourMoveCount"] = $lineMoveCount;

                    $linesUntil[] = $parts[$i];

                    //dd("parts:", $parts[$i]);

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
            $ourMove = $move["before"] == $move["after"] ? false : (explode(" ", $move["before"])[1] == substr($move['color'], 0, 1));

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
                    $temp[$idx]['ourMoveCount'] = $temp[$idx]['ourMoveCount'] + $line['ourMoveCount'];
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

        for ($i = 0; $i < count($lines); $i++) {

            //$lines[$i]["xxx"] = 1;

            $movePgn = $pgn;
            $moveIdx = $idx;

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
                $qb = $this->getEntityManager()->createQueryBuilder('ECO');
                $query = $qb->select('e')
                    ->from('App\Entity\Main\ECO', 'e')
                    ->where($qb->expr()->like(':pgn', 'CONCAT(e.PGN, \'%\')'))
                    ->setParameter('pgn', $movePgn)
                    ->orderBy('e.PGN', 'DESC')
                    ->setMaxResults(1)
                    ->getQuery();

                $res = $query->getArrayResult();

                if (count($res) > 0) {
                    $moveEco = ["code" => $res[0]["Code"], "name" => $res[0]["Name"]];
                }

                $qb = $this->getEntityManager()->createQueryBuilder('ECO');
                $query = $qb->select('e')
                    ->from('App\Entity\Main\ECO', 'e')
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
            if (isset($lines[$i]["practiceCount"]) && $lines[$i]["practiceCount"] > 0) {
                //$lineFailPercentage = 0.8;
                //$lineFailCount = 1;
                //$linePracticeCount = 10;
                //$linePracticeFailed = 8;
            } else {
                $lineFailPercentage = 0;
                $lineFailCount = 0;
                $linePracticeCount = 0;
                $linePracticeFailed = 0;
            }
            //}


            // if we have child moves
            if (isset($lines[$i]["moves"]) && count($lines[$i]["moves"]) > 0) {
                [$pct, $count, $pcount, $pfailed] = $this->addRoadmap($lines[$i]["moves"], $moveIdx, $movePgn, $moveEco, $hasMore);

                $lineFailPercentage += $pct;
                $lineFailCount += $count;

                $linePracticeCount += $pcount;
                $linePracticeFailed += $pfailed;

                $moveEcoCount += $pcount;
                $moveEcoFailed += $pfailed;

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

            $failPercentage += $lineFailPercentage;
            $failCount += $lineFailCount;

            $practiceCount += $linePracticeCount;
            $practiceFailed += $linePracticeFailed;
        }

        //if ($failCount > 0) {
        //$failPercentage = $failPercentage / $failCount;
        //}

        return [$failPercentage, $failCount, $parentEcoCount, $parentEcoFailed];
    }

    public function getRoadmapFor($lines, $forEverySplit = false, $parentEco = null): array
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

                $temp = $this->getRoadmapFor($line["moves"], $forEverySplit, $line['eco']);

                //
                // if we have an ECO code, add it as new line
                //
                // - only if splitting by ECO ??
                //

                if (isset($line['eco']) && isset($line['eco']['code']) && $line['eco']['code'] != "") {

                    // get the line up to this move
                    $ln = [];
                    $pgna = explode(" ", $line["pgn"]);
                    for ($i = 0; $i < count($pgna); $i++) {
                        if (preg_match('/^\\d+\\./', $pgna[$i]) !== 1 && trim($pgna[$i]) != "") {
                            $ln[] = $pgna[$i];
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
                $temp = $this->getRoadmapFor($line["moves"], $forEverySplit, $parentEco);
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

    //    /**
    //     * @return Repertoire[] Returns an array of Repertoire objects
    //     */
    //    public function findByExampleField($value): array
    //    {
    //        return $this->createQueryBuilder('r')
    //            ->andWhere('r.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->orderBy('r.id', 'ASC')
    //            ->setMaxResults(10)
    //            ->getQuery()
    //            ->getResult()
    //        ;
    //    }

    //    public function findOneBySomeField($value): ?Repertoire
    //    {
    //        return $this->createQueryBuilder('r')
    //            ->andWhere('r.exampleField = :val')
    //            ->setParameter('val', $value)
    //            ->getQuery()
    //            ->getOneOrNullResult()
    //        ;
    //    }
}
