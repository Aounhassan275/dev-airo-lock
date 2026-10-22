<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\ThemeExtensionService;
use Illuminate\Console\Command;

/**
 * Refreshes the storefront app-embed status for every shop and persists it to
 * store_details, so the admin "Stores" list reflects ALL stores — not just the
 * ones whose merchant has recently opened the app. Each shop is one Admin API
 * theme read (ThemeExtensionService writes the result).
 *
 *   php artisan embed:backfill              # re-check every shop (bypasses cache)
 *   php artisan embed:backfill --stale=120  # only shops not checked in 120 min
 *
 * Safe to schedule (e.g. hourly) — use --stale to avoid re-hitting the API for
 * shops that were just checked.
 */
class EmbedBackfill extends Command
{
    protected $signature = 'embed:backfill {--stale= : Only re-check shops whose status is older than N minutes}';

    protected $description = "Refresh each store's storefront app-embed status shown in the admin";

    public function handle(ThemeExtensionService $service): int
    {
        // Only real shops have a myshopify.com domain as their name; skip
        // admin / non-shop accounts which have no Shopify API connection.
        $shops = User::query()
            ->where('name', 'like', '%.myshopify.com')
            ->with('storeDetail')
            ->get();

        if ($shops->isEmpty()) {
            $this->info('No shops to process.');

            return self::SUCCESS;
        }

        $stale = $this->option('stale');
        $enabled = 0;
        $disabled = 0;
        $failed = 0;
        $skipped = 0;

        foreach ($shops as $shop) {
            // Skip shops checked recently when --stale is given.
            if ($stale !== null) {
                $checkedAt = $shop->storeDetail?->embed_checked_at;
                if ($checkedAt && $checkedAt->gt(now()->subMinutes((int) $stale))) {
                    $skipped++;

                    continue;
                }
            }

            try {
                // fresh: true → bypass the per-shop cache, recompute, and persist.
                $status = $service->status($shop, fresh: true);

                if ($status['enabled']) {
                    $enabled++;
                    $this->info('✓ '.$shop->name.' — enabled');
                } else {
                    $disabled++;
                    $this->warn('✗ '.$shop->name.' — DISABLED ('.($status['reason'] ?? 'unknown').')');
                }
            } catch (\Throwable $e) {
                $failed++;
                $this->error('! '.$shop->name.' — error: '.$e->getMessage());
            }
        }

        $this->newLine();
        $this->info("Done. Enabled: {$enabled}, Disabled: {$disabled}, Failed: {$failed}, Skipped: {$skipped}.");

        return self::SUCCESS;
    }
}
