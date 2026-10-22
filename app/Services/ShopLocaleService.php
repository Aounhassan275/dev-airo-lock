<?php

namespace App\Services;

use App\Models\StoreDetail;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Reads the languages a shop actually publishes on its storefront
 * (Settings → Languages in the Shopify admin) so the widget editor can
 * offer exactly those, instead of asking merchants to remember locale codes.
 *
 * Results are persisted on store_details, so the editor renders without a
 * Shopify round-trip; refresh() re-pulls when the merchant asks.
 */
class ShopLocaleService
{
    private const QUERY = <<<'GRAPHQL'
    {
        shopLocales {
            locale
            name
            primary
            published
        }
    }
    GRAPHQL;

    /**
     * Cached locales for the shop, fetching once if we've never looked.
     *
     * @return array{primary: string, locales: array<int, array{locale: string, name: string, primary: bool, published: bool}>}
     */
    public function get(User $shop): array
    {
        $detail = StoreDetail::where('user_id', $shop->id)->first();

        $cached = $detail?->shop_locales;

        if (is_array($cached) && count($cached) > 0) {
            return [
                'primary' => $detail->primary_locale ?: $this->primaryFrom($cached),
                'locales' => $cached,
            ];
        }

        return $this->refresh($shop);
    }

    /**
     * Pull the current locale list from Shopify and store it.
     *
     * @return array{primary: string, locales: array<int, array{locale: string, name: string, primary: bool, published: bool}>}
     */
    public function refresh(User $shop): array
    {
        $locales = [];

        try {
            $response = ShopifyRetry::run(fn () => $shop->api()->graph(self::QUERY));
            $nodes = $response['body']['data']['shopLocales'] ?? [];
            // The SDK hands back a ResponseAccess object, not a plain array.
            $nodes = $nodes ? json_decode(json_encode($nodes), true) : [];

            foreach ($nodes as $node) {
                $locale = $node['locale'] ?? null;
                if (! $locale) {
                    continue;
                }

                $locales[] = [
                    'locale' => (string) $locale,
                    'name' => (string) ($node['name'] ?? $locale),
                    'primary' => (bool) ($node['primary'] ?? false),
                    'published' => (bool) ($node['published'] ?? false),
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to fetch shopLocales', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage(),
            ]);
        }

        if (empty($locales)) {
            // Never hand the editor an empty list — English keeps it usable
            // when the shop has no published translations (or the call failed).
            $locales = [[
                'locale' => 'en',
                'name' => 'English',
                'primary' => true,
                'published' => true,
            ]];
        }

        $primary = $this->primaryFrom($locales);

        StoreDetail::updateOrCreate(
            ['user_id' => $shop->id],
            [
                'shop_locales' => $locales,
                'primary_locale' => $primary,
                'locales_synced_at' => now(),
            ]
        );

        return ['primary' => $primary, 'locales' => $locales];
    }

    /** @param array<int, array<string, mixed>> $locales */
    private function primaryFrom(array $locales): string
    {
        foreach ($locales as $entry) {
            if (! empty($entry['primary'])) {
                return (string) $entry['locale'];
            }
        }

        return (string) ($locales[0]['locale'] ?? 'en');
    }
}
