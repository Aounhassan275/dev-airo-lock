<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

/**
 * Seeds/refreshes the paid plan catalog.
 *
 * UPSERTS by (name, interval) instead of wiping the table: charges.plan_id
 * has a FK to plans.id, so deleting plan rows that have ever been sold would
 * fail (and would orphan the accounting anyway). Plans not in the catalog
 * below are deactivated, not deleted.
 *
 * test=false everywhere: merchants get REAL charges. Test charges happen
 * per-shop (dev stores automatically, or via admin flags) — see
 * App\Models\Plan::isTest().
 */
class PlansTableSeeder extends Seeder
{
    public function run(): void
    {
        $tiers = config('plans.tiers');

        $catalog = [
            // ===== FREE =====
            // Never sent to Shopify (zero-price subscriptions are rejected):
            // PriceController::selectPlan() applies it locally and cancels any
            // active paid subscription. No trial — the plan itself is free.
            [
                'name' => 'Free',
                'interval' => 'EVERY_30_DAYS',
                'price' => 0,
                'terms' => null,
                'trial_days' => 0,
                'on_install' => false,
                'is_popular' => false,
            ],
            // ===== MONTHLY =====
            [
                'name' => 'Basic',
                'interval' => 'EVERY_30_DAYS',
                'price' => 9.99,
                'terms' => null,
                'on_install' => true,
                'is_popular' => false,
            ],
            [
                'name' => 'Pro',
                'interval' => 'EVERY_30_DAYS',
                'price' => 29.99,
                'terms' => null,
                'on_install' => false,
                'is_popular' => true,
            ],
            [
                'name' => 'Unlimited',
                'interval' => 'EVERY_30_DAYS',
                'price' => 99.99,
                'terms' => null,
                'on_install' => false,
                'is_popular' => false,
            ],
            // ===== ANNUAL (~17% off) =====
            [
                'name' => 'Basic',
                'interval' => 'ANNUAL',
                'price' => 99.99, // vs 119.88 monthly-equivalent
                'terms' => 'Save 17% with annual billing',
                'on_install' => false,
                'is_popular' => false,
            ],
            [
                'name' => 'Pro',
                'interval' => 'ANNUAL',
                'price' => 299.99, // vs 359.88
                'terms' => 'Save 17% with annual billing',
                'on_install' => false,
                'is_popular' => true,
            ],
            [
                'name' => 'Unlimited',
                'interval' => 'ANNUAL',
                'price' => 999.99, // vs 1199.88
                'terms' => 'Save 17% with annual billing',
                'on_install' => false,
                'is_popular' => false,
            ],
        ];

        $seenIds = [];

        foreach ($catalog as $entry) {
            $tier = $tiers[$entry['name']] ?? [];

            $plan = Plan::updateOrCreate(
                [
                    'name' => $entry['name'],
                    'interval' => $entry['interval'],
                ],
                [
                    'type' => 'RECURRING',
                    'price' => $entry['price'],
                    'capped_amount' => null,
                    'terms' => $entry['terms'],
                    'trial_days' => $entry['trial_days'] ?? 7,
                    'test' => false,
                    'on_install' => $entry['on_install'],
                    'is_popular' => $entry['is_popular'],
                    'is_active' => true,
                    'max_locks' => $tier['max_locks'] ?? 5,
                    'description' => $tier['description'] ?? null,
                    'features' => $tier['features'] ?? [],
                ]
            );

            $seenIds[] = $plan->id;
        }

        // Retire anything not in the catalog (old/legacy plans) without
        // breaking shops still subscribed to them.
        Plan::whereNotIn('id', $seenIds)->update(['is_active' => false, 'on_install' => false]);

        $this->command?->info('Plan catalog seeded: '.count($seenIds).' active plans (upserted, legacy plans deactivated).');
    }
}
