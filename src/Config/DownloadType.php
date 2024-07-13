<?php

namespace App\Config;

enum DownloadType: string
{
    case Bullet = 'Bullet';
    case Blitz = 'Blitz';
    case Rapid = 'Rapid';
    case Daily = 'Daily';
}
