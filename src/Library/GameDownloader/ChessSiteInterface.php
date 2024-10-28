<?php

namespace App\Library\GameDownloader;

interface ChessSiteInterface
{
    // store username to be used for getting archives and games
    function setUsername(string $username): void;

    // get the created at timestamp for the user
    function getCreatedAt(): int;

    // chess: get archives
    // lichess: get user creation timestamp, get years & months between creation and now
    // returns: [<year>: [<month>,<month>,<etc>]]
    function getArchives(): array;

    // get game types + totals for year, month
    // returns: [<type>: <total>]
    function getGames(int $year, int $month, array $lastIds = []): array;

    // download actual games
    // returns: [??]
    function downloadGames(int $year, int $month, string $type, string $lastId, int $max): array;

    /**
     * -
     * - no totals for lichess ?
     * - still add for chess.com so we can show estimated duration of analysing, etc.
     * -
     */
}
