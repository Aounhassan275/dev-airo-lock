<?php

namespace App\Jobs;

use App\Models\Collection;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Objects\Values\ShopDomain;
use stdClass;

class CollectionsUpdateJob implements ShouldQueue
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

        // Log the entire webhook payload for debugging
        // Log::info('Collection webhook payload received', [
        //     'shop'     => $this->shopDomain->toNative(),
        //     'raw_data' => json_encode($collectionData),
        // ]);

        // Get the Shopify collection ID
        // Use admin_graphql_api_id if available, otherwise construct from id
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
                // Note: If using osiset/laravel-shopify, api()->rest() is the method
                $response = $shop->api()->rest('GET', "/admin/api/2024-04/collections/{$numericId}.json");

                if (!$response['errors'] && isset($response['body']['collection'])) {
                    $remoteCollection = $response['body']['collection'];
                    $productsCount = $remoteCollection['products_count'] ?? 0;
                    $title = $remoteCollection['title'] ?? $title;
                    $handle = $remoteCollection['handle'] ?? $handle;
                } else {
                    Log::warning('Could not fetch collection from REST API', [
                        'collection_id' => $shopifyCollectionId,
                        'numeric_id' => $numericId,
                        'response' => json_encode($response),
                    ]);
                }
            } else {
                Log::warning('Could not parse numeric ID for REST API', [
                    'collection_id' => $shopifyCollectionId,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to fetch collection details from Shopify API', [
                'collection_id' => $shopifyCollectionId,
                'error' => $e->getMessage(),
            ]);
        }

        // Log::info('Collection data extracted', [
        //     'shop'                     => $this->shopDomain->toNative(),
        //     'collection_id'            => $shopifyCollectionId,
        //     'title'                    => $title,
        //     'handle'                   => $handle,
        //     'products_count'           => $productsCount,
        //     'has_products_count_field' => isset($collectionData->products_count),
        // ]);

        // Create or update the collection
        $collection = Collection::updateOrCreate(
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

        Log::info('Collection saved to database', [
            'shop' => $this->shopDomain->toNative(),
            'collection_id' => $shopifyCollectionId,
            'db_products_count' => $collection->products_count,
        ]);
    }
}
