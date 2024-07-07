<?php

namespace App\Controller;

use App\Entity\ECO;
use App\Entity\Moves;
use App\Entity\Repertoire;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiController extends AbstractController
{
    private $em;

    public function __construct(EntityManagerInterface $em)
    {
        $this->em = $em;
    }

    #[Route('/api/moves', name: 'app_api_moves')]
    public function apiMoves(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        // get the ECO codes for this position and the next move
        $codes = $this->em->getRepository(ECO::class)->findBybyPgn($data['pgn']);

        // get the most played moves for this position
        $qb = $this->em->createQueryBuilder();
        $qb->select('m')
            ->from('App\Entity\Moves', 'm')
            ->where('m.Fen = :fen')
            ->orderBy('m.Wins + m.Draws + m.Losses', 'DESC')
            ->setParameter('fen', $data['fen']);

        $res = $qb->getQuery()->getResult();

        $games = ['total' => 0, 'moves' => [], 'fen' => $data['fen']];

        foreach ($res as $mov) {
            // get the total
            $total = $mov->getWins() + $mov->getDraws() + $mov->getLosses();
            // add to grand total
            $games['total'] += $total;
            // add the move
            $games['moves'][] = [
                'move' => $mov->getMove(),
                'eco' => '',
                'name' => '',
                'repertoire' => 0,
                'percentage' => 0,
                'total' => $total,
                'wins' => $mov->getWins(),
                'draws' => $mov->getDraws(),
                'losses' => $mov->getLosses()
            ];
        }

        // if we have moves
        if ($games['total'] > 0) {
            // set the percentage each move is played
            for ($i = 0; $i < count($games['moves']); $i++) {
                $games['moves'][$i]['percentage'] = (int) round(($games['moves'][$i]['total'] / $games['total']) * 100, 0);
            }
        }

        // get the current PGN
        $current = $codes['pgn'];
        // if it's white to move
        if ($codes['halfmove'] % 2 == 1) {
            // add the move number to the PGN
            $current = $current . ($current != "" ? " " : "") . (($codes['halfmove'] + 1) / 2) . ". ";
        }

        //print "Pgn: " . $codes['pgn'] . "<br>";
        //print "Current: $current<br>";

        //dd($played);

        // get the repository
        $repository = $this->em->getRepository(Repertoire::class);

        // see if we have the current position saved
        $saved = 1;
        if ($data['pgn'] != '') {
            $res = $repository->findOneBy([
                'User' => $this->getUser(),
                'Color' => $data['color'],
                'FenAfter' => $data['fen']
            ]);

            $saved = $res ? 1 : 0;
        }

        // find the saved repository moves from this position
        $res = $repository->findBy([
            'User' => $this->getUser(),
            'Color' => $data['color'],
            'FenBefore' => $data['fen']
        ]);

        $reps = [];
        foreach ($res as $rep) {
            $move = ['move' => $rep->getMove(), 'eco' => '', 'name' => ''];
            // find the ECO code for this move
            for ($i = 0; $i < count($codes['next']); $i++) {
                $temp = explode(' ', $codes['next'][$i]['PGN']);
                if (array_pop($temp) == $rep->getMove()) {
                    $move['eco'] = $codes['next'][$i]['Code'];
                    $move['name'] = $codes['next'][$i]['Name'];
                    $codes['next'][$i]['repertoire'] = 1;
                }
            }

            $reps[] = $move;
        }

        // find the ECO codes for the moves and see if we have them in our repertoire
        for ($i = 0; $i < count($games['moves']); $i++) {
            // find the ECO code
            foreach ($codes['next'] as $code) {
                if ($code['PGN'] == ($current . $games['moves'][$i]['move'])) {
                    $games['moves'][$i]['eco'] = $code['Code'];
                    $games['moves'][$i]['name'] = $code['Name'];
                }
            }
            // see if we have this move in our repertoire
            foreach ($res as $rep) {
                if ($rep->getMove() == $games['moves'][$i]['move']) {
                    $games['moves'][$i]['repertoire'] = 1;
                }
            }
        }

        return new JsonResponse(['eco' => $codes, 'games' => $games, 'repertoire' => $reps, 'saved' => $saved]);
    }

    #[Route('/api/repertoire', methods: ['POST'], name: 'app_api_repertoire')]
    public function apiRepertoire(Request $request): JsonResponse
    {
        // get the data
        $data = $request->getPayload()->all();
        // save the repertoire
        $saved = $this->saveRepertoire($data['color'], $data['moves']);

        return new JsonResponse($saved);
    }

    // save a repertoire
    private function saveRepertoire(string $color, array $moves): bool
    {
        $repository = $this->em->getRepository(Repertoire::class);

        // any saved?
        $saved = false;
        $i = 0;

        // loop through the moves
        foreach ($moves as $move) {
            // check to see if we already saved this move
            $data = $repository->findBy([
                'User' => $this->getUser(),
                'Color' => $color,
                'FenBefore' => $move['before'],
                'Move' => $move['san']
            ]);

            $i++;

            // skip this one if already saved
            if (count($data) > 0) continue;

            // save the move to the repertoire
            $rep = new Repertoire();
            $rep->setUser($this->getUser());
            $rep->setColor($color);
            $rep->setFenBefore($move['before']);
            $rep->setFenAfter($move['after']);
            $rep->setPgn($move['pgn']);
            $rep->setMove($move['san']);
            $rep->setHalfMove($i);
            $rep->setPracticeCount(0);
            $rep->setPracticeFailed(0);
            $rep->setPracticeInARow(0);

            // tell Doctrine you want to (eventually) save the Product (no queries yet)
            $this->em->persist($rep);

            $saved = true;
        }

        // if we actually saved anything
        if ($saved) {
            // actually executes the queries (i.e. the INSERT query)
            $this->em->flush();
        }

        return $saved;
    }

    #[Route('/api/practice', methods: ['GET'], name: 'app_api_practice')]
    public function apiPractice(Request $request): JsonResponse
    {
        $data = $request->getPayload()->all();

        // get the repository
        $repository = $this->em->getRepository(Repertoire::class);

        // get the saved repository moves for this user
        $res = $repository->findBy(['User' => $this->getUser()], ['HalfMove' => 'ASC']);

        // the lines
        $lines = [];
        // find the 1st moves
        foreach ($res as $rep) {
            // if this is a 1st move
            if ($rep->getHalfMove() == 1) {
                // see if we already have the starting position entry
                if (count($lines) == 0) {
                    $lines[] = ['before' => $rep->getFenBefore(), 'after' => $rep->getFenAfter(), 'moves' => []];
                }
                // add the move
                $lines[0]['moves'][] = [
                    'color' => $rep->getColor(),
                    'move' => $rep->getMove(),
                    'halfmove' => $rep->getHalfMove(),
                    'before' => $rep->getFenBefore(),
                    'after' => $rep->getFenAfter(),
                    'new' => $rep->getPracticeCount() == 0 ? 1 : 0,
                    'failPercentage' => $rep->getPracticeCount() < 5 ? 1 : $rep->getPracticeFailed() / $rep->getPracticeCount(),
                    'recommended' => $this->isRecommended($rep->getPracticeCount(), $rep->getPracticeFailed(), $rep->getPracticeInARow()) ? 1 : 0,
                    'line' => [],
                    'moves' => []
                ];
            }
        }

        // now add the lines based off the 1st moves (so we can have transpositions)
        for ($i = 0; $i < count($lines); $i++) {
            for ($x = 0; $x < count($lines[$i]['moves']); $x++) {
                $lines[$i]['moves'][$x]['moves'] = $this->getLines($lines[$i]['moves'][$x]['color'], $lines[$i]['moves'][$x]['after'], $res, [$lines[$i]['moves'][$x]['move']]);
            }
        }

        //dd($lines);

        // the response
        $resp = ['white' => [], 'black' => [], 'new' => [], 'recommended' => []];

        // if we have a repertoire
        if (count($lines) > 0) {
            // get the white lines
            $resp['white'] = $this->findLines($lines[0]['moves'], 'white', false, false);
            // get the black lines
            $resp['black'] = $this->findLines($lines[0]['moves'], 'black', false, false);
            // find the new lines
            $resp['new'] = $this->findLines($lines[0]['moves'], '', true, false);
            // find the recommended lines
            $resp['recommended'] = $this->findLines($lines[0]['moves'], '', false, true);

            // group the lines per starting position / color
            $resp['white'] = $this->groupByPosition($resp['white']);
            $resp['black'] = $this->groupByPosition($resp['black']);
            $resp['new'] = $this->groupByPosition($resp['new']);
            $resp['recommended'] = $this->groupByPosition($resp['recommended']);
        }

        //dd($resp);

        return new JsonResponse($resp);
    }

    // group the lines per starting position/color
    private function groupByPosition(array $lines): array
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

            if ($idx == -1) {
                $temp[] = ['fen' => $line['before'], 'color' => $line['color'], 'line' => $line['line'], 'moves' => [$line]];
            } else {
                $temp[$idx]['moves'][] = $line;
            }
        }

        return $temp;
    }

    private function isRecommended(int $practiceCount, int $practiceFailed, int $practiceInARow): bool
    {
        // get the fail percentage
        $failPct = $practiceCount < 5 ? 1 : $practiceFailed / $practiceCount;

        return $practiceCount == 0 ? false : $practiceInARow < $failPct * 8;
        //return $practiceCount == 0 ? false : true;
    }

    // get the complete lines for a certain color and starting position
    private function getLines(string $color, string $fen, array $res, $lineMoves = [], int $step = 1): array
    {

        $moves = [];
        $validated = [];

        // find the follow up moves for a certain color and position
        foreach ($res as $rep) {
            if ($rep->getColor() == $color && $rep->getFenBefore() == $fen) {
                $moves[] = [
                    'color' => $color,
                    'move' => $rep->getMove(),
                    'halfmove' => $rep->getHalfMove(),
                    'before' => $rep->getFenBefore(),
                    'after' => $rep->getFenAfter(),
                    'new' => $rep->getPracticeCount() == 0 ? 1 : 0,
                    'failPercentage' => $rep->getPracticeCount() < 5 ? 1 : $rep->getPracticeFailed() / $rep->getPracticeCount(),
                    'recommended' => $this->isRecommended($rep->getPracticeCount(), $rep->getPracticeFailed(), $rep->getPracticeInARow()) ? 1 : 0,
                    'line' => $lineMoves,
                    'moves' => []
                ];
            }
        }

        // if we have any moves
        if (count($moves) > 0) {

            // get the complete lines
            for ($i = 0; $i < count($moves); $i++) {

                //$temp = array_key_exists('move', $moves[$i]) ? array_merge($lineMoves, [$moves[$i]['move']]) : $lineMoves;
                $temp = array_merge($lineMoves, [$moves[$i]['move']]);

                $moves[$i]['moves'] = $this->getLines($color, $moves[$i]['after'], $res, $temp, $step + 1);

                /*

                If there are no child moves for this move and this move is not our move (=black move for white repertoire)
                we need to remove this move from the line, since we shouldn't end on the opponent's move..

                */

                // is this our move
                $ourMove = ($color == "white" && $moves[$i]['halfmove'] % 2 == 1) || ($color == "black" && $moves[$i]['halfmove'] % 2 == 0);

                // add this move if its our move or there are child moves
                if ($ourMove || count($moves[$i]['moves']) > 0) {
                    $validated[] = $moves[$i];
                }
            }
        }

        return $validated;
    }

    // find the lines of a certain type
    private function findLines(array $lines, string $color = "", bool $isNew = false, bool $isRecommended = false, string $rootColor = "", int $level = 1): array
    {
        $res = [];

        // find the starting points for the lines
        foreach ($lines as $line) {
            // set the color (from the root object)
            if ($rootColor != "") {
                $line['color'] = $rootColor;
            }

            // if we need a certain color and this is a match
            if ($color != "" && $line['color'] == $color) {
                // add to the lines
                $res[] = $line;

                continue;
            }
            // if we need the new lines and this is a match
            if ($isNew && $line['new'] == 1) {
                // add to the lines
                $res[] = $line;

                continue;
            }
            // if we need the recommended lines and this is a match
            if ($isRecommended && $line['recommended'] == 1) {
                // add to the lines
                $res[] = $line;

                continue;
            }

            // check this line to see if any child moves match the criteria
            $temp = $this->findLines($line['moves'], $color, $isNew, $isRecommended, $line['color'], $level + 1);
            foreach ($temp as $t) {
                $res[] = $t;
            }
        }

        // at top level of this function, return the lines until
        if ($level == 1) {
            // we need to split the lines into parts (that match the criteria)
            $parts = [];
            // split the lines at the part(s) where it stops matching (and later in the line matches again)
            foreach ($res as $line) {
                $temp = $this->splitLine($line, $color, $isNew, $isRecommended);

                $parts[] = $line;
                foreach ($temp as $t) {
                    $parts[] = $t;
                }
            }

            $linesUntil = [];

            // get the line until
            for ($i = 0; $i < count($parts); $i++) {
                $parts[$i]['moves'] = $this->getLineUntil($parts[$i]['moves'], $color, $isNew, $isRecommended);
                $linesUntil[] = $parts[$i];
            }

            return $linesUntil;
        } else {
            // return the line back to the findLines internal call
            return $res;
        }
    }

    // split the line into parts that match
    private function splitLine($line, string $color = "", bool $isNew = false, bool $isRecommended = false, bool $match = true): array
    {
        $parts = [];

        foreach ($line['moves'] as $move) {
            $temp = [];
            // if the last move was a match
            if ($match) {
                // if this move matches also
                if (($color != '' && $move['color'] == $color) || ($isNew && $move['new'] == 1) || ($isRecommended && $move['recommended'] == 1)) {
                    // check next move for a non-match
                    $temp = $this->splitLine($move, $color, $isNew, $isRecommended, true);
                } else {
                    // check next move for match
                    $temp = $this->splitLine($move, $color, $isNew, $isRecommended, false);
                }
            } else {
                // if this move matches
                if (($color != '' && $move['color'] == $color) || ($isNew && $move['new'] == 1) || ($isRecommended && $move['recommended'] == 1)) {
                    // add this this line as a part
                    $parts[] = $move;
                } else {
                    // check next move for match
                    $temp = $this->splitLine($move, $color, $isNew, $isRecommended, false);
                }
            }

            $parts = array_merge($parts, $temp);
        }

        return $parts;
    }

    // get the line until the criteria doesn't match anymore
    private function getLineUntil(array $moves, string $color = '', bool $isNew = false, bool $isRecommended = false, $level = 1): array
    {
        $line = [];

        // check the line to see if it matches
        foreach ($moves as $move) {
            // if this move matches the criteria
            if (($color != '' && $move['color'] == $color) || ($isNew && $move['new'] == 1) || ($isRecommended && $move['recommended'] == 1)) {
                // add to the lines
                $line[] = [
                    'move' => $move['move'],
                    'moves' => $this->getLineUntil($move['moves'], $color, $isNew, $isRecommended, $level + 1)
                ];
            }
        }

        return $line;
    }
}
