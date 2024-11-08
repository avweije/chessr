<?php

namespace App\Library\GameDownloader;

use DateTime;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Contracts\HttpClient\ResponseInterface;

class ChessDotComInterface implements ChessSiteInterface
{
    private $client;
    private $username = "";
    private $joined = null;
    private $archives = [];
    private $games = [];

    // if we receive a 429, wait 1 minute before performing next request..
    private $requestCount = 0;
    private $inTimeout = false;
    private $timeoutEnd = 0;

    private $debugInfo = [];

    public function __construct()
    {
        $this->client = HttpClient::create();
    }

    public function setUsername($username): void
    {
        $this->username = $username;
    }

    public function getCreatedAt(): int
    {
        // if we need to get the created at from the profile
        if ($this->joined == null) {
            // set the url
            $url = "https://api.chess.com/pub/player/" . $this->username;
            // get the profile
            $response = $this->request('GET', $url);
            if ($response !== null && $response->getStatusCode() == 200) {
                $this->joined = intval($response->toArray()['joined']);
            }
        }

        return $this->joined;
    }

    public function getArchives(): array
    {
        //https://api.chess.com/pub/player/avweije/games/archives

        // reset the archives
        $this->archives = [];

        // set the url
        $url = "https://api.chess.com/pub/player/" . $this->username . "/games/archives";

        // get the archives
        $response = $this->request('GET', $url);

        //$contentType = $response->getHeaders()['content-type'][0];
        //$content = $response->getContent();

        // if response is ok
        if ($response !== null && $response->getStatusCode() == 200) {
            // get the archives
            $data = $response->toArray()['archives'];
            // get the years and months
            foreach ($data as $archive) {
                $parts = explode("/", $archive);
                $year = $parts[count($parts) - 2];
                $month = $parts[count($parts) - 1];

                if (!isset($this->archives[$year])) {
                    $this->archives[$year] = [];
                }

                $this->archives[$year][] = $month;
            }
        }

        return $this->archives;
    }

    public function getGames(int $year, int $month, array $lastIds = []): array
    {
        // download the archives first, if needed
        if (count($this->archives) == 0) {
            $this->getArchives();
        }

        // pad the month
        $month = str_pad($month, 2, '0', STR_PAD_LEFT);
        // set the url
        $url = "https://api.chess.com/pub/player/" . $this->username . "/games/" . $year . "/" . $month;

        // get the games
        $response = $this->client->request('GET', $url);

        //$statusCode = $response->getStatusCode();
        //$contentType = $response->getHeaders()['content-type'][0];
        //$content = $response->getContent();

        $this->games = [];

        // if response ok
        if ($response->getStatusCode() == 200) {
            $data = $response->toArray()['games'];

            $lastIdFound = [];

            foreach ($data as $game) {
                if (!isset($this->games[$game["time_class"]])) {
                    $this->games[$game["time_class"]] = ["total" => 0, "processed" => 0];
                }

                if (!isset($lastIdFound[$game["time_class"]])) {
                    $lastIdFound[$game["time_class"]] = false;
                }

                $this->games[$game["time_class"]]["total"]++;

                // if we haven't found the last processed UUID yet
                if (isset($lastIds[$game["time_class"]]) && $lastIds[$game["time_class"]] != "" && !$lastIdFound[$game["time_class"]]) {

                    $this->games[$game["time_class"]]["processed"]++;
                    $lastIdFound[$game["time_class"]] = $game["uuid"] == $lastIds[$game["time_class"]];
                }
            }
        }

        return $this->games;
    }

    //
    public function downloadGames($year, $month, $type, $lastId = "", $max = 4): array
    {
        // pad the month
        $month = str_pad($month, 2, '0', STR_PAD_LEFT);
        // set the url
        $url = "https://api.chess.com/pub/player/" . $this->username . "/games/" . $year . "/" . $month;

        // get the games
        $response = $this->request('GET', $url);

        //$statusCode = $response->getStatusCode();
        //$contentType = $response->getHeaders()['content-type'][0];
        //$content = $response->getContent();

        // if response ok
        if ($response !== null && $response->getStatusCode() == 200) {
            $games = $response->toArray()['games'];
            $gamesOfType = [];

            // only get the games newer than the last id
            $lastIdFound = $lastId == "";

            // loop through the games
            foreach ($games as $game) {
                // if this is the correct time format
                if ($game["time_class"] == $type) {
                    // if we haven't found the last id yet
                    if (!$lastIdFound) {
                        $lastIdFound = $game["uuid"] == $lastId;

                        continue;
                    }

                    // don't need this anymore ??
                    if (!isset($this->games[$year])) {
                        $this->games[$year] = [];
                    }

                    if (!isset($this->games[$year][$month])) {
                        $this->games[$year][$month] = [];
                    }

                    $this->games[$year][$month][] = $game;

                    // add the game
                    $gamesOfType[] = $game;

                    if (count($gamesOfType) >= $max) {
                        break;
                    }
                }
            }

            return $gamesOfType;
        }

        return [];
    }


    //
    private function request(string $method, string $url, array $options = []): ?ResponseInterface
    {

        // if in timeout
        if ($this->inTimeout) {
            // check timestamp..
            $now = new DateTime();
            if ($now->getTimestamp() < $this->timeoutEnd) {

                print "Currently in timeout, cannot perform request.\n";

                return null;
            }

            print "No longer in timeout.\n";

            $this->inTimeout = false;
        }

        $response = $this->client->request($method, $url, $options);

        $this->requestCount++;

        if ($response->getStatusCode() == 429) {

            $now = new DateTime();
            $this->timeoutEnd = $now->getTimestamp() + 60;
            $this->inTimeout = true;

            print "Received 429, in timeout (" . $this->requestCount . " requests were made).\n";

            return $response;
        }

        // wait for half a second
        //usleep(500000);

        return $response;
    }

    public function getDebugInfo(): array
    {
        return $this->debugInfo;
    }
}
