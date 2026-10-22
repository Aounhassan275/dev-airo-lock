<?php

namespace App\Services;

use App\Models\Lock;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Plan enforcement + usage reporting for the paid app.
 *
 * All gating is server-side: lock counts AND per-feature checks (condition
 * types, resource types, scheduling, price-hiding) are validated here before
 * anything is written. The same service builds the `billing` payload shared
 * with the frontend so banners/warnings always reflect what the backend will
 * actually enforce.
 */
class BillingService
{
    public function __construct(private MailService $mail) {}

    /* ───────────────────────────── Usage ───────────────────────────── */

    public function lockCount(User $shop): int
    {
        // access_rules.lock_id is NOT NULL, so every rule belongs to a lock —
        // counting Lock rows covers the whole quota surface.
        return Lock::where('shop_id', $shop->id)->count();
    }

    /**
     * Compact billing/usage payload shared with every Inertia page.
     */
    public function usage(User $shop): array
    {
        $plan = $shop->plan;
        $maxLocks = $shop->getMaxLocks();
        $unlimited = $shop->hasUnlimitedLocks();
        $used = $this->lockCount($shop);
        $remaining = $unlimited ? null : max(0, $maxLocks - $used);
        $limitReached = ! $unlimited && $used >= $maxLocks;
        $nearLimit = ! $unlimited && ! $limitReached && $maxLocks > 0
            && ($used / $maxLocks) >= (float) config('plans.near_limit_threshold', 0.8);

        $charge = $shop->activePlanCharge();
        $trialDays = $shop->getTrialDaysRemaining();

        return [
            'billingEnabled' => (bool) config('shopify-app.billing_enabled'),
            'hasPlan' => $plan !== null,
            'freeAccess' => $shop->isFreemium() || $shop->isGrandfathered(),
            'planId' => $plan?->id,
            'planName' => $plan?->name,
            'planPrice' => $plan?->price,
            'planInterval' => $plan?->interval,
            'maxLocks' => $unlimited ? 0 : $maxLocks,
            'hasUnlimitedLocks' => $unlimited,
            'locksUsed' => $used,
            'remainingLocks' => $remaining,
            'limitReached' => $limitReached,
            'nearLimit' => $nearLimit,
            'isTrial' => $trialDays > 0,
            'trialDaysRemaining' => $trialDays,
            'trialEndsOn' => $charge?->trial_ends_on
                ? Carbon::parse($charge->trial_ends_on)->toDateString()
                : null,
            'billingOn' => $charge?->billing_on
                ? Carbon::parse($charge->billing_on)->toDateString()
                : null,
            'testMode' => $this->chargesWouldBeTest($shop),
            'isDevStore' => $shop->isDevStore(),
            // Feature data for UI gating badges ("Pro" / "Unlimited" pills on
            // locked options in the lock builder).
            'features' => $plan ? $plan->featureKeys() : config('plans.tiers.Basic.features', []),
            'featureTiers' => $this->featureTiers(),
            'conditionFeatures' => config('plans.condition_feature_map', []),
        ];
    }

    /**
     * Lowest tier (by config order: Basic → Pro → Unlimited) that includes
     * each feature — used to label upgrade badges in the UI.
     *
     * @return array<string, string> feature key => tier name
     */
    public function featureTiers(): array
    {
        $map = [];

        foreach (config('plans.tiers', []) as $tier => $spec) {
            foreach ($spec['features'] ?? [] as $feature) {
                $map[$feature] ??= $tier;
            }
        }

        return $map;
    }

    /**
     * Would a charge created right now for this shop be a Shopify TEST charge?
     * Mirrors App\Models\Plan::isTest() minus the per-plan flag.
     */
    public function chargesWouldBeTest(User $shop): bool
    {
        return (bool) Setting::get('billing_test_mode', false)
            || (bool) $shop->allow_test_charges
            || $shop->isDevStore();
    }

    /* ─────────────────────────── Enforcement ────────────────────────── */

    /**
     * Can the shop create one more lock? (count limit only)
     */
    public function canCreateLock(User $shop): bool
    {
        if (! config('shopify-app.billing_enabled')) {
            return true;
        }

        if ($shop->hasUnlimitedLocks()) {
            return true;
        }

        return $this->lockCount($shop) < $shop->getMaxLocks();
    }

    /**
     * Validate a new/updated lock payload against the shop's plan.
     * Returns a list of human-readable violation messages (empty = allowed).
     *
     * @param array $validated The validated storeLock() payload.
     * @param bool  $isNew     Whether this creates a new lock (count check).
     */
    public function lockViolations(User $shop, array $validated, bool $isNew): array
    {
        if (! config('shopify-app.billing_enabled')) {
            return [];
        }

        $violations = [];
        $planName = $shop->plan?->name ?? 'current';

        // 1. Lock count (new locks only — edits of existing locks always allowed).
        if ($isNew && ! $this->canCreateLock($shop)) {
            $this->notifyQuotaReached($shop);
            $violations[] = "You've reached the maximum of {$shop->getMaxLocks()} locks on the {$planName} plan. Upgrade to create more locks.";
        }

        // 2. Resource types (entire store / checkout / theme / variant locks).
        $resourceMap = config('plans.resource_feature_map', []);
        foreach ($validated['selectedItems'] ?? [] as $item) {
            $type = $item['resource_type'] ?? null;
            $feature = $resourceMap[$type] ?? null;
            if ($feature && ! $this->shopHasFeature($shop, $feature)) {
                $violations[] = $this->featureViolation($feature);
            }

            // Variant-level narrowing of a product lock is its own feature.
            if (! empty(array_filter($item['variant_ids'] ?? []))
                && ! $this->shopHasFeature($shop, 'variant_locks')) {
                $violations[] = $this->featureViolation('variant_locks');
            }
        }

        // 3. Condition types (secret links, tags, email, geo/IP, age).
        $violations = array_merge(
            $violations,
            $this->conditionViolations($shop, $validated['rules'] ?? [])
        );

        // 4. Scheduling (start / expiry dates).
        if ((! empty($validated['starts_at']) || ! empty($validated['expires_at']))
            && ! $this->shopHasFeature($shop, 'scheduling')) {
            $violations[] = $this->featureViolation('scheduling');
        }

        return $this->logBlocked($shop, array_values(array_unique($violations)), 'lock save');
    }

