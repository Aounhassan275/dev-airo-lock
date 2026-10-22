<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class AfterAuthenticateJob implements ShouldQueue
{
    use \Illuminate\Foundation\Bus\Dispatchable, \Illuminate\Queue\InteractsWithQueue, \Illuminate\Queue\SerializesModels, Queueable;

    protected $shop;

    /**
     * Create a new job instance.
     */
    public function __construct($shop)
    {
        $this->shop = $shop;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $result = app(\App\Services\StoreDetailSync::class)->sync($this->shop);

        if (! $result['ok']) {
            // The sync service already logged the reason. Bail without welcome.
            return;
        }

        $storeDetail = $result['storeDetail'];

        // Automatically assign Elite plan to user if not already set
        $elitePlan = \Osiset\ShopifyApp\Storage\Models\Plan::where('name', 'like', '%Elite%')->first();
        if ($elitePlan && ! $this->shop->plan_id) {
            $this->shop->plan_id = $elitePlan->id;
            $this->shop->shopify_freemium = 0;
            $this->shop->save();
        }

        // Welcome the merchant. A pre-existing StoreDetail row (it survives
        // uninstall) means this is a reinstall rather than a fresh install.
        $this->shop->setRelation('storeDetail', $storeDetail);
        app(\App\Services\MailService::class)->welcome(
            $this->shop,
            ! $storeDetail->wasRecentlyCreated
        );
    }
}
