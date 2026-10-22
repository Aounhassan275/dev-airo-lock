<?php

namespace App\Filament\Admin\Widgets;

use App\Models\User;
use App\Support\Metrics;
use Filament\Widgets\ChartWidget;

class InstallsChart extends ChartWidget
{
    protected static ?string $heading = 'Store Installs';

    protected static ?string $description = 'New merchant installs over the last 30 days';

    protected static ?int $sort = 1;

    protected static ?string $maxHeight = '240px';

    protected int|string|array $columnSpan = 1;

    protected function getData(): array
    {
        $series = Metrics::dailySeries(User::query(), 30);

        return [
            'datasets' => [
                [
                    'label' => 'Installs',
                    'data' => $series['counts'],
                    'borderColor' => '#f59e0b',
                    'backgroundColor' => 'rgba(245, 158, 11, 0.12)',
                    'fill' => 'start',
                    'tension' => 0.4,
                    'borderWidth' => 2,
                    'pointRadius' => 0,
                    'pointHoverRadius' => 4,
                ],
            ],
            'labels' => $series['labels'],
        ];
    }

    protected function getOptions(): array
    {
        return [
            'plugins' => [
                'legend' => ['display' => false],
            ],
            'scales' => [
                'y' => ['beginAtZero' => true, 'ticks' => ['precision' => 0]],
                'x' => ['grid' => ['display' => false]],
            ],
            'maintainAspectRatio' => false,
        ];
    }

    protected function getType(): string
    {
        return 'line';
    }
}
