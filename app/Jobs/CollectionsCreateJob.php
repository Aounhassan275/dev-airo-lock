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

class CollectionsCreateJob implements ShouldQueue
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

        // Get the Shopify collection ID (gid format)
        $shopifyCollectionId = isset($collectionData->admin_graphql_api_id)
            ? $collectionData->admin_graphql_api_id
            : 'gid://shopify/Collection/' . $collectionData->id;

        $title = isset($collectionData->title) ? $collectionData->title : '';
        $handle = isset($collectionData->handle) ? $collectionData->handle : null;

        // Fetch products_count from Shopify API since it's not in webhook
        $productsCount = 0;

        try {
            // Use REST API to fetch collection details as it reliably includes products_count
            // The collected ID from webhook is numeric, needed for REST
            $collectionIdMatches = [];
            if (preg_match('/Collection\/(\d+)$/', $shopifyCollectionId, $collectionIdMatches)) {
                $numericId = $collectionIdMatches[1];

                // Try fetching using the generic collections endpoint which works for both custom and smart
                $response = $shop->api()->rest('GET', "/admin/api/2024-04/collections/{$numericId}.json");

                if (!$response['errors'] && isset($response['body']['collection'])) {
                    $remoteCollection = $response['body']['collection'];
                    $productsCount = $remoteCollection['products_count'] ?? 0;
                    $title = $remoteCollection['title'] ?? $title;
                    $handle = $remoteCollection['handle'] ?? $handle;
                }
            }
        } catch (\Exception $e) {
            Log::error('Failed to fetch collection details from Shopify API', [
                'collection_id' => $shopifyCollectionId,
                'error' => $e->getMessage(),
            ]);
        }

        // Create or update the collection
        Collection::updateOrCreate(
            [
                'shopify_collection_id' => $shopifyCollectionId,
            ],
            [
                'shop_id' => $shop->id,
                'title' => $title,
                'handle' => $handle,
                'products_count' => $productsCount,
            ]
        );
    }
}
