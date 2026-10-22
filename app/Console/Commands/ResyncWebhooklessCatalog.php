<?php

namespace App\Console\Commands;

use App\Jobs\Products\SyncBlogsJob;
use App\Jobs\Products\SyncPagesJob;
use App\Jobs\Products\SyncThemesJob;
use App\Models\StoreDetail;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Re-read the resource types Shopify gives us no webhooks for.
 *
 * Products and collections stay current on their own — config/shopify-app.php
 * registers PRODUCTS_* and COLLECTIONS_* webhooks. Pages, blogs and themes have
 * none, so without this they are synced once by ProductFetchJob at install and
 * never again: a merchant who adds a page afterwards cannot find it in the lock
 * picker, which is exactly how this was reported.
 *
 * The picker also has a "Refresh from Shopify" button for the merchant who
 * needs it *now*; this is the background safety net so the list cannot quietly
 * rot for the merchants who never think to press it.
 */
class ResyncWebhooklessCatalog extends Command
{
    protected $signature = 'catalog:resync-webhookless {--shop= : Only this myshopify.com domain}';

    protected $description = 'Re-sync pages, blogs and themes — the resource types with no Shopify webhooks';

    public function handle(): int
    {
        $query = User::query();

        if ($domain = $this->option('shop')) {
            $query->where('name', $domain);
        } else {
            // Skip shops that cannot answer: an uninstalled, closed or frozen
            // store's token is dead, and every call would just burn a retry.
            $dead = StoreDetail::whereIn('store_status', StoreDetail::DEAD_STATUSES)->pluck('user_id');
            $query->whereNotIn('id', $dead);
        }

        $shops = $query->get();
        $this->info("Re-syncing pages, blogs and themes for {$shops->count()} shop(s).");

        foreach ($shops as $shop) {
            // Queued, not inline: this runs unattended across every shop, and
            // the jobs already handle their own pagination and retries.
            SyncPagesJob::dispatch($shop);
            SyncBlogsJob::dispatch($shop);
            SyncThemesJob::dispatch($shop);
        }

        return self::SUCCESS;
    }
}
