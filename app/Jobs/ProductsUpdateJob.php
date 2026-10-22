<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Osiset\ShopifyApp\Objects\Values\ShopDomain;
use stdClass;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class ProductsUpdateJob implements ShouldQueue
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

        // Extract product data from webhook
        $productData = $this->data;
        // Log::info('Product data: ' . json_encode($productData));

        // Get the Shopify product ID (gid format)
        $shopifyProductId = 'gid://shopify/Product/' . $productData->id;

        // Get the first image URL if available - PROPERLY handle objects
        $imageUrl = null;
        if (isset($productData->images) && is_array($productData->images) && count($productData->images) > 0) {
            $firstImage = $productData->images[0];
            if (is_object($firstImage) && isset($firstImage->src)) {
                $imageUrl = is_string($firstImage->src) ? $firstImage->src : null;
            }
        } elseif (isset($productData->image)) {
            if (is_object($productData->image) && isset($productData->image->src)) {
                $imageUrl = is_string($productData->image->src) ? $productData->image->src : null;
            }
        }

        // Process tags
        $tags = null;
        if (isset($productData->tags)) {
            if (is_string($productData->tags)) {
                // Tags come as comma-separated string from Shopify
                $tags = array_map('trim', explode(',', $productData->tags));
            } elseif (is_array($productData->tags)) {
                $tags = $productData->tags;
            } elseif (is_object($productData->tags)) {
                // Convert stdClass to array
                $tags = json_decode(json_encode($productData->tags), true);
            }
        }

        // Ensure all values are properly typed (strings or null)
        $title = isset($productData->title) && is_string($productData->title) ? $productData->title : '';
        $vendor = isset($productData->vendor) && is_string($productData->vendor) ? $productData->vendor : null;
        $handle = isset($productData->handle) && is_string($productData->handle) ? $productData->handle : null;
        $productType = isset($productData->product_type) && is_string($productData->product_type) ? $productData->product_type : null;

        // Create or update the product
        Product::updateOrCreate(
            [
                'shop_id' => $shop->id,
                'shopify_product_id' => $shopifyProductId,
            ],
            [
                'title' => $title,
                'vendor' => $vendor,
                'handle' => $handle,
                'product_type' => $productType,
                'image_url' => $imageUrl,
                'tags' => !empty($tags) ? json_encode($tags) : null,
            ]
        );

        // Log::info('Product synced: ' . $shopifyProductId . ' for shop: ' . $this->shopDomain->toNative());
    }
}
