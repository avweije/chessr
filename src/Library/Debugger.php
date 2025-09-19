<?php
namespace App\Library;

class Debugger
{
    private static array $collected = [];

    public static function collect(string $label = '', mixed $var): void
    {
        self::$collected[] = ['label' => $label, 'value' => $var];
    }

    public static function report(): array
    {
        //foreach (self::$collected as $item) {
          //  dump($item['label'], $item['value']);
        //}
        //dd('End of report');
        return self::$collected;
    }
}