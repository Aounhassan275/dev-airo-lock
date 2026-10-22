<?php

namespace App\Filament\Admin\Widgets;

use App\Support\GitInfo;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DeploymentInfoWidget extends BaseWidget
{
    // System-info footer — render below the business KPIs and charts.
    protected static ?int $sort = 10;

    protected function getStats(): array
    {
        $info = $this->deployInfo();

        if ($info === null) {
            return [
                Stat::make('Deployment', 'Not recorded yet')
                    ->description('Will populate on the next auto-deploy')
                    ->descriptionIcon('heroicon-m-information-circle')
                    ->color('gray'),
            ];
        }

        $deployedAt = ! empty($info['deployed_at']) ? Carbon::parse($info['deployed_at']) : null;
        $tz = config('app.timezone', 'UTC');

        return [
            Stat::make('Deployed Version', $info['short'] ?? '—')
                ->description(Str::limit($info['message'] ?? '', 64) ?: 'No commit message')
                ->descriptionIcon('heroicon-m-code-bracket')
                ->color('success'),

            Stat::make('Deployed', $deployedAt?->diffForHumans() ?? '—')
                ->description($deployedAt?->timezone($tz)->format('M j, Y · H:i').' '.$tz)
                ->descriptionIcon('heroicon-m-clock')
                ->color('primary'),

            Stat::make('Branch', $info['branch'] ?? '—')
                ->description(trim(($info['author'] ?? '').' · '.($info['commit'] ?? ''), ' ·') ?: '—')
                ->descriptionIcon('heroicon-m-arrow-path')
                ->color('gray'),
        ];
    }

    protected function deployInfo(): ?array
    {
        // Primary source: the stamp written by `php artisan deploy:stamp`
        // during deploy (full fidelity, incl. commit message + author).
        if (Storage::disk('local')->exists('deploy.json')) {
            $data = json_decode((string) Storage::disk('local')->get('deploy.json'), true);
            if (is_array($data)) {
                return $data;
            }
        }

        // Fallback: derive from the deployed git checkout so the panel shows
        // the live revision even before the first stamp runs.
        return GitInfo::current();
    }
}