    /**
     * Violations for creating a hide-price rule (its own feature + lock count).
     */
    public function priceRuleViolations(User $shop): array
    {
        if (! config('shopify-app.billing_enabled')) {
            return [];
        }

        $violations = [];

        if (! $this->canCreateLock($shop)) {
            $this->notifyQuotaReached($shop);
            $violations[] = "You've reached the maximum of {$shop->getMaxLocks()} locks on the "
                .($shop->plan?->name ?? 'current')." plan. Upgrade to create more locks.";
        }

        if (! $this->shopHasFeature($shop, 'hide_prices')) {
            $violations[] = $this->featureViolation('hide_prices');
        }

        return $this->logBlocked($shop, $violations, 'price rule save');
    }

    /**
     * Feature violations for a condition-group structure (the `rules` payload
     * of locks and the `conditions` payload of access rules share the same
     * shape: [{conditions: [{type, value}, …]}, …]; bare conditions with a
     * `type` key are tolerated too).
     */
    public function conditionViolations(User $shop, ?array $groups): array
    {
        if (! config('shopify-app.billing_enabled') || empty($groups)) {
            return [];
        }

        $conditionMap = config('plans.condition_feature_map', []);
        $violations = [];

        foreach ($groups as $group) {
            $conditions = is_array($group) && array_key_exists('conditions', $group)
                ? ($group['conditions'] ?? [])
                : [$group];

            foreach ($conditions as $condition) {
                $feature = $conditionMap[$condition['type'] ?? ''] ?? null;
                if ($feature && ! $this->shopHasFeature($shop, $feature)) {
                    $violations[] = $this->featureViolation($feature);
                }
            }
        }

        return array_values(array_unique($violations));
    }

    /**
     * Violations for creating/updating a STANDALONE access rule (Access Rules
     * page — no parent lock). New rules consume lock quota; conditions are
     * feature-gated the same as lock conditions.
     */
    public function ruleViolations(User $shop, ?array $conditions, bool $isNew): array
    {
        if (! config('shopify-app.billing_enabled')) {
            return [];
        }

        $violations = [];

        if ($isNew && ! $this->canCreateLock($shop)) {
            $this->notifyQuotaReached($shop);
            $violations[] = "You've reached the maximum of {$shop->getMaxLocks()} locks on the "
                .($shop->plan?->name ?? 'current')." plan. Upgrade to create more locks or rules.";
        }

        return $this->logBlocked(
            $shop,
            array_merge($violations, $this->conditionViolations($shop, $conditions)),
            'access rule save'
        );
    }

    /**
     * Ground truth in the log for every write the plan gate refuses — when a
     * merchant reports "it let me save" or "it blocked me", this line says
     * which it was and why.
     */
    private function logBlocked(User $shop, array $violations, string $context): array
    {
        if ($violations !== []) {
            Log::info('[Billing] blocked by plan gate', [
                'shop' => $shop->name,
                'context' => $context,
                'plan' => $shop->plan?->name ?? ($shop->isFreemium() || $shop->isGrandfathered() ? 'free access' : 'none'),
                'violations' => $violations,
            ]);
        }

        return $violations;
    }

    public function shopHasFeature(User $shop, string $feature): bool
    {
        if (! config('shopify-app.billing_enabled')) {
            return true;
        }

        $plan = $shop->plan;

        if ($plan === null) {
            // Admin-granted free access (freemium/grandfathered) gets entry-tier
            // features; anyone else is blocked upstream by the plan gate.
            return in_array($feature, config('plans.tiers.Basic.features', []), true);
        }

        return $plan->hasFeature($feature);
    }

    /* ─────────────────────────── Notifications ──────────────────────── */

    /**
     * Send the "lock limit reached" email at most once per quota period.
     * Re-armed whenever a plan is (re)activated — see PlanActivatedListener.
     */
    public function notifyQuotaReached(User $shop): void
    {
        try {
            if ($shop->quota_notified_at !== null) {
                return;
            }

            $shop->forceFill(['quota_notified_at' => now()])->save();

            $this->mail->quotaReached(
                $shop,
                $shop->plan?->name ?? 'Current',
                $shop->getMaxLocks(),
                $this->lockCount($shop)
            );
        } catch (\Throwable $e) {
            Log::warning('[BillingService] quota notification failed', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    private function featureViolation(string $feature): string
    {
        $label = config("plans.features.{$feature}", $feature);

        return "\"{$label}\" is not included in your current plan. Upgrade to use it.";
    }
}
