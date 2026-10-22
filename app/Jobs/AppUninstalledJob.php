<?php

namespace App\Jobs;

class AppUninstalledJob extends \Osiset\ShopifyApp\Messaging\Jobs\AppUninstalledJob
{
    public function handle(
        \Osiset\ShopifyApp\Contracts\Commands\Shop $shopCommand,
        \Osiset\ShopifyApp\Contracts\Queries\Shop $shopQuery,
        \Osiset\ShopifyApp\Actions\CancelCurrentPlan $cancelCurrentPlanAction
    ): bool {
        // Resolve the domain
        $domain = \Osiset\ShopifyApp\Objects\Values\ShopDomain::fromNative($this->domain);
        $shop = $shopQuery->getByDomain($domain);

        if ($shop) {
            $shopId = $shop->getId()->toNative();

            // Capture recipient before the shop's data is torn down.
            $detail = \App\Models\StoreDetail::where('user_id', $shopId)->first();
            $email = $detail->email ?? $shop->email ?? null;
            $shopName = $detail->shop_name ?? null;

            // StoreDetail survives the wipe below — stamp the lifecycle state
            // so the admin can see WHEN each shop churned (partner-dashboard
            // "installed for 2 days on a high plan" pattern). Best-effort:
            // a telemetry failure must never block the uninstall wipe.
            try {
                $detail?->applyStoreStatus(
                    \App\Models\StoreDetail::STATUS_UNINSTALLED,
                    'app/uninstalled webhook'
                );
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('[StoreStatus] uninstall stamp failed', [
                    'shop' => $this->domain,
                    'error' => $e->getMessage(),
                ]);
            }

            // Delete Access Logs (via Access Rules)
            $accessRuleIds = \App\Models\AccessRule::where('shop_id', $shopId)->pluck('id');
            \App\Models\AccessLog::whereIn('access_rule_id', $accessRuleIds)->delete();

            // Delete Access Rules
            \App\Models\AccessRule::where('shop_id', $shopId)->delete();

            // Delete Widgets (associated via user_id)
            \App\Models\Widget::where('user_id', $shopId)->delete();

            // Delete Onboarding Status
            \App\Models\Onboarding::where('user_id', $shopId)->delete();

            // Delete Locks
            \App\Models\Lock::where('shop_id', $shopId)->delete();

            // Delete Products and Variants
            \App\Models\Product::where('shop_id', $shopId)->delete();
            \App\Models\Variant::where('shop_id', $shopId)->delete();

            // Delete other shop relates resources
            \App\Models\Blog::where('shop_id', $shopId)->delete();
            \App\Models\Collection::where('shop_id', $shopId)->delete();
            \App\Models\Page::where('shop_id', $shopId)->delete();
            \App\Models\Store::where('shop_id', $shopId)->delete();
            \App\Models\Theme::where('shop_id', $shopId)->delete();

            app(\App\Services\MailService::class)->uninstall($email, $shopName);
        }

        return parent::handle($shopCommand, $shopQuery, $cancelCurrentPlanAction);
    }
}
