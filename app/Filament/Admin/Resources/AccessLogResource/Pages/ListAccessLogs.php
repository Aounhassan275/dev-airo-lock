<?php

namespace App\Filament\Admin\Resources\AccessLogResource\Pages;

use App\Filament\Admin\Resources\AccessLogResource;
use Filament\Resources\Pages\ListRecords;

class ListAccessLogs extends ListRecords
{
    protected static string $resource = AccessLogResource::class;
}
