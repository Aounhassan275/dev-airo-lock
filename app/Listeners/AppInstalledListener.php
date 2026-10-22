<?php

namespace App\Listeners;

use App\Jobs\ProductFetchJob;
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

            ProductFetchJob::dispatch($shop);
            \App\Jobs\AfterAuthenticateJob::dispatch($shop);
        }
    }
}
