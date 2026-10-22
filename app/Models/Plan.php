<?php

namespace App\Models;

use Osiset\ShopifyApp\Storage\Models\Plan as BasePlan;

/**
 * App plan model. Extends the package plan with feature gating and the
 * test-charge policy: real merchants always receive REAL charges; test
 * charges are only issued for development stores (Shopify rejects real
 * charges on them anyway), for shops the admin explicitly flagged, or when
 * the global "billing test mode" admin setting is on.
 */
class Plan extends BasePlan
{
    /** Managed by the seeder + Filament admin forms (never from merchant input). */
    protected $guarded = [];

    protected $casts = [
        'test' => 'bool',
        'on_install' => 'bool',
        'is_popular' => 'bool',
        'is_active' => 'bool',
        'capped_amount' => 'float',
        'price' => 'float',
        'features' => 'array',
    ];

    /** Plans that merchants can currently subscribe to. */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Shops currently subscribed to this plan.
     */
    public function users()
    {
        return $this->hasMany(User::class, 'plan_id');
    }

    /** 0 (or null) max_locks means unlimited. */
    public function isUnlimitedLocks(): bool
    {
        return (int) $this->max_locks === 0;
    }

    /**
     * Feature keys this plan includes. Falls back to the tier defaults in
     * config/plans.php when the row has no explicit features.
     *
     * @return string[]
     */
    public function featureKeys(): array
    {
        $features = $this->features;

        if (is_array($features) && $features !== []) {
            return array_values($features);
        }

        return config("plans.tiers.{$this->name}.features", config('plans.tiers.Basic.features', []));
    }

    public function hasFeature(string $key): bool
    {
        return in_array($key, $this->featureKeys(), true);
    }

    /** Merchant-facing labels for the plan's features (for the pricing page). */
    public function featureLabels(): array
    {
        $catalog = config('plans.features', []);

        return array_values(array_filter(array_map(
            fn (string $key) => $catalog[$key] ?? null,
            $this->featureKeys()
        )));
    }

    /**
     * Whether the Shopify charge for this plan should be a TEST charge.
     *
     * Called by the package while the shop is authenticated (billing +
     * activation both run inside verify.shopify requests), so the current
     * shop is resolved from the auth guard.
     */
    public function isTest(): bool
    {
        // Plan explicitly marked as test in the admin (e.g. a QA-only plan).
        if (parent::isTest()) {
            return true;
        }

        // Global admin switch — Plans & Billing settings page.
        if (Setting::get('billing_test_mode', false)) {
            return true;
        }

        $shop = auth()->user();
        if ($shop instanceof User) {
            // Per-shop admin override.
            if ($shop->allow_test_charges) {
                return true;
            }

            // Development / partner stores can only accept test charges.
            if ($shop->isDevStore()) {
                return true;
            }
        }

        return false;
    }
}
