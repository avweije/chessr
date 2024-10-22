<?php

namespace App\Library\GameDownloader;

use DateInterval;
use DateTime;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Contracts\HttpClient\ResponseInterface;

class LichessInterface implements ChessSiteInterface
{
    private $client;
    private $username = "anonymouse123";
    private $createdAt;

    private $types = ["bullet", "blitz", "rapid", "classical"];
    private $archives = [];
    private $savedArchives = [];
    private $newArchives = [];

    // if we receive a 429, wait 1 minute before performing next request..
    private $retryCount = 0;
    private $retryMax = 2;
    private $requestCount = 0;
    private $inTimeout = false;
    private $timeoutEnd = 0;

    public function __construct()
    {
        $this->client = HttpClient::create();
    }

    public function setUsername($username): void
    {
        $this->username = $username;
    }

    public function setSavedArchives(array $archives): void
    {
        $this->savedArchives = $archives;
    }

    public function getNewArchives(): array
    {
        return $this->newArchives;
    }

    public function getArchives(): array
    {
        // set the url
        $url = "https://lichess.org/api/user/" . $this->username;

        // get the user public data
        $response = $this->request('GET', $url);

        //$contentType = $response->getHeaders()['content-type'][0];
        //$content = $response->getContent();

        // the number of games per type
        $types = ["bullet" => 0, "blitz" => 0, "rapid" => 0, "classical" => 0];

        $archives = [];

        $this->newArchives = [];

        // if response is ok
        if ($response !== null && $response->getStatusCode() == 200) {
            // get the data
            $data = $response->toArray();

            //dd($data);

            // store the createdAt
            $this->createdAt = $data["createdAt"];

            // check the datetime
            $now = new DateTime();

            $createdAt = new DateTime();
            $createdAt->setTimestamp($this->createdAt / 1000);

            $secs =  $now->getTimestamp() - $this->createdAt / 1000;
            $mins = floor($secs / 60);

            //dd($now, $createdAt, $this->createdAt, $now->getTimestamp());


            // get the total games per type
            foreach ($types as $type => $total) {
                $types[$type] = $data["perfs"][$type]["games"];
            }

            //dd($types);

            $typesStr = join(",", array_keys($types));

            // get the 1st and last game per type
            //foreach ($types as $type => $totals) {

            //if ($totals == 0) {
            //    continue;
            //}

            //print "Get 1st and last overall.\n";

            $firstLast = $this->getFirstAndLast($typesStr);

            // temp - testing..
            //$archives[$type] = $temp;

            if ($firstLast !== false) {
                // get the current year
                $now = new DateTime();
                $currentYear = intval($now->format('Y'));

                // find the months with games for each year
                for ($year = $firstLast["since"]["year"]; $year <= $firstLast["until"]["year"]; $year++) {

                    /*

                    - if year exists in savedArchives, add the months using first/last from savedArchives
                    - if not, try to fetch it from API

                    */

                    //print "-- year: $year\n";

                    if (isset($this->savedArchives[$year])) {

                        //print "-- savedArchives found for $year\n";

                        // if no games for this year, continue to next year
                        if ($this->savedArchives[$year]["first"] == "" && $this->savedArchives[$year]["last"] == "") {
                            continue;
                        }

                        $ystart = new DateTime();
                        $ystart->setTimestamp($this->savedArchives[$year]["first"] / 1000);
                        $mstart = intval($ystart->format('m'));

                        $yend = new DateTime();
                        $yend->setTimestamp($this->savedArchives[$year]["last"] / 1000);
                        $mend = intval($yend->format('m'));

                        //dd($year, $ystart, $yend, $mstart, $mend);
                    } else {

                        // check 1st last for every year? to exclude months without games.. ?
                        //if ($year != $firstLast["since"]["year"] && $year != $firstLast["until"]["year"]) {

                        if ($year == $firstLast["since"]["year"]) {
                            $ystart = $firstLast["since"]["timestamp"];
                        } else {
                            $ystart = new DateTime();
                            $ystart->setDate($year, 1, 1);
                            $ystart->setTime(0, 0, 0);
                            $ystart = $ystart->getTimestamp() * 1000;
                        }

                        if ($year == $firstLast["until"]["year"]) {
                            $yend = $firstLast["until"]["timestamp"];
                        } else {
                            $yend = new DateTime();
                            $yend->setDate($year, 12, 31);
                            $yend->setTime(23, 59, 59);
                            $yend = $yend->getTimestamp() * 1000;
                        }

                        //print "Get 1st and last for " . $year . ".\n";

                        $temp = $this->getFirstAndLast($typesStr, $ystart, $yend);

                        if ($temp !==  false) {

                            //print "-- firstAndLast found\n";

                            $mstart = $temp["since"]["month"] > 0 ? $temp["since"]["month"] : 1;
                            $mend = $temp["until"]["month"] > 0 ? $temp["until"]["month"] : 12;

                            // store in the database (unless it's the current calendar year)
                            if ($year != $currentYear) {
                                $this->newArchives[$year] = [
                                    "first" => $temp["since"]["timestamp"],
                                    "last" => $temp["until"]["timestamp"]
                                ];
                            }

                            //print "-- newArchive added\n";

                            // if no games for this year, continue to next year
                            if ($temp["since"]["timestamp"] == "" && $temp["until"]["timestamp"] == "") {
                                continue;
                            }
                        } else {
                            // no games for this year
                            if (!$this->inTimeout) {
                                continue;
                            }

                            $mstart = 1;
                            $mend = 12;
                        }
                    }

                    if (!isset($archives[$year])) {
                        $archives[$year] = [];
                    }

                    for ($month = $mstart; $month <= $mend; $month++) {
                        if (!in_array($month, $archives[$year])) {
                            $archives[$year][] = str_pad($month, 2, "0", STR_PAD_LEFT);
                        }
                    }

                    sort($archives[$year]);
                }
            }
        } else {
            print "Error response: " . $response->getStatusCode() . "\n";
            //dd($response);
        }

        return $archives;
    }

