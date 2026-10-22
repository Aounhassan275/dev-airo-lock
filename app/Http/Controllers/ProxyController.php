<?php

namespace App\Http\Controllers;

use App\Http\Controllers\AccessLockcontroller;
use App\Models\AccessRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

class ProxyController extends Controller
{
    // App Proxy signature verification + shop auth happens in
    // Osiset\ShopifyApp\Http\Middleware\AuthProxy (alias: auth.proxy).
    // Applied to this controller's routes in routes/web.php.
    //
    // Shop domain accessor: $shop->getDomain()->toNative() — the kyon147 package's
    // ShopModel trait stores the domain in the `name` column, not a `shopify_domain`
    // attribute. Do not use $shop->shopify_domain on User; it silently returns null.

    public function ping(Request $request): JsonResponse
    {
        $shop = Auth::user();

        return response()->json([
            'status' => 'ok',
            'timestamp' => now()->toIso8601String(),
            'shop' => $shop?->getDomain()?->toNative() ?? $request->query('shop'),
        ]);
    }

    /**
     * GET /apps/airo-lock/rules?type=product&handle=oil-filter
     *
     * Live lock rules for one storefront resource, straight from the DB.
     * Shopify caches rendered storefront HTML (with the metafield values
     * baked in) for anonymous visitors and offers no purge API — pages can
     * serve pre-save metafields for 30+ minutes, which is why merchants had
     * to toggle the app embed (a theme edit busts that cache) to make locks
     * apply. The storefront JS calls this endpoint when the rendered HTML is
     * older than a few minutes, so enforcement no longer depends on
     * Shopify's cache at all.
     */
    public function rules(Request $request): JsonResponse
    {
        $shop = Auth::user();
        if (!$shop) {
            return response()->json(['error' => 'unauthorized'], 401);
        }

        $type = (string) $request->query('type', '');
        $handle = (string) $request->query('handle', '');

        $allowedTypes = ['product', 'collection', 'page', 'blog', 'shop'];
        if (!in_array($type, $allowedTypes, true)) {
            return response()->json(['error' => 'invalid type'], 422);
        }

        if ($type !== 'shop' && $handle === '') {
            return response()->json(['error' => 'handle required'], 422);
        }

        // Server-side cache: Shopify's proxy leg appends unique signature
        // params, so HTTP caches rarely hit — without this, every stale
        // anonymous pageview would run the full lock-list query set.
        $payload = \Illuminate\Support\Facades\Cache::remember(
            "proxy_rules:{$shop->id}:{$type}:{$handle}",
            30,
            function () use ($shop, $type, $handle) {
                $controller = app(AccessLockcontroller::class);

                $localQuery = AccessRule::query()
                    ->where('shop_id', $shop->id)
                    ->where('enabled', true)
                    ->where('resource_type', $type)
                    ->whereHas('lock', fn ($q) => $q->where('status', true))
                    ->with('lock');

                if ($type === 'shop') {
                    // Shop-wide locks aren't keyed by handle.
                    $localQuery->limit(20);
                } else {
                    $localQuery->where('handle', $handle);
                }

                $local = $localQuery->get()
                    ->map(fn ($rule) => $controller->buildRuleMetafieldData($rule))
                    ->values();

                return [
                    'generated_at' => now()->toIso8601String(),
                    'local' => ['locks' => $local],
                    'global' => ['locks' => $controller->buildGlobalLockList($shop)],
                ];
            }
        );

        return response()
            ->json($payload)
            ->header('Cache-Control', 'public, max-age=15');
    }

    /**
     * GET /apps/airo-lock/robots-disallow.txt
     *
     * Returns a text/plain document of Disallow lines for every locked
     * resource on the authenticated shop where the lock has seo_block=true.
     * Merchants reference this from their theme's robots.txt.liquid to
     * exclude locked pages from search engine crawls in bulk.
     */
    public function robotsDisallow(): Response
    {
        $shop = Auth::user();
        if (!$shop) {
            return response('# No authenticated shop', 401, ['Content-Type' => 'text/plain']);
        }

        $lockedResources = AccessRule::query()
            ->where('shop_id', $shop->id)
            ->where('enabled', true)
            ->whereHas('lock', function ($q) {
                $q->where('seo_block', true)
                    ->where('status', true);
            })
            ->whereNotNull('handle')
            ->get(['resource_type', 'handle'])
            ->map(function ($rule) {
                return match ($rule->resource_type) {
                    'product' => '/products/' . $rule->handle,
                    'collection' => '/collections/' . $rule->handle,
                    'page' => '/pages/' . $rule->handle,
                    'blog' => '/blogs/' . $rule->handle,
                    default => null,
                };
            })
            ->filter()
            ->unique()
            ->values();

        $body = "# Airo Access Lock & Control — locked resources (auto-generated)\n";
        $body .= '# Shop: ' . $shop->getDomain()->toNative() . "\n";
        $body .= '# Generated: ' . now()->toIso8601String() . "\n\n";

        if ($lockedResources->isEmpty()) {
            $body .= "# No locked resources with seo_block enabled.\n";
        } else {
            foreach ($lockedResources as $path) {
                $body .= 'Disallow: ' . $path . "\n";
            }
        }

        return response($body, 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }
}
