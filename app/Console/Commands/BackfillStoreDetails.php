<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\StoreDetailSync;
use Illuminate\Console\Command;

/**
 * Backfills StoreDetail rows for shops that never got one (e.g. when the
 * install-time sync failed). Runs the Shopify shop query for every shop and
 * reports success/failure per shop — also a quick diagnostic for why the
 * install-time StoreDetail sync isn't populating.
 *
 *   php artisan stores:backfill            # all shops
 *   php artisan stores:backfill --missing  # only shops without a StoreDetail
 */
class BackfillStoreDetails extends Command
{
    protected $signature = 'stores:backfill {--missing : Only shops that have no StoreDetail yet}';

    protected $description = 'Fetch and store StoreDetail for existing shops';

    public function handle(StoreDetailSync $sync): int
    {
        // Only real shops have a myshopify.com domain as their name; skip
        // admin / non-shop accounts which have no Shopify API connection.
        $query = User::query()->where('name', 'like', '%.myshopify.com');

        if ($this->option('missing')) {
            $query->whereDoesntHave('storeDetail');
        }

        $shops = $query->get();

        if ($shops->isEmpty()) {
            $this->info('No shops to process.');

            return self::SUCCESS;
        }

        $ok = 0;
        $failed = 0;

        foreach ($shops as $shop) {
            $result = $sync->sync($shop);

            if ($result['ok']) {
                $ok++;
                $this->info('✓ '.$shop->name.' — '.$result['message']);
            } else {
                $failed++;
                $this->error('✗ '.$shop->name.' — '.$result['message']);
            }
        }

        $this->newLine();
        $this->info("Done. Synced: {$ok}, Failed: {$failed}.");

        return self::SUCCESS;
    }
}
