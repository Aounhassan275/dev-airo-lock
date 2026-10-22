<?php

namespace App\Console\Commands;

use App\Http\Controllers\AccessLockcontroller;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Rebuilds the shop-level `access_lock.global_config` metafield for every store
 * (or one, via --shop) by re-running the global sync. Needed as a one-off repair
 * after the fix that stopped `updateGlobalMetafield()` from silently dropping
 * locks that use the default design (no custom widget) — those stores currently
 * hold an empty/stale metafield, so their locks enforce nothing until re-synced.
 *
 *   php artisan locks:resync                       # every shop
 *   php artisan locks:resync --shop=foo.myshopify.com
 *
 * Each shop is one Admin API metafield write. Safe to re-run; idempotent.
 */
class ResyncLockMetafields extends Command
{
    protected $signature = 'locks:resync {--shop= : Only re-sync this myshopify.com domain}';

    protected $description = "Rebuild each store's global access-lock metafield from its current locks";

    public function handle(AccessLockcontroller $controller): int
    {
        // Only real shops have a myshopify.com domain as their name; skip
        // admin / non-shop accounts which have no Shopify API connection.
        $query = User::query()->where('name', 'like', '%.myshopify.com');

        if ($shop = $this->option('shop')) {
            $query->where('name', $shop);
        }

        $shops = $query->get();

        if ($shops->isEmpty()) {
            $this->info('No shops to process.');

            return self::SUCCESS;
        }

        $ok = 0;
        $failed = 0;

        foreach ($shops as $shop) {
            try {
                $controller->updateGlobalMetafield($shop);
                $ok++;
                $this->info('✓ '.$shop->name);
            } catch (\Throwable $e) {
                $failed++;
                $this->error('! '.$shop->name.' — '.$e->getMessage());
            }
        }

        $this->newLine();
        $this->info("Done. Re-synced: {$ok}, Failed: {$failed}. Per-lock detail is in the logs.");

        return self::SUCCESS;
    }
}
