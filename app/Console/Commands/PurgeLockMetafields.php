<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\MetafieldService;
use Illuminate\Console\Command;

/**
 * Removes orphaned Airo Access Lock & Control metafields from Shopify.
 *
 * The storefront reads lock config from the access_control.access_rule
 * metafield on each resource (and shop-level rules). Deleting a lock through
 * the app removes that metafield, but wiping the DB directly (migrate:fresh,
 * manual deletes) leaves the metafields on Shopify, so the storefront keeps
 * locking. This command sweeps every product / collection / page plus the
 * shop and deletes those metafields, clearing all stale locks.
 *
 * Usage:
 *   php artisan locks:purge-metafields                       # all shops
 *   php artisan locks:purge-metafields wixpa-task-2.myshopify.com
 *   php artisan locks:purge-metafields 2                     # by user id
 */
class PurgeLockMetafields extends Command
{
    protected $signature = 'locks:purge-metafields {shop? : Shop id or myshopify domain; omit to sweep all shops}';

    protected $description = 'Delete orphaned Airo Access Lock & Control access_control metafields from Shopify';

    public function handle(): int
    {
        $arg = $this->argument('shop');

        $query = User::query();
        if ($arg !== null) {
            is_numeric($arg) ? $query->where('id', (int) $arg) : $query->where('name', $arg);
        } else {
            // Only real Shopify shops; seeded users (e.g. "Admin User") have no domain.
            $query->where('name', 'like', '%.myshopify.com');
        }
        $shops = $query->get();

        if ($shops->isEmpty()) {
            $this->error('No matching shop. Pass a shop id or myshopify domain, or omit to sweep all shops.');
            return self::FAILURE;
        }

        $total = 0;
        foreach ($shops as $shop) {
            // Skip non-shop users so $shop->api() doesn't throw InvalidShopDomainException.
            if (!str_ends_with((string) $shop->name, '.myshopify.com')) {
                $this->warn("Skipping user #{$shop->id} ({$shop->name}) — not a Shopify shop.");
                continue;
            }
            $this->info("Purging lock metafields for {$shop->name} (#{$shop->id})...");
            try {
                $total += $this->purgeForShop($shop);
            } catch (\Throwable $e) {
                $this->error("  Failed for {$shop->name}: {$e->getMessage()}");
            }
        }

        $this->info("Done. Deleted {$total} lock metafield(s).");
        return self::SUCCESS;
    }

    private function purgeForShop(User $shop): int
    {
        $svc = new MetafieldService();
        $deleted = 0;

        // Resource connections to sweep: GraphQL field => GID type.
        $resources = [
            'products' => 'Product',
            'collections' => 'Collection',
            'pages' => 'Page',
        ];

        foreach ($resources as $field => $gidType) {
            $after = null;
            do {
                $query = <<<GQL
                    query (\$first:Int!, \$after:String) {
                        {$field}(first: \$first, after: \$after) {
                            pageInfo { hasNextPage endCursor }
                            nodes { id }
                        }
                    }
                    GQL;

                $resp = $shop->api()->graph($query, ['first' => 100, 'after' => $after]);
                $conn = $resp['body']['data'][$field] ?? null;
                $conn = $conn !== null ? json_decode(json_encode($conn), true) : null;
                if (!$conn) {
                    break;
                }

                foreach (($conn['nodes'] ?? []) as $node) {
                    $ownerId = $node['id'] ?? null;
                    if (!$ownerId) {
                        continue;
                    }
                    $res = $svc->deleteMetafield($shop, $ownerId, 'access_control', 'access_rule');
                    if (!empty($res['deleted_metafields'])) {
                        $deleted++;
                        $this->line("  Cleared {$gidType}: {$ownerId}");
                    }
                }

                $after = ($conn['pageInfo']['hasNextPage'] ?? false) ? ($conn['pageInfo']['endCursor'] ?? null) : null;
            } while ($after);
        }

        // Shop-level rules: the shop access rule and the global config blob.
        $shopResp = $shop->api()->graph('{ shop { id } }');
        $shopGid = $shopResp['body']['data']['shop']['id'] ?? null;
        if ($shopGid) {
            foreach ([['access_control', 'access_rule'], ['access_lock', 'global_config']] as [$ns, $key]) {
                $res = $svc->deleteMetafield($shop, $shopGid, $ns, $key);
                if (!empty($res['deleted_metafields'])) {
                    $deleted++;
                    $this->line("  Cleared Shop metafield {$ns}.{$key}");
                }
            }
        }

        return $deleted;
    }
}
