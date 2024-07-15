<?php

namespace App\Library;

use AmyBoyd\PgnParser\Game;
use Onspli\Chess\FEN;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * GameDownloader - Download games from chess.com and lichess.com.
 */
class GameDownloader
{
    private $client;
    private $settings = ['chess.com' => ['user' => 'avweije'], 'lichess' => ['user' => '']];

    private $archives = [];
    private $archivesYearsMonths = [];
    public $games = [];

    public function __construct()
    {
        // create the HTTP client component
        $this->client = HttpClient::create();
    }

    // download archives from chess.com
    public function downloadArchives(): array
    {

        //https://api.chess.com/pub/player/avweije/games/archives

        // reset the archives
        $this->archives = [];
        $this->archivesYearsMonths = [];

        // set the url
        $url = "https://api.chess.com/pub/player/" . $this->settings['chess.com']['user'] . "/games/archives";

        // get the archives
        $response = $this->client->request('GET', $url);

        //$contentType = $response->getHeaders()['content-type'][0];
        //$content = $response->getContent();

        // if response is ok
        if ($response->getStatusCode() == 200) {
            // store the archives
            $this->archives = $response->toArray()['archives'];
            // get the years and months
            foreach ($this->archives as $archive) {
                $parts = explode("/", $archive);
                $year = $parts[count($parts) - 2];
                $month = $parts[count($parts) - 1];

                if (!isset($this->archivesYearsMonths[$year])) {
                    $this->archivesYearsMonths[$year] = [];
                }

                $this->archivesYearsMonths[$year][] = $month;
            }
        }

        return $this->archives;
    }

    // download the games from chess.com
    public function downloadGames($year, $month): array
    {
        // download the archives first, if needed
        if (count($this->archives) == 0) {
            $this->downloadArchives();
        }

        // pad the month
        $month = str_pad($month, 2, '0', STR_PAD_LEFT);
        // set the url
        $url = "https://api.chess.com/pub/player/" . $this->settings['chess.com']['user'] . "/games/" . $year . "/" . $month;

        // get the games
        $response = $this->client->request('GET', $url);

        //$statusCode = $response->getStatusCode();
        //$contentType = $response->getHeaders()['content-type'][0];
        //$content = $response->getContent();

        // if response ok
        if ($response->getStatusCode() == 200) {
            $games = $response->toArray()['games'];

            foreach ($games as $game) {
                if (!isset($this->games[$year])) {
                    $this->games[$year] = [];
                }

                if (!isset($this->games[$year][$month])) {
                    $this->games[$year][$month] = [];
                }

                $this->games[$year][$month][] = $game;
            }

            return $games;
        }

        return [];
    }

    // get an evaluation from lichess
    public function getEvaluation($fen): ?array
    {

        //https://lichess.org/api/cloud-eval

        // set the url
        $url = "https://lichess.org/api/cloud-eval?fen=" . $fen . "&multiPv=3";
        //$url = "https://lichess.org/api/cloud-eval?fen=" . $fen;

        // get the archives
        $response = $this->client->request('GET', $url);

        //$contentType = $response->getHeaders()['content-type'][0];
        //$content = $response->getContent();

        $eval = null;

        // if response is ok
        switch ($response->getStatusCode()) {
            case 200:
                // get the evaluation
                $eval = $response->toArray();
                break;
            case 404:
                break;
            default:
                // 429: too many requests ?

                /*

                Lichess suggests to take a 1 min break after receiving a 429.

                We need to keep this into account.

                Maybe we need to download the eval database after all ??

                - when analysing a lot, we will keep running into this.

                - we can try keeping a cache of evals per fen?

                */
                break;
        }

        return $eval;
    }

    // return the downloaded archives
    public function getArchives(): array
    {
        return $this->archives;
    }

    // return the archive years
    public function getArchiveYears(): array
    {
        return array_keys($this->archivesYearsMonths);
    }

    // return the archive months for a certain year
    public function getArchiveMonths($year): array
    {
        return isset($this->archivesYearsMonths[$year]) ? $this->archivesYearsMonths[$year] : [];
    }

    // return the archive months per years
    public function getArchiveYearsMonths(): array
    {
        return $this->archivesYearsMonths;
    }

    // return the distinct game types in our downloaded games
    public function getTypes(): array
    {
        $types = [];
        foreach ($this->games as $year => $months) {
            foreach ($months as $month => $game) {
                if (isset($game["time_class"]) && !in_array($game["time_class"], $types)) {
                    $types[] = $game["time_class"];
                }
            }
        }

        return $types;
    }

    /**
     * getTotals
     * 
     * Returns the total number of games per game type.
     * 
     * ["all" => 30, "blitz" => 12, "rapid" => 4, "daily" => 4, "bullet" => 10]
     *
     * @return array
     */
    public function getTotals(): array
    {
        $totals = ["all" => 0];
        foreach ($this->games as $year => $months) {
            foreach ($months as $month => $games) {
                foreach ($games as $game) {
                    if (isset($game["time_class"])) {
                        if (!isset($totals[$game["time_class"]])) {
                            $totals[$game["time_class"]] = 0;
                        }

                        $totals[$game["time_class"]]++;
                    }

                    $totals["all"]++;
                }
            }
        }

        return $totals;
    }


    /**
     * getGames
     * 
     * The months parameter can be the following:
     * - 'all' (default): All the years and months that are in the archives. If no archives, returns an empty array.
     * - '2024': All the months for the year 2024, based on the archives. If no archives, returns an empty array.
     * - ['2024' => ['1', '2', '3'], '2023' => ['4', '6', '8']]: The months 1, 2 & 3 for the year 2024 and 4, 6 & 8 for the year 2023.
     *
     * @param  mixed $type
     * @param  mixed $months
     * @return array
     */
    public function getGames($filterType = "all", $filterMonths = "all"): array
    {
        // the years
        //$yearsArray = is_array($filterMonths) ? array_keys($filterMonths) : ($filterMonths == "all" ? [] : [$filterMonths]);
        $yearsArray = is_array($filterMonths) ? array_keys($filterMonths) : ($filterMonths == "all" ? $this->getArchiveYears() : [$filterMonths]);

        // the filtered games
        $games = [];

        // loop through the years
        foreach ($yearsArray as $year) {
            if (isset($this->games[$year])) {
                // get the months for this year
                $monthsArray = is_array($filterMonths) && isset($filterMonths[$year]) ? $filterMonths[$year] : $this->getArchiveMonths($year);
                // loop through the months
                foreach ($monthsArray as $month) {
                    // pad the month
                    $month = str_pad($month, 2, '0', STR_PAD_LEFT);
                    // if we have any games
                    if (isset($this->games[$year][$month])) {
                        foreach ($this->games[$year][$month] as $game) {
                            // if the type matches
                            if ($filterType == "all" || $filterType == $game['time_class']) {
                                // add the game
                                $games[] = $game;
                            }
                        }
                    }
                }
            }
        }

        return $games;
    }
}
