<?php

/**
 * Returns the importmap for this application.
 *
 * - "path" is a path inside the asset mapper system. Use the
 *     "debug:asset-map" command to see the full list of paths.
 *
 * - "entrypoint" (JavaScript only) set to true for any module that will
 *     be used as an "entrypoint" (and passed to the importmap() Twig function).
 *
 * The "importmap:require" command can be used to add new entries to this file.
 */
return [
    'app' => [
        'path' => './assets/app.js',
        'entrypoint' => true,
    ],
    'utils' => [
        'path' => './assets/js/utils.js',
        'entrypoint' => true,
    ],
    'logger' => [
        'path' => './assets/js/logger.js',
        'entrypoint' => true,
    ],
    'uci' => [
        'path' => './assets/js/uci.js',
        'entrypoint' => true,
    ],
    'EngineHelper' => [
        'path' => './assets/js/engine-helper.js',
        'entrypoint' => true,
    ],
    'chess' => [
        'path' => './assets/js/chess.js',
        'entrypoint' => true,
    ],
    'pgn-field' => [
        'path' => './assets/js/pgn-field.js',
        'entrypoint' => true,
    ],
    'chessboard' => [
        'path' => './assets/js/chessboard.js',
        'entrypoint' => true,
    ],
    'focus-board' => [
        'path' => './assets/js/practice/focus-board.js',
        'entrypoint' => true,
    ],
    'focus-group' => [
        'path' => './assets/js/practice/focus-group.js',
        'entrypoint' => true,
    ],
    'focus-manager' => [
        'path' => './assets/js/practice/focus-manager.js',
        'entrypoint' => true,
    ],
    'ThickerArrows' => [
        'path' => './assets/js/ThickerArrows.js',
        'entrypoint' => true,
    ],
    'notyf' => [
        'path' => './assets/vendor/notyf/notyf.min.js',
        'entrypoint' => true,
    ],
    'balloons' => [
        'path' => './assets/vendor/balloons/balloons.js',
        'entrypoint' => true,
    ],
];
