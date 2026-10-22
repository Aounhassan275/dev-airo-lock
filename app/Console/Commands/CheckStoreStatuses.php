<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\StoreStatusReconciler;
use Illuminate\Console\Command;

/**
 * Probes every installed shop's Admin API to detect stores that died without
 * telling us — closed stores, frozen stores, missed uninstall webhooks — and
 * reconciles local charge rows against Shopify's real subscription list.
 * Keeps the admin dashboard's MRR / paying-shops numbers honest.
 *
 *   php artisan stores:check-status                       # all installed shops
 *   php artisan stores:check-status --shop=x.myshopify.com  # one shop
 *
 * Scheduled daily (routes/console.php). Soft-deleted (uninstalled) shops are
 * excluded automatically by the User model's global scope.
 */
class CheckStoreStatuses extends Command
{
    protected $signature = 'stores:check-status {--shop= : Only this shop domain}';

    protected $description = 'Probe shops for closed/frozen/uninstalled state and reconcile subscriptions';

    public function handle(StoreStatusReconciler $reconciler): int
    {
        $query = User::query()->where('name', 'like', '%.myshopify.com');

        if ($shopDomain = $this->option('shop')) {
            $query->where('name', $shopDomain);
        }

        $shops = $query->get();

        if ($shops->isEmpty()) {
            $this->info('No shops to check.');

            return self::SUCCESS;
        }

        $rows = [];
        foreach ($shops as $shop) {
            $result = $reconciler->reconcile($shop);
            $rows[] = [
                $shop->name,
                $result['status'] ?? '(unchanged)',
                $result['reason'],
                $result['stale_charges'],
            ];

            // Be gentle with the API when sweeping the whole install base.
            if ($shops->count() > 1) {
                usleep(200_000);
            }
        }

        $this->table(['Shop', 'Status', 'Reason', 'Stale charges cancelled'], $rows);

        return self::SUCCESS;
    }
}
