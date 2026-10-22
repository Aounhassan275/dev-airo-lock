<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Contracts\ShopModel as IShopModel;
use Osiset\ShopifyApp\Objects\Transfers\PlanDetails as PlanDetailsTransfer;
use Osiset\ShopifyApp\Services\ChargeHelper;
use Osiset\ShopifyApp\Storage\Models\Plan;

/**
 * Drop-in replacement for the package ChargeHelper (bound in
 * AppServiceProvider). This is THE single point where the Shopify charge
 * payload is built — for monthly (REST), annual (GraphQL) and activation —
 * so the test-charge decision is made here from the EXPLICIT shop the
 * package passes in, never from ambient auth state.
 *
 * Policy: real merchants get real charges. TEST charges only for
 * development stores, admin-flagged shops, or global admin test mode.
 */
class ShopifyChargeHelper extends ChargeHelper
{
    public function details(Plan $plan, IShopModel $shop, string $host): PlanDetailsTransfer
    {
        $transfer = parent::details($plan, $shop, $host);

        $test = (bool) $transfer->test; // plan-level flag (via Plan::isTest)

        if (! $test && $shop instanceof User) {
            $test = app(BillingService::class)->chargesWouldBeTest($shop);
        }

        $transfer->test = $test;

        // Ground truth for every charge we send to Shopify — if a charge
        // ever comes out with the wrong type, this line says why.
        Log::info('[Billing] building Shopify charge', [
            'shop' => method_exists($shop, 'getDomain') ? $shop->getDomain()->toNative() : ($shop->name ?? '?'),
            'plan' => $plan->name.' ('.($plan->interval ?? '').')',
            'price' => $plan->price,
            'TEST_CHARGE' => $test,
            'inputs' => $shop instanceof User ? [
                'plan_test_flag' => (bool) $plan->test,
                'global_test_mode' => (bool) \App\Models\Setting::get('billing_test_mode', false),
                'allow_test_charges' => (bool) $shop->allow_test_charges,
                'is_dev_store' => $shop->isDevStore(),
                'partner_development' => $shop->storeDetail?->partner_development,
                'store_plan_name' => $shop->storeDetail?->plan_name,
            ] : ['shop_model' => get_class($shop)],
        ]);

        return $transfer;
    }
}
