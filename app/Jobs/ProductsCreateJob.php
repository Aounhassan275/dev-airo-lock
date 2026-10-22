<?php

namespace App\Jobs;

use App\Models\Product;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Objects\Values\ShopDomain;
use stdClass;

class ProductsCreateJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Shop's myshopify domain (string as received from webhook)
     *
     * @var string
     */
    public string $shopDomainNative;

    /**
     * ShopDomain value object
     *
     * @var ShopDomain
     */
    public ShopDomain $shopDomain;

    /**
     * The webhook data
     *
     * @var stdClass
     */
    public stdClass $data;

    /**
     * Create a new job instance.
     *
     * @param string   $shopDomain The shop's myshopify domain.
     * @param stdClass $data       The webhook data (JSON decoded).
     */
    public function __construct(string $shopDomain, stdClass $data)
    {
        $this->shopDomainNative = $shopDomain;
        $this->data = $data;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        /**
         * Convert domain string to ShopDomain object
         */
        $this->shopDomain = ShopDomain::fromNative($this->shopDomainNative);

        /**
         * Find the shop
         */
        $shop = User::where('name', $this->shopDomain->toNative())->first();

        if (!$shop) {
            Log::error('Shop not found for domain: ' . $this->shopDomain->toNative());
            return;
        }

        /**
         * Shopify product data
         */
        $productData = $this->data;

        /**
         * Shopify GID
         */
        $shopifyProductId = 'gid://shopify/Product/' . $productData->id;

        /**
         * Get image URL safely
         */
        $imageUrl = null;

        if (!empty($productData->images) && is_array($productData->images)) {
            $firstImage = $productData->images[0] ?? null;
            if (is_object($firstImage) && isset($firstImage->src) && is_string($firstImage->src)) {
                $imageUrl = $firstImage->src;
            }
        } elseif (isset($productData->image) && is_object($productData->image)) {
            if (isset($productData->image->src) && is_string($productData->image->src)) {
                $imageUrl = $productData->image->src;
            }
        }

        /**
         * Process tags
         */
        $tags = null;

        if (isset($productData->tags)) {
            if (is_string($productData->tags)) {
                $tags = array_map('trim', explode(',', $productData->tags));
            } elseif (is_array($productData->tags)) {
                $tags = $productData->tags;
            } elseif (is_object($productData->tags)) {
                $tags = json_decode(json_encode($productData->tags), true);
            }
        }

        /**
         * Safe scalar values
         */
        $title = isset($productData->title) && is_string($productData->title)
            ? $productData->title
            : '';

        $vendor = isset($productData->vendor) && is_string($productData->vendor)
            ? $productData->vendor
            : null;

        $handle = isset($productData->handle) && is_string($productData->handle)
            ? $productData->handle
            : null;

        $productType = isset($productData->product_type) && is_string($productData->product_type)
            ? $productData->product_type
            : null;

        /**
         * Create or update product
         */
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
    }
}
