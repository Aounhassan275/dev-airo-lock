<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Osiset\ShopifyApp\Objects\Values\ShopDomain;
use stdClass;
use App\Models\Collection;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class CollectionsDeleteJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Shop's myshopify domain
     *
     * @var ShopDomain
     */
    public $shopDomain;

    /**
     * The webhook data
     *
     * @var object
     */
    public $data;

    /**
     * Create a new job instance.
     *
     * @param string   $shopDomain The shop's myshopify domain.
     * @param stdClass $data       The webhook data (JSON decoded).
     *
     * @return void
     */
    public function __construct($shopDomain, $data)
    {
        $this->shopDomain = $shopDomain;
        $this->data = $data;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle()
    {
        // Convert domain
        $this->shopDomain = ShopDomain::fromNative($this->shopDomain);

        // Find the shop
        $shop = User::where('name', $this->shopDomain->toNative())->first();

        if (!$shop) {
            Log::error('Shop not found for domain: ' . $this->shopDomain->toNative());
            return;
        }

        // Extract collection data from webhook
        $collectionData = $this->data;

        if (!isset($collectionData->id)) {
            Log::warning('Collection delete webhook received without collection ID', [
                'shop' => $this->shopDomain->toNative(),
            ]);
            return;
        }

        // Get the Shopify collection ID (gid format)
        $shopifyCollectionId = 'gid://shopify/Collection/' . $collectionData->id;

        // Delete the collection
        $deleted = Collection::where('shopify_collection_id', $shopifyCollectionId)
            ->where('shop_id', $shop->id)
            ->delete();

        if ($deleted) {
            Log::info('Collection deleted', [
                'shop' => $this->shopDomain->toNative(),
                'collection_id' => $shopifyCollectionId,
            ]);
        } else {
            Log::warning('Collection not found for deletion', [
                'shop' => $this->shopDomain->toNative(),
                'collection_id' => $shopifyCollectionId,
            ]);
        }
    }
}
