<?php

namespace App\Filament\Admin\Widgets;

use App\Models\AccessLog;
use App\Models\AccessRule;
use App\Models\Lock;
use App\Models\User;
use App\Support\Metrics;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StatsOverview extends BaseWidget
{
    protected static ?int $sort = 0;

    protected function getColumns(): int
    {
        return 4;
    }

    protected function getStats(): array
    {
        $installs = Metrics::dailySeries(User::query(), 14);
        $newThisWeek = array_sum(array_slice($installs['counts'], -7));

        $locksTrend = Metrics::dailySeries(Lock::query(), 14);
        $activeLocks = Lock::where('status', true)->count();

        $rulesTrend = Metrics::dailySeries(AccessRule::query(), 14);
        $rulesEnabled = AccessRule::where('enabled', true)->count();

        $blocked = Metrics::dailySeries(AccessLog::query()->where('granted', false), 14);
        $checks7 = AccessLog::where('created_at', '>=', now()->subDays(7))->count();
        $blocked7 = array_sum(array_slice($blocked['counts'], -7));
        $blockRate = $checks7 > 0 ? round($blocked7 / $checks7 * 100) : 0;

        return [
            Stat::make('Active Merchants', number_format(User::count()))
                ->description($newThisWeek.' new this week')
                ->descriptionIcon('heroicon-m-arrow-trending-up')
                ->chart($installs['counts'])
                ->color('success'),

            Stat::make('Total Locks', number_format(Lock::count()))
                ->description($activeLocks.' currently active')
                ->descriptionIcon('heroicon-m-lock-closed')
                ->chart($locksTrend['counts'])
                ->color('primary'),

            Stat::make('Access Rules', number_format(AccessRule::count()))
                ->description($rulesEnabled.' enabled')
                ->descriptionIcon('heroicon-m-shield-check')
                ->chart($rulesTrend['counts'])
                ->color('info'),

            Stat::make('Blocked (7d)', number_format($blocked7))
                ->description($blockRate.'% of '.number_format($checks7).' checks')
                ->descriptionIcon('heroicon-m-shield-exclamation')
                ->chart($blocked['counts'])
                ->color('danger'),
        ];
    }
}
