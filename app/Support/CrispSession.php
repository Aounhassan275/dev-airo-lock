<?php

namespace App\Support;

use App\Models\Lock;
use App\Models\User;

/**
 * What support sees in Crisp about the merchant they're talking to.
 *
 * The visitor is named after the store's domain rather than "visitor276444",
 * and the session carries the facts a lock support ticket actually turns on:
 * which app plan, whether the trial is running, whether it's a dev store (those
 * can only ever take TEST charges), and whether the theme app embed is enabled
 * — the single most common reason a merchant reports "my locks don't work".
 */
class CrispSession
{
    public const APP_NAME = 'Airo Access Lock & Control';

    /**
     * @return array{nickname: string, email: ?string, company: ?array, data: array<int, array{0: string, 1: string}>, segments: array<int, string>}|null
     */
    public static function for(?User $shop): ?array
    {
        if (! $shop) {
            return null;
        }

        // NOTE: the relation is storeDetail (singular). The Blade template used
        // to read ->storeDetails, which isn't a relation or a column, so it
        // silently evaluated to null and every field taken from it — the store's
        // domain and its Shopify plan — reached Crisp empty.
        $detail = $shop->storeDetail;

        $myshopify = self::host($detail?->shopify_domain) ?? self::host($shop->name);
        $storefront = self::host($detail?->primary_domain) ?? $myshopify;
        $handle = $myshopify ? str_replace('.myshopify.com', '', $myshopify) : null;

        $lockCount = Lock::where('shop_id', $shop->id)->count();
        $unlimited = $shop->hasUnlimitedLocks();
        $maxLocks = $shop->getMaxLocks();
        $freeAccess = $shop->isFreemium() || $shop->isGrandfathered();
        $isDev = $shop->isDevStore();
        $embed = $detail?->embed_enabled;

        $data = [
            'store_id' => (string) $shop->id,
            'store_name' => $detail?->shop_name ?: $myshopify,
            'store_domain' => $storefront,
            'myshopify_domain' => $myshopify,
            'store_admin' => $handle ? "https://admin.shopify.com/store/{$handle}" : null,
            'store_email' => $detail?->email,
            'shopify_plan' => $detail?->plan_name,
            'dev_store' => self::yesNo($isDev),
            'shopify_plus' => self::yesNo((bool) $detail?->shopify_plus),
            'country' => $detail?->country,
            'currency' => $detail?->currency,
            'timezone' => $detail?->iana_timezone,
            'app_name' => self::APP_NAME,
            'app_plan' => $shop->plan->name ?? ($freeAccess ? 'Free access' : 'No plan'),
            'app_plan_status' => self::planStatus($shop, $freeAccess),
            'locks_used' => $unlimited ? "{$lockCount} (unlimited)" : "{$lockCount} / {$maxLocks}",
            // Locks silently do nothing while the theme app embed is off, so
            // support should see this before the merchant is asked anything.
            'app_embed' => $embed === null ? 'unknown' : self::yesNo((bool) $embed),
            'installed_at' => $shop->created_at?->toDateString(),
        ];

        // Crisp renders a row per key — drop the ones we have nothing for rather
        // than showing support a wall of blanks.
        $data = array_filter($data, fn ($value) => $value !== null && $value !== '');

        return [
            'nickname' => $storefront ?: $myshopify ?: "Store #{$shop->id}",
            'email' => $detail?->email,
            'company' => $detail?->shop_name || $storefront
                ? [
                    $detail?->shop_name ?: $storefront,
                    // Cast to object: an empty array would serialize as [] and
                    // Crisp expects an object here.
                    (object) array_filter([
                        'url' => $storefront ? "https://{$storefront}" : null,
                        'domain' => $storefront,
                    ]),
                ]
                : null,
            // Segments are Crisp's filters — these are the cuts support actually
            // wants ("show me every dev store", "every shop with the embed off").
            'segments' => array_values(array_filter([
                'airo-lock',
                $isDev ? 'dev-store' : null,
                $shop->isInTrial() ? 'trial' : null,
                $shop->hasPaidPlan() ? 'paid' : null,
                $freeAccess ? 'free-access' : null,
                (! $shop->hasPaidPlan() && ! $freeAccess) ? 'no-plan' : null,
                $embed === false ? 'embed-off' : null,
            ])),
            'data' => array_map(
                fn ($key, $value) => [$key, (string) $value],
                array_keys($data),
                array_values($data),
            ),
        ];
    }

    private static function planStatus(User $shop, bool $freeAccess): string
    {
        if ($shop->isInTrial()) {
            $days = $shop->getTrialDaysRemaining();

            return "Trial — {$days} day".($days === 1 ? '' : 's').' left';
        }

        if ($shop->hasPaidPlan()) {
            return 'Paid';
        }

        return $freeAccess ? 'Free access' : 'No plan';
    }

    /** Bare hostname — primary_domain arrives from Shopify as a full URL. */
    private static function host(?string $value): ?string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        $host = parse_url(str_contains($value, '//') ? $value : "https://{$value}", PHP_URL_HOST);

        return $host ?: null;
    }

    private static function yesNo(bool $value): string
    {
        return $value ? 'yes' : 'no';
    }
}
