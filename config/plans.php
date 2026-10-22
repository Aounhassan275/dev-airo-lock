<?php

/*
|--------------------------------------------------------------------------
| Plan & feature catalog
|--------------------------------------------------------------------------
|
| Single source of truth for what each plan tier can do. Plans live in the
| `plans` table (managed from the Filament admin); each row stores a
| `features` JSON array of the keys below plus a `max_locks` limit
| (0 = unlimited). When a plan row has no explicit features, the tier
| defaults below (matched by plan name) apply.
|
| Enforcement happens server-side in App\Services\BillingService — the
| condition/resource maps translate what a merchant is trying to save into
| the feature keys their plan must include.
|
*/

return [

    // Every gateable capability of the app. key => merchant-facing label.
    'features' => [
        'basic_locks' => 'Lock products, collections, pages & blogs',
        'passcode_access' => 'Passcode & sign-in access rules',
        'secret_link' => 'Secret link access',
        'tag_access' => 'Customer tag based access',
        'email_access' => 'Email-based access rules',
        'age_verification' => 'Age verification gates',
        'geo_ip_rules' => 'Location & IP based rules',
        'hide_prices' => 'Hide prices from guests',
        'scheduling' => 'Scheduled locks (start & expiry dates)',
        'variant_locks' => 'Variant-level locking',
        'store_lock' => 'Lock the entire store & checkout',
    ],

    // Default feature sets per tier — used when a plan row has no explicit
    // `features` JSON, and by the seeder to populate new rows.
    'tiers' => [
        'Free' => [
            'max_locks' => 1,
            'description' => 'Try the app free, forever',
            'features' => [
                'basic_locks',
                'passcode_access',
            ],
        ],
        'Basic' => [
            'max_locks' => 5,
            'description' => 'Perfect for getting started',
            'features' => [
                'basic_locks',
                'passcode_access',
            ],
        ],
        'Pro' => [
            'max_locks' => 20,
            'description' => 'Most popular for growing stores',
            'features' => [
                'basic_locks',
                'passcode_access',
                'secret_link',
                'tag_access',
                'email_access',
                'age_verification',
                'hide_prices',
                'scheduling',
                'variant_locks',
            ],
        ],
        'Unlimited' => [
            'max_locks' => 0, // 0 = unlimited
            'description' => 'For enterprise-level control',
            'features' => [
                'basic_locks',
                'passcode_access',
                'secret_link',
                'tag_access',
                'email_access',
                'age_verification',
                'geo_ip_rules',
                'hide_prices',
                'scheduling',
                'variant_locks',
                'store_lock',
            ],
        ],
    ],

    // Lock condition type (frontend LockCreationFlow values) => required feature.
    // Types not listed are available on every plan.
    'condition_feature_map' => [
        'singleSecretLink' => 'secret_link',
        'tag' => 'tag_access',
        'specificEmail' => 'email_access',
        'emailContains' => 'email_access',
        'emailFromList' => 'email_access',
        'pairedCredentials' => 'email_access',
        'ageVerification' => 'age_verification',
        'location' => 'geo_ip_rules',
        'ip' => 'geo_ip_rules',
    ],

    // Lock target resource type => required feature. Types not listed are
    // available on every plan (product, collection, page, blog).
    'resource_feature_map' => [
        'variant' => 'variant_locks',
        'shop' => 'store_lock',
        'checkout' => 'store_lock',
        'theme' => 'store_lock',
    ],

    // Shopify shop plan_name values that identify development / partner test
    // stores. These stores can never be charged for real — Shopify only
    // accepts test charges on them — so billing automatically flips to test
    // mode for these shops.
    'dev_store_plans' => [
        'partner_test',
        'affiliate',
        'developer_preview',
        'plus_partner_sandbox',
        'staff',
        'staff_business',
        'sales_training',
        'sandbox',
        'open_learning',
        'basic app development',  // Common dev store plan
        'development',
        'dev',
    ],

    // How close to the lock limit (fraction used) before the UI starts
    // showing an "approaching your limit" warning.
    'near_limit_threshold' => 0.8,

    // Days before trial end when the reminder email is sent.
    'trial_reminder_days' => 3,
];