    public function getGames(int $year, int $month, array $lastIds = []): array
    {

        $games = [];

        $since = new DateTime();
        $since->setDate($year, $month, 1);
        $since->setTime(0, 0, 0);

        $until = new DateTime();
        $until->setDate($year, $month + 1, 1);
        $until->sub(DateInterval::createFromDateString('1 day'));
        $until->setTime(23, 59, 59);

        foreach ($this->types as $type) {

            // set the url
            $url = "https://lichess.org/api/games/user/" . $this->username;

            $url .= "?since=" . ($since->getTimestamp() * 1000);
            $url .= "&until=" . ($until->getTimestamp() * 1000);
            $url .= "&max=1";
            $url .= "&perfType=" . $type;

            // get the user public data
            $response = $this->request('GET', $url, ['headers' => ['Accept' => 'application/x-ndjson']]);

            // if response is ok
            if ($response !== null && $response->getStatusCode() == 200 && $response->getContent(false) !== "") {
                // this type exists in this month
                $games[$type] = ["total" => -1, "processed" => 0];
            }
        }

        return $games;
    }

    public function downloadGames(int $year, int $month, string $type, string $lastId = ""): array
    {

        $games = [];

        $since = new DateTime();
        $since->setDate($year, $month, 1);
        $since->setTime(0, 0, 0);

        $until = new DateTime();
        $until->setDate($year, $month + 1, 1);
        $until->sub(DateInterval::createFromDateString('1 day'));
        $until->setTime(23, 59, 59);

        // set the url
        $url = "https://lichess.org/api/games/user/" . $this->username;

        $url .= "?since=" . ($lastId == "" ? ($since->getTimestamp() * 1000) : intval($lastId) + 1);
        $url .= "&until=" . ($until->getTimestamp() * 1000);
        $url .= "&max=4";
        $url .= "&perfType=" . $type;
        $url .= "&pgnInJson=true&sort=dateAsc";

        // get the user public data
        $response = $this->request('GET', $url, ['headers' => ['Accept' => 'application/x-ndjson']]);

        //dd($url, $response->getContent(false));

        // if response is ok
        if ($response !== null && $response->getStatusCode() == 200 && $response->getContent(false) !== "") {

            $resp = explode("\n", $response->getContent(false));

            for ($i = 0; $i < count($resp); $i++) {
                if ($resp[$i] != "") {
                    $json = json_decode($resp[$i], true);
                    if ($lastId == "" || $lastId != $json["createdAt"]) {
                        $json["uuid"] = $json["createdAt"];
                        $games[] = $json;
                    }
                }
            }
        }

        return $games;
    }

