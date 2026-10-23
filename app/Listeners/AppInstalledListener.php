<?php

namespace App\Listeners;

use App\Jobs\ProductFetchJob;
use App\Models\Lock;
use App\Models\Onboarding;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Contracts\Queries\Shop as IShopQuery;
use Osiset\ShopifyApp\Messaging\Events\AppInstalledEvent;

class AppInstalledListener
{
    public function handle(AppInstalledEvent $event): void
    {
        $shopQuery = app(IShopQuery::class);
        $shop = $shopQuery->getById($event->shopId);

        if ($shop) {
            Log::info('AppInstalledListener: Dispatching sync jobs', [
                'shop_id' => $shop->id,
                'shop_domain' => $shop->name,
            ]);

            // Show onboarding on (re)install. The uninstall webhook deletes the
            // onboarding record, but it runs on the queue, so a reinstall can
            // arrive while the old "completed" row is still there. Done inline
            // here, and only for a store with no locks, so a re-authentication
            // never sends a merchant who is using the app back into setup.
            if (! Lock::where('shop_id', $shop->id)->exists()) {
                Onboarding::updateOrCreate(['user_id' => $shop->id], ['status' => 0]);
            }

            ProductFetchJob::dispatch($shop);
            \App\Jobs\AfterAuthenticateJob::dispatch($shop);
        }
    }
}
