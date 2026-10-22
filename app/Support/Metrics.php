<?php

namespace App\Support;

use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

class Metrics
{
    /**
     * Build a zero-filled daily series for the last $days days (oldest → newest).
     *
     * @return array{labels: list<string>, counts: list<int>}
     */
    public static function dailySeries(Builder $query, int $days = 14, string $column = 'created_at'): array
    {
        // Whitelist the column so the raw DATE() expression can never be injected.
        $column = in_array($column, ['created_at', 'updated_at'], true) ? $column : 'created_at';

        $start = Carbon::today()->subDays($days - 1);

        $rows = $query
            ->where($column, '>=', $start)
            ->toBase()
            ->selectRaw("DATE($column) as d, COUNT(*) as c")
            ->groupBy('d')
            ->pluck('c', 'd');

        $labels = [];
        $counts = [];

        for ($i = 0; $i < $days; $i++) {
            $day = $start->copy()->addDays($i);
            $labels[] = $day->format('M j');
            $counts[] = (int) $rows->get($day->toDateString(), 0);
        }

        return ['labels' => $labels, 'counts' => $counts];
    }
}