    private function getFirstAndLast(string $type, int $since = 0, int $until = 0): mixed
    {
        // set the url
        $url = "https://lichess.org/api/games/user/" . $this->username;

        $url .= "?since=" . ($since > 0 ? $since : $this->createdAt);
        if ($until > 0) {
            $url .= "&until=" . $until;
        }
        $url .= "&max=1";
        $url .= "&perfType=" . $type;

        $first = 0;
        $last = 0;

        //print "-- getFirstAndLast: $url\n";

        //print "-- getFirstAndLast fetching\n";

        // get the 1st game of this type
        $response = $this->request('GET', $url . "&sort=dateAsc", ['headers' => ['Accept' => 'application/x-ndjson']]);

        // if response is ok
        if ($response !== null && $response->getStatusCode() == 200) {
            // if we have an empty response (= no games)
            if ($response->getContent(false) == "") {
                //print "-- first-empty, no games found for this year\n";

                return [
                    "since" => ["timestamp" => "", "datetime" => null, "year" => 0, "month" => 0],
                    "until" => ["timestamp" => "", "datetime" => null, "year" => 0, "month" => 0]
                ];;
            }

            // get the data
            $first = $response->toArray()["createdAt"];

            //print "-- first found\n";
        }

        // get the user public data
        $response = $this->request('GET', $url . "&sort=dateDesc", ['headers' => ['Accept' => 'application/x-ndjson']]);

        // if response is ok
        if ($response !== null && $response->getStatusCode() == 200) {
            // if we have an empty response (= no games)
            if ($response->getContent(false) == "") {
                //print "-- last-empty, first wasnt, so there should be games?? 429..?\n";

                return false;
            }

            // get the data
            $last = $response->toArray()["createdAt"];

            //print "-- last found\n";
        }

        //
        if ($first > 0 && $last > 0) {

            $firstLast = [
                "since" => ["timestamp" => $first, "datetime" => null, "year" => 0, "month" => 0],
                "until" => ["timestamp" => $last, "datetime" => null, "year" => 0, "month" => 0]
            ];

            $firstLast["since"]["datetime"] = new DateTime();
            $firstLast["since"]["datetime"]->setTimestamp($first / 1000);

            $firstLast["since"]["year"] = intval($firstLast["since"]["datetime"]->format('Y'));
            $firstLast["since"]["month"] = intval($firstLast["since"]["datetime"]->format('m'));

            $firstLast["until"]["datetime"] = new DateTime();
            $firstLast["until"]["datetime"]->setTimestamp($last / 1000);

            $firstLast["until"]["year"] = intval($firstLast["until"]["datetime"]->format('Y'));
            $firstLast["until"]["month"] = intval($firstLast["until"]["datetime"]->format('m'));

            return $firstLast;
        }

        return false;
    }

    //
    private function request(string $method, string $url, array $options = [], $delay = 250000): ?ResponseInterface
    {

        // if in timeout
        if ($this->inTimeout) {
            // check timestamp..
            $now = new DateTime();
            if ($now->getTimestamp() < $this->timeoutEnd) {

                //print "In timeout, waiting.\n";

                // add 2 mins to the time limit
                set_time_limit(120);

                // wait for 1 minute
                sleep(60);

                //print "Currently in timeout, cannot perform request.\n";

                //return null;
            } else {

                //print "No longer in timeout.\n";

                $this->inTimeout = false;
            }
        }

        $this->requestCount++;

        // try a 2nd time if we get a timeout
        for ($i = 0; $i < $this->retryMax + 1; $i++) {

            $response = $this->client->request($method, $url, $options);

            //print "Response: " . $response->getStatusCode() . "\n";

            switch ($response->getStatusCode()) {
                case 200:
                    break 2;
                case 429:
                    // remember the timeout end time
                    $now = new DateTime();
                    $this->timeoutEnd = $now->getTimestamp() + 60;
                    $this->inTimeout = true;

                    // if we've retried enough times
                    if ($this->retryCount >= $this->retryMax) {
                        // stop retrying
                        break 2;
                    } else {
                        //print "-- received 429, retrying after 1 minute\n";

                        // add 2 mins to the time limit
                        set_time_limit(120);

                        // wait for 1 minute
                        sleep(60);

                        $this->retryCount++;
                    }

                    break;
            }
        }

        if ($response->getStatusCode() == 429) {

            //print "Received 429, in timeout (" . $this->requestCount . " requests were made -- retried " . $this->retryCount . " times).\n";
            //print "Url: $url\n";

            //dd($response, $response->getContent(false));

            return $response;
        }

        // wait for half a second
        //usleep($delay);

        return $response;
    }
}
