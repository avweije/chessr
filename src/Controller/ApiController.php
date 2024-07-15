<?php

namespace App\Controller;

use App\Config\DownloadSite;
use App\Config\DownloadStatus;
use App\Config\DownloadType;
use App\Entity\Downloads;
use App\Entity\ECO;
use App\Entity\Mistake;
use App\Entity\Moves;
use App\Entity\Repertoire;
use App\Library\ChessJs;
use App\Library\GameDownloader;
use App\Library\UCI;
use App\Service\MyPgnParser;
use DateTime;
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
    private $myPgnParser;

    public function __construct(EntityManagerInterface $em, MyPgnParser $myPgnParser)
    {
        $this->em = $em;
        $this->myPgnParser = $myPgnParser;
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
        $current = $codes['pgn'] . ($codes['pgn'] != "" ? " " : "");
        // if it's white to move
        if ($codes['halfmove'] % 2 == 1) {
            // add the move number to the PGN
            $current = $current . (($codes['halfmove'] + 1) / 2) . ". ";
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

        return new JsonResponse(['eco' => $codes, 'games' => $games, 'repertoire' => $reps, 'saved' => $saved, 'current' => $current]);
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

    #[Route('/api/download/archives', methods: ['GET'], name: 'app_api_download_archives')]
    public function apiDownloadArchives(Request $request): JsonResponse
    {
        $downloader = new GameDownloader();

        $archives = $downloader->downloadArchives();

        // $games = $downloader->downloadGames(2024, 1);

        // set the JSON response
        $resp = ['archives' => $downloader->getArchiveYearsMonths()];

        return new JsonResponse($resp);
    }

    #[Route('/api/download/games/{year}/{month}', methods: ['GET'], name: 'app_api_download_games')]
    public function apiDownloadGames(Request $request, $year, $month): JsonResponse
    {
        $downloader = new GameDownloader();

        //$archives = $downloader->downloadArchives();

        $games = $downloader->downloadGames($year, $month);

        // set the JSON response
        $resp = ['games' => $downloader->getTotals()];

        return new JsonResponse($resp);
    }

    #[Route('/api/analyse/{type}/{year}/{month}', methods: ['GET'], name: 'app_api_analyse')]
    public function apiAnalyseGames(Request $request, $type, $year, $month): JsonResponse
    {

        // validate the type - return error
        $downloadType = DownloadType::tryFrom(ucfirst($type));

        $resp = ['type' => $type, 'year' => $year, 'month' => $month];

        if ($downloadType == null) {

            $resp['test'] = 'testing 411 response with symfony';

            // testing..

            $jsonResponse = new JsonResponse(['error' => "Invalid type given."]);

            $jsonResponse->setStatusCode(411);

            return $jsonResponse;
        }


        // validate no current downloads going on - return error

        // get the repository
        $repository = $this->em->getRepository(Downloads::class);

        // find the download record
        $rec = $repository->findOneBy([
            'User' => $this->getUser(),
            'Type' => $type,
            'Year' => $year,
            'Month' => $month
        ]);

        // the UUID of the last game we processed
        $lastUUID = "";

        // if there is a download record
        if ($rec !== null) {
            // depending the status
            switch ($rec->getStatus()) {
                case DownloadStatus::Downloading:
                    // check the datetime
                    $now = new DateTime();

                    $secs =  $now->getTimestamp() - $rec->getDateTime()->getTimestamp();
                    $mins = floor($secs / 60);

                    // if 5 minutes ago or more
                    if ($mins > 4) {
                        // update status for record
                        $rec->setStatus(DownloadStatus::Partial);
                        $rec->setDateTime(new DateTime());

                        $this->em->persist($rec);
                        $this->em->flush();
                    } else {
                        // send an error response
                        $jsonResponse = new JsonResponse(['error' => "Downloading already in progress, please try again later."]);
                        $jsonResponse->setStatusCode(409);

                        return $jsonResponse;
                    }

                    break;
                case DownloadStatus::Completed:
                    // send an error response
                    $jsonResponse = new JsonResponse(['error' => "Download already completed."]);
                    $jsonResponse->setStatusCode(409);

                    return $jsonResponse;

                    break;
                case DownloadStatus::Partial:
                    // update the status
                    $rec->setStatus(DownloadStatus::Downloading);
                    $rec->setDateTime(new DateTime());

                    $this->em->persist($rec);
                    $this->em->flush();

                    break;
            }

            // get the last UUID
            $lastUUID = $rec->getLastUUID();
            if ($lastUUID == null) {
                $lastUUID = "";
            }
        } else {

            // add download record
            $rec = new Downloads();
            $rec->setUser($this->getUser());
            $rec->setSite(DownloadSite::ChessDotCom);
            $rec->setYear($year);
            $rec->setMonth($month);
            $rec->setType($downloadType->value);
            $rec->setStatus(DownloadStatus::Downloading);
            $rec->setDateTime(new DateTime());

            $this->em->persist($rec);
            $this->em->flush();
        }

        // get the game downloader
        $downloader = new GameDownloader();
        // download the games
        $downloader->downloadGames($year, $month);
        // get the games of the right type
        $games = $downloader->getGames($type);

        // start the engine
        $uci = new UCI();

        // request the 3 best moves
        $uci->setOption("MultiPV", 3);
        // request only the best move
        //$uci->setOption("MultiPV", 1);

        // keep track of the duration
        $time = microtime(true);

        $lastUUIDFound = false;

        // the max games to process
        $maxGames = 4;
        //$maxGames = 1;
        $processed = 0;
        $completed = false;

        $mistakes = [];

        $cnt = count($games);

        for ($i = 0; $i < $cnt; $i++) {
            // if we can process this game
            if ($lastUUID == "" || $lastUUIDFound) {

                // safety check..
                if (!isset($games[$i]["pgn"])) {
                    print "PGN not set:<br>";
                    dd($games[$i]);
                }

                // parse the game
                $game = $this->myPgnParser->parsePgnString($games[$i]["pgn"], true);

                // analyse the game
                $temp = $this->analyseGame($uci, $game);

                // if there are any mistakes
                if (count($temp) > 0) {
                    // add them to the array
                    $mistakes[] = [
                        "white" => $game->getWhite(),
                        "black" => $game->getBlack(),
                        "link" => $game->getLink(),
                        "mistakes" => $temp
                    ];

                    // add them to the database
                    foreach ($temp as $mistake) {
                        // add the mistake
                        $rc = new Mistake();

                        $rc->setUser($this->getUser());
                        $rc->setWhite($game->getWhite());
                        $rc->setBlack($game->getBlack());
                        $rc->setLink($game->getLink());
                        $rc->setType($mistake["type"]);
                        $rc->setFen($mistake["fen"]);
                        $rc->setPgn($mistake["line"]["pgn"]);
                        $rc->setMove($mistake["move"]);
                        $bms = [];
                        foreach ($mistake["bestmoves"] as $bm) {
                            $bms[] = $bm["san"];
                        }
                        $rc->setBestMoves(join(" ", $bms));

                        // save it
                        $this->em->persist($rc);
                    }
                }

                $processed++;

                // update the last UUID
                $rec->setDateTime(new DateTime());
                $rec->setLastUUID($games[$i]['uuid']);

                $this->em->persist($rec);
                $this->em->flush();
            } else if ($lastUUID != "") {
                // match the last UUID we processed
                $lastUUIDFound = $lastUUID == $games[$i]['uuid'];
            }

            // completed all games
            $completed = $i + 1 == $cnt;

            // stop when we've reached the max
            if ($processed >= $maxGames) {
                break;
            }
        }

        // update the status
        $rec->setStatus($completed ? DownloadStatus::Completed : DownloadStatus::Partial);
        $rec->setDateTime(new DateTime());

        $this->em->persist($rec);
        $this->em->flush();

        // set the totals
        $totals = ["inaccuracies" => 0, "mistakes" => 0, "blunders" => 0];

        foreach ($mistakes as $mistake) {
            foreach ($mistake["mistakes"] as $mis) {
                switch ($mis["type"]) {
                    case "inaccuracy":
                        $totals["inaccuracies"]++;
                        break;
                    case "mistake":
                        $totals["mistakes"]++;
                        break;
                    case "blunder":
                        $totals["blunders"]++;
                        break;
                }
            }
        }

        return new JsonResponse([
            'status' => 'Analysis done.',
            'processed' => $processed,
            'totals' => $totals
        ]);
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
        $lines = [
            ['color' => 'white', 'before' => '', 'after' => '', 'new' => 1, 'recommended' => 1, 'moves' => []],
            ['color' => 'black', 'before' => '', 'after' => '', 'new' => 1, 'recommended' => 1, 'moves' => []]
        ];
        // find the 1st moves
        foreach ($res as $rep) {
            // if this is a 1st move
            if ($rep->getHalfMove() == 1) {
                /*
                // see if we already have the starting position entry
                if (count($lines) == 0) {
                    //$lines[] = ['before' => $rep->getFenBefore(), 'after' => $rep->getFenAfter(), 'moves' => []];
                    $lines[] = ['before' => $rep->getFenBefore(), 'moves' => []];
                }
                */

                // set the FEN before/after for white & black
                $lines[0]['before'] = $rep->getFenBefore();
                $lines[0]['after'] = $rep->getFenBefore();
                $lines[1]['before'] = $rep->getFenBefore();
                $lines[1]['after'] = $rep->getFenBefore();

                // add the move
                $lines[($rep->getColor() == 'white' ? 0 : 1)]['moves'][] = [
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


        /*

        We need to disregard the opposite color moves in these filters..

        If it's a white repertoire, only white recommended/new/etc counts, not for the black moves..

        */

        // now add the lines based off the 1st moves (so we can have transpositions)
        for ($i = 0; $i < count($lines); $i++) {

            $lines[$i]['moves'] = $this->getLines($lines[$i]['color'], $lines[$i]['after'], $res, []);
            $lines[$i]['multiple'] = [];

            // if we have multiple moves here, add them to an array
            if (count($lines[$i]['moves']) > 1) {
                foreach ($lines[$i]['moves'] as $move) {
                    $lines[$i]['multiple'][] = $move['move'];
                }
            }

            /*
            for ($x = 0; $x < count($lines[$i]['moves']); $x++) {
                $lines[$i]['moves'][$x]['moves'] = $this->getLines($lines[$i]['moves'][$x]['color'], $lines[$i]['moves'][$x]['after'], $res, [$lines[$i]['moves'][$x]['move']]);
            }
            */
        }

        //dd($lines);

        // the response
        $resp = ['white' => [], 'black' => [], 'new' => [], 'recommended' => []];

        // if we have a repertoire
        if (count($lines) > 0) {
            /*
            // get the white lines
            $resp['white'] = $this->findLines($lines[0]['moves'], 'white', false, false);
            // get the black lines
            $resp['black'] = $this->findLines($lines[0]['moves'], 'black', false, false);
            // find the new lines
            $resp['new'] = $this->findLines($lines[0]['moves'], '', true, false);
            // find the recommended lines
            //$resp['recommended'] = $this->findLines($lines[0]['moves'], '', false, true);
            $resp['recommended'] = $this->findLines($lines[0]['moves'], '', false, true);
            */

            // get the white lines
            $resp['white'] = $this->findLines($lines, 'white', false, false);
            // get the black lines
            $resp['black'] = $this->findLines($lines, 'black', false, false);
            // find the new lines
            $resp['new'] = $this->findLines($lines, '', true, false);
            // find the recommended lines
            $resp['recommended'] = $this->findLines($lines, '', false, true);

            //dd($lines, $resp['new']);

            //print "Recommended:<br>";
            //dd($res, $lines, $resp['recommended']);

            //$temp = [...$resp['new']];

            //
            /*

            Move 1. e4 = recommended: < 5 practices
            Move 3. Nc6 (1. e4 f5 2. e5 Nc6) = recommended: Failed 6/8 == this is a black move!! not included!!

            findLines is incorrect for recommended, only includes the 1. e4 move
            should also include 3. Nc6 move with line: [E4, f5, e5]

            */
            //

            // group the lines per starting position / color
            $resp['white'] = $this->groupByPosition($resp['white']);
            $resp['black'] = $this->groupByPosition($resp['black']);
            $resp['new'] = $this->groupByPosition($resp['new']);
            $resp['recommended'] = $this->groupByPosition($resp['recommended']);

            //print "New:<br>";
            //dd($resp['new']);
        }

        //

        //print "New:<br>";
        //dd($res, $resp['recommended']);

        //


        /*

        
        -- added: "multiple: []" array with all the moves for that position. 
        -- only the moves that match the criteria (new, recommended) are included in "moves: []"
        -- we can use this in the front-end to show other moves for that position (that dont need to be played --
        -- but should instead immediately be shown in the moves list as if they were played already)

        
        */

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

            // if we don't  have this FEN position yet
            if ($idx == -1) {
                // if this is not the starting position
                $temp[] = [
                    'fen' => $line['before'],
                    'color' => $line['color'],
                    'line' => isset($line['line']) ? $line['line'] : [],
                    'moves' => $line['before'] == $line['after'] ? $line['moves'] : [$line],
                    'multiple' => $line['before'] == $line['after'] ? $line['multiple'] : [$line['move']]
                ];
            } else {
                $temp[$idx]['moves'][] = $line;
                $temp[$idx]['multiple'][] = $line['move'];
            }
        }

        return $temp;
    }

    private function isRecommended(int $practiceCount, int $practiceFailed, int $practiceInARow): bool
    {
        // get the fail percentage
        $failPct = $practiceCount < 5 ? 1 : $practiceFailed / $practiceCount;

        if ($practiceFailed > 0) {
            //print "PracticeFailed: $practiceCount / $practiceFailed / $practiceInARow = $failPct = " . ($practiceCount == 0 ? false : $practiceInARow < $failPct * 8) . "<br>";
        }

        return $practiceCount == 0 ? false : $practiceInARow < $failPct * 8;
        //return $practiceCount == 0 ? false : true;
    }

    // get the complete lines for a certain color and starting position
    private function getLines(string $color, string $fen, array $res, $lineMoves = [], int $step = 1): array
    {
        $moves = [];

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
                    'moves' => [],
                    'multiple' => []
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

                // if we have multiple moves here, add them to an array
                if (count($moves[$i]['moves']) > 1) {
                    foreach ($moves[$i]['moves'] as $move) {
                        $moves[$i]['multiple'][] = $move['move'];
                    }
                }
            }
        }

        return $moves;
    }

    // find the lines of a certain type
    private function findLines(array $lines, string $color = "", bool $isNew = false, bool $isRecommended = false, string $rootColor = "", int $level = 1): array
    {
        $res = [];

        //dd($lines);

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
                // add to the lines
                $res[] = $line;

                continue;
            }
            // if we need the new lines and this is a match
            if ($ourMove && $isNew && $line['new'] == 1) {
                // add to the lines
                $res[] = $line;

                continue;
            }
            // if we need the recommended lines and this is a match
            if ($ourMove && $isRecommended && $line['recommended'] == 1) {

                //print "- level (recommended): $level <br>";

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

            //dd($lines, $res);

            // we need to split the lines into parts (that match the criteria)
            $parts = [];
            // split the lines at the part(s) where it stops matching (and later in the line matches again)
            foreach ($res as $line) {

                $temp = $this->splitLine($line, $color, $isNew, $isRecommended);

                //dd($line, $temp);

                $parts[] = $line;
                foreach ($temp as $t) {
                    $parts[] = $t;
                }
            }

            //dd($parts);

            $linesUntil = [];

            // get the line until
            for ($i = 0; $i < count($parts); $i++) {
                $parts[$i]['moves'] = $this->getLineUntil($parts[$i]['moves'], $color, $isNew, $isRecommended);
                $linesUntil[] = $parts[$i];
            }

            //dd($parts, $linesUntil);

            return $linesUntil;
        } else {
            // return the line back to the findLines internal call
            return $res;
        }
    }

    // split the line into parts that match
    private function splitLine($line, string $color = "", bool $isNew = false, bool $isRecommended = false, bool $match = true, $level = 1): array
    {
        $parts = [];

        // is this our move?
        $ourMove = ($line['color'] == "white" && $level % 2 == 1) || ($line['color'] == "black" && $level % 2 == 0);
        //$ourMove = ($color == "white" && $level % 2 == 0) || ($color == "black" && $level % 2 == 1);

        if ($line['color'] == "white" && $level == 1 && $isRecommended) {
            //print "level: $level - ourMove: " . $ourMove . "<br>";
        }

        foreach ($line['moves'] as $move) {
            $temp = [];

            if ($line['color'] == "white" && $isRecommended) {
                //print "level: $level - move: " . $move['move'] . " - " . $ourMove . "<br>";
            }

            // if the last move was a match
            if ($match) {
                // if this move matches also
                if (!$ourMove || ($color != '' && $move['color'] == $color) || ($isNew && $move['new'] == 1) || ($isRecommended && $move['recommended'] == 1)) {

                    if ($line['color'] == "white" && $isRecommended) {
                        //print "--1<br>";
                    }

                    // check next move for a non-match
                    $temp = $this->splitLine($move, $color, $isNew, $isRecommended, true, $level + 1);
                } else {

                    if ($line['color'] == "white" && $isRecommended) {
                        //print "--2<br>";
                    }

                    // check next move for match
                    $temp = $this->splitLine($move, $color, $isNew, $isRecommended, false, $level + 1);
                }
            } else {
                // if this move matches
                if ($ourMove && (($color != '' && $move['color'] == $color) || ($isNew && $move['new'] == 1) || ($isRecommended && $move['recommended'] == 1))) {

                    if ($line['color'] == "white" && $isRecommended) {
                        //print "--3<br>";
                    }

                    // add this this line as a part
                    $parts[] = $move;
                } else {

                    if ($line['color'] == "white" && $isRecommended) {
                        //print "--4<br>";
                    }

                    // check next move for match
                    $temp = $this->splitLine($move, $color, $isNew, $isRecommended, false, $level + 1);
                }
            }


            if ($line['color'] == "white" && $level == 1 && $isRecommended) {
                //print_r($temp);
                //print "<br><br>";
            }


            $parts = array_merge($parts, $temp);
        }

        return $parts;
    }

    // get the line until the criteria doesn't match anymore
    private function getLineUntil(array $moves, string $color = '', bool $isNew = false, bool $isRecommended = false, $level = 1): array
    {
        $line = [];

        // is this our move
        //$ourMove = ($color == "white" && $level % 2 == 1) || ($color == "black" && $level % 2 == 0);

        // check the line to see if it matches
        foreach ($moves as $move) {

            // is this our move
            //$ourMove = ($move['color'] == "white" && $level % 2 == 1) || ($move['color'] == "black" && $level % 2 == 0);
            $ourMove = isset($move['halfmove']) ? (($move['color'] == "white" && $move['halfmove'] % 2 == 1) || ($move['color'] == "black" && $move['halfmove'] % 2 == 0)) : $move['color'] == "white";

            //print "- level: " . $level . " / move: " . $move['move'] . " / ourMove: " . $ourMove . "<br>";
            if ($move['move'] == 'Nxa6') {
                //print "- level: " . $level . " / halfmove: " . $move['halfmove'] . "/ move: " . $move['move'] . " / " . $move['color'] . " / ourMove: " . $ourMove . "<br>";
            }

            // if this move matches the criteria
            if (!$ourMove || (($color != '' && $move['color'] == $color) || ($isNew && $move['new'] == 1) || ($isRecommended && $move['recommended'] == 1))) {
                // get the rest of the line
                $temp = $this->getLineUntil($move['moves'], $color, $isNew, $isRecommended, $level + 1);

                // add this move if its our move or there are child moves
                if ($ourMove || count($temp) > 0) {

                    //print "- adding..<br>";

                    // add to the lines
                    $line[] = [
                        'move' => $move['move'],
                        'moves' => $temp,
                        'multiple' => $move['multiple']
                    ];
                } else {

                    //print "Not added:<br>";
                    //print_r($temp);
                    //print "<br><br>";
                    //dd($temp);
                }
            } else {

                //print "- no match..<br>";
            }
        }

        return $line;
    }

    // analyse a game
    private function analyseGame($uci, $game): array
    {
        $moves = [];

        // get the game moves and initial FEN
        $gameMoves = $game->getUciMoves();
        $fen = $game->getFen();

        // create a new game
        $chess = new ChessJs($fen);
        // get the FEN
        $fen = $chess->fen();

        // start a new UCI game
        $uci->newGame();

        // get the game downloader
        $downloader = new GameDownloader();

        //
        // temporarily disable: 429 - too many requests..
        //

        //$eval = $downloader->getEvaluation($fen);
        $eval = null;

        if ($eval !== null) {
            $bestMoves = [];
            //for ($i = 0; $i < 3; $i++) {
            $pv = explode(" ", $eval["pvs"][0]["moves"]);
            $bestMoves[] = ["move" => $pv[0], "cp" => $eval["pvs"][0]["cp"], "line" => $pv];
            //}
        } else {
            // set the initial position and get the best moves from the engine
            $bestMoves = $uci->setPosition($fen);
        }

        // get the current best move
        $bestCp = $bestMoves[0]["cp"];
        // white to move
        $whiteToMove = true;

        // need to change this to user setting?
        $analyseForBlack = $game->getBlack() == "avweije";


        //print "Players: " . $game->getWhite() . " vs " . $game->getBlack() . "<br>";
        //print "Analysing for: " . ($analyseForBlack ? "Black" : "White") . "<br>";

        // get the intial win percentage
        $prevWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $bestCp)) - 1));
        $accuracy = [];
        $mistakes = [];

        // need to add this to settings?
        $includeInnacuracies = true;

        $halfMove = 1;
        $linePgn = "";
        $lineMoves = [];

        foreach ($gameMoves as $move) {
            // add the UCI move
            $moves[] = $move['uci'];
            // get the FEN before this move
            $fenBefore = $chess->fen();
            // remember the best moves for this move
            $bestMovesBefore = [...$bestMoves];

            // play the move
            $chess->move($move["san"]);

            // if the game is over, we can stop the analysis
            if ($chess->gameOver()) {
                break;
            }


            /*

            Stockfish returns CP based on the color:

            - White +.5 = 50
            - Black +.5 = 50

            Lichess evals returns CP for white:

            - White +.5 = 50
            - Black +.5 = -50

            We always want the CP for white. In case of stockfish we need to multiple with -1 for the black moves.

            */


            //
            // temporarily disable: 429 - too many requests..
            //

            $eval = null;
            //$eval = $downloader->getEvaluation($chess->fen());
            if ($eval !== null) {
                $bestMoves = [];
                //for ($i = 0; $i < 3; $i++) {
                $pv = explode(" ", $eval["pvs"][0]["moves"]);
                $bestMoves[] = ["move" => $pv[0], "cp" => $eval["pvs"][0]["cp"], "line" => $pv];
                //}
            } else {
                // set the position and get the best moves from the engine
                $bestMoves = $uci->setPosition("", $moves);

                // if these evals are for a black move
                if ($whiteToMove) {
                    // uno reverse the cp value
                    for ($i = 0; $i < count($bestMoves); $i++) {
                        $bestMoves[$i]["cp"] = $bestMoves[$i]["cp"] * -1;
                    }
                }
            }

            $whiteToMove = !$whiteToMove;

            // get the current best move centipawn value
            $moveCp = $bestMoves[0]["cp"];

            // if we need to check the CP loss
            if ((!$whiteToMove && !$analyseForBlack) || ($whiteToMove && $analyseForBlack)) {

                // not using the centipawn for now, but keep it in..
                if ($analyseForBlack) {
                    $cpLoss = $bestCp < $moveCp ? max(0, abs($bestCp - $moveCp)) : 0;
                } else {
                    $cpLoss = $bestCp > $moveCp ? max(0, abs($bestCp - $moveCp)) : 0;
                }

                // get the current win percentage
                $winPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $moveCp)) - 1));
                if ($analyseForBlack) {
                    $winPct = 100 - $winPct;
                }

                // calculate the percentage loss for this move
                $pctLoss = $prevWinPct == -1 ? 0 : max(0, ($prevWinPct - $winPct) / 100);

                // calculate the accuracy for this move (not used for now, but keep it in)
                $acc = 103.1668 * exp(-0.04354 * ($prevWinPct - min($prevWinPct, $winPct))) - 3.1669;
                $accuracy[] = $acc;

                // set the mistake array
                $mistake = ["move" => $move["san"], "type" => "", "bestmoves" => [], "fen" => $fenBefore, "line" => ["pgn" => $linePgn, "moves" => $lineMoves]];

                // check the move quality
                if ($pctLoss == 0) {
                    // best move
                } else if ($pctLoss < .02) {
                    // excellent move
                } else if ($pctLoss < .05) {
                    // good move
                } else if ($pctLoss < .1) {
                    // inaccuracy
                    if ($includeInnacuracies) {
                        $mistake["type"] = "inaccuracy";
                    }
                } else if ($pctLoss < .2) {
                    // mistake
                    $mistake["type"] = "mistake";
                } else {
                    // blunder
                    $mistake["type"] = "blunder";
                }

                // if we have a mistake
                if ($mistake["type"] !== "") {
                    // undo the current move so we can test the best moves
                    $chess->undo();

                    foreach ($bestMovesBefore as $bm) {
                        // get the move details
                        $fromSquare = substr($bm["move"], 0, 2);
                        $toSquare = substr($bm["move"], 2, 2);
                        $promotion = strlen($bm["move"] == 5) ? substr($bm["move"], 5) : "";
                        // make the move
                        $ret = $chess->move(["from" => $fromSquare, "to" => $toSquare, "promotion" => $promotion]);
                        if ($ret == null) {

                            // invalid move.. ? do something.. ?

                        } else {
                            // get the last move
                            $history = $chess->history(['verbose' => true]);
                            $last = array_pop($history);
                            // undo the last move
                            $chess->undo();

                            /*

                            For 2nd and 3rd best moves:
                            
                            - we need to check if the move itself is not a mistake... 
                            - if it is, we would be suggesting a slightly worse mistake instead of the mistake made
                            - check using win pct??

                            */

                            // if this is the move we made (2nd or 3rd best)
                            if ($move["san"] == $last["san"]) {
                                // we have all the better moves, exit foreach
                                break;
                            }

                            // add the move
                            $add = true;

                            // if this is not the 1st best move
                            if (count($mistake["bestmoves"]) > 0) {
                                // calculate the win percentage for this move
                                $moveWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $bm["cp"])) - 1));
                                if ($analyseForBlack) {
                                    $moveWinPct = 100 - $moveWinPct;
                                }

                                // calculate the move percentage loss
                                $movePctLoss = $prevWinPct == -1 ? 0 : max(0, ($prevWinPct - $moveWinPct) / 100);
                                // add if not an inaccuracy or worse
                                $add = $movePctLoss < .1;
                            }

                            // add to the bestmoves
                            if ($add) {
                                $mistake["bestmoves"][] = ["move" => $bm["move"], "san" => $last["san"], "cp" => $bm["cp"]];
                            }
                        }
                    }

                    // redo the current move
                    $chess->move($move["san"]);


                    /*

                    If no best moves known, do we need to add?
                    Not sure how this could happen, but as safety measure perhaps.. ?

                    */


                    // add the mistake
                    $mistakes[] = $mistake;
                }
            } else {
                // calculate the win percentage for the previous move (for next loop)
                $prevWinPct = (50 + 50 * (2 / (1 + exp(-0.00368208 * $moveCp)) - 1));
                if ($analyseForBlack) {
                    $prevWinPct = 100 - $prevWinPct;
                }
            }

            $bestCp = $moveCp;

            $linePgn .= ($linePgn != "" ? " " : "") . ($halfMove % 2 == 1 ? ceil($halfMove / 2) . ". " : "") . $move['san'];
            $lineMoves[] = $move['san'];

            $halfMove++;

            // max 15 moves?
            if ($halfMove >= 30) {
                break;
            }
        }

        return $mistakes;
    }
}
