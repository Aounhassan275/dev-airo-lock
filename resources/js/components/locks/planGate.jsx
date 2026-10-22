import { router, usePage } from '@inertiajs/react';

/**
 * UI-side mirror of the backend plan gates (BillingService) — used ONLY for
 * small "Pro" / "Unlimited" upgrade badges on locked options in the lock
 * builder. Enforcement stays server-side; these are hints.
 */

// Content-type picker value → feature key (condition types come from the
// shared billing.conditionFeatures map instead).
const CONTENT_TYPE_FEATURES = {
    themes: 'store_lock',
    store: 'store_lock',
    checkout: 'store_lock',
    variants: 'variant_locks',
    price_hide: 'hide_prices',
};

export function usePlanGate() {
    const { billing } = usePage().props;

    const enabled = !!billing?.billingEnabled;
    const has = (feature) => !enabled || !feature || (billing.features || []).includes(feature);
    const lockedTier = (feature) => (feature && !has(feature) ? billing?.featureTiers?.[feature] || 'Pro' : null);

    return {
        // Tier name required for a condition type, or null when included in the plan.
        conditionTier: (type) => lockedTier(billing?.conditionFeatures?.[type]),
        // Tier name required for a content-type picker option, or null.
        contentTypeTier: (value) => lockedTier(CONTENT_TYPE_FEATURES[value]),
        // Tier name required for scheduled locks, or null.
        schedulingTier: () => lockedTier('scheduling'),
    };
}

/**
 * Navigate to the pricing page from anywhere in the lock builder. The App
 * Bridge contextual save bar survives Inertia SPA navigations, so it must be
 * dismissed first — otherwise it keeps blocking the admin top bar on the
 * pricing page ("Unsaved changes" with nowhere to save).
 */
export function goToPricing() {
    window.shopify?.saveBar?.hide('my-save-bar')?.catch?.(() => {});
    window.shopify?.saveBar?.hide('lock-save-bar')?.catch?.(() => {});
    router.visit('/pricing');
}

/** Tiny upgrade pill — "Pro" / "Unlimited". Click goes to the pricing page. */
export function PlanBadge({ tier }) {
    if (!tier) return null;

    return (
        <span
            title={`Available on the ${tier} plan — click to upgrade`}
            onClick={(event) => {
                event.stopPropagation();
                goToPricing();
            }}
            style={{
                display: 'inline-block',
                padding: '1px 7px',
                borderRadius: '10px',
                background: '#f3f0ff',
                border: '1px solid #ddd6fe',
                color: '#7c3aed',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                lineHeight: '14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                verticalAlign: 'middle',
            }}
        >
            {tier}
        </span>
    );
}

/** " · Pro" suffix for native <select> option labels (no markup possible there). */
export function optionSuffix(tier) {
    return tier ? ` · ${tier}` : '';
}
