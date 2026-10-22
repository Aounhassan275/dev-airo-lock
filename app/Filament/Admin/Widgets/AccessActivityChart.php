<?php

namespace App\Filament\Admin\Widgets;

use App\Models\AccessLog;
use App\Support\Metrics;
use Filament\Widgets\ChartWidget;

class AccessActivityChart extends ChartWidget
{
    protected static ?string $heading = 'Access Activity';

    protected static ?string $description = 'Granted vs blocked content unlocks over the last 14 days';

    protected static ?int $sort = 2;

    protected static ?string $maxHeight = '240px';

    protected int|string|array $columnSpan = 1;

    protected function getData(): array
    {
        $granted = Metrics::dailySeries(AccessLog::query()->where('granted', true), 14);
        $blocked = Metrics::dailySeries(AccessLog::query()->where('granted', false), 14);

        return [
            'datasets' => [
                [
                    'label' => 'Granted',
                    'data' => $granted['counts'],
                    'backgroundColor' => 'rgba(16, 185, 129, 0.7)',
                    'borderRadius' => 4,
                ],
                [
                    'label' => 'Blocked',
                    'data' => $blocked['counts'],
                    'backgroundColor' => 'rgba(239, 68, 68, 0.7)',
                    'borderRadius' => 4,
                ],
            ],
            'labels' => $granted['labels'],
        ];
    }

    protected function getOptions(): array
    {
        return [
            'scales' => [
                'y' => ['beginAtZero' => true, 'ticks' => ['precision' => 0]],
                'x' => ['grid' => ['display' => false]],
            ],
            'maintainAspectRatio' => false,
        ];
    }

    protected function getType(): string
    {
        return 'bar';
    }
}
