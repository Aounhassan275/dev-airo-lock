<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Every Shopify charge (create + activate, REST + GraphQL) is built
        // through ChargeHelper::details(). Our subclass decides the TEST
        // flag from the shop object itself — dev stores / admin-flagged
        // shops always get test charges, real merchants never do.
        $this->app->bind(
            \Osiset\ShopifyApp\Services\ChargeHelper::class,
            \App\Services\ShopifyChargeHelper::class
        );
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
