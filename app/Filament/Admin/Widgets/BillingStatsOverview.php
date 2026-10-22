<?php

namespace App\Filament\Admin\Widgets;

use App\Models\Charge;
use App\Models\StoreDetail;
use App\Models\User;
use Filament\Widgets\StatsOverviewWidget as BaseWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

/**
 * Revenue accounting at a glance. MRR counts only REAL (non-test) active
 * subscriptions, with annual plans normalized to monthly equivalents.
 * Closed / frozen / uninstalled stores (per stores:check-status) are not
 * revenue no matter what their charge rows say — a store that dies without
 * webhooking us used to sit in MRR forever.
 */
class BillingStatsOverview extends BaseWidget
{
    protected static ?int $sort = 2;

    protected function getStats(): array
    {
        $deadShopIds = StoreDetail::query()
            ->whereIn('store_status', StoreDetail::DEAD_STATUSES)
            ->pluck('user_id');

        $payingShops = User::query()
            ->whereNotNull('plan_id')
            ->whereNotIn('id', $deadShopIds)
            ->with('plan')
            ->get()
            ->filter(fn (User $shop) => $shop->plan !== null);

        $realActiveCharges = Charge::query()
            ->where('test', false)
            ->whereNull('cancelled_on')
            ->whereIn('status', ['ACTIVE', 'ACCEPTED'])
            ->whereIn('user_id', $payingShops->pluck('id'))
            ->get()
            ->unique('user_id');

        $mrr = $realActiveCharges->sum(function (Charge $charge) {
            return $charge->interval === 'ANNUAL'
                ? (float) $charge->price / 12
                : (float) $charge->price;
        });

        $trialing = $payingShops->filter(fn (User $shop) => $shop->isInTrial())->count();

        $testCharges = Charge::query()
            ->where('test', true)
            ->whereNull('cancelled_on')
            ->whereIn('status', ['ACTIVE', 'ACCEPTED'])
            ->count();

        $freeAccess = User::query()
            ->where('shopify_freemium', true)
            ->orWhere('shopify_grandfathered', true)
            ->count();

        // Stores that died in the last 30 days — and how many of them were on
        // a real (non-test) subscription when they went (the install-high-plan
        // -for-3-days-then-vanish pattern).
        $churnWindow = now()->subDays(30);
        $churnedShopIds = StoreDetail::query()
            ->whereIn('store_status', StoreDetail::DEAD_STATUSES)
            ->where(function ($q) use ($churnWindow) {
                $q->where('uninstalled_at', '>=', $churnWindow)
                    ->orWhere('store_status_changed_at', '>=', $churnWindow);
            })
            ->pluck('user_id');
        $churnedPaid = Charge::query()
            ->where('test', false)
            ->whereIn('user_id', $churnedShopIds)
            ->distinct('user_id')
            ->count('user_id');

        return [
            Stat::make('MRR (real charges)', '$'.number_format($mrr, 2))
                ->description('Annual at 1/12 per month · closed/frozen stores excluded')
                ->color('success'),
            Stat::make('Paying shops', $payingShops->count())
                ->description($trialing.' currently in trial'),
            Stat::make('Test subscriptions', $testCharges)
                ->description('Dev stores / admin test mode — no revenue')
                ->color($testCharges > 0 ? 'warning' : 'gray'),
            Stat::make('Free access shops', $freeAccess)
                ->description('Admin-granted freemium / grandfathered'),
            Stat::make('Churned (30d)', $churnedShopIds->count())
                ->description($churnedPaid.' of them had a paid subscription')
                ->color($churnedShopIds->count() > 0 ? 'danger' : 'gray'),
        ];
    }
}
