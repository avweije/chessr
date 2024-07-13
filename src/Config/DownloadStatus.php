<?php

namespace App\Config;

enum DownloadStatus: string
{
    case Downloading = 'Downloading';
    case Partial = 'Partial';
    case Completed = 'Completed';
}
