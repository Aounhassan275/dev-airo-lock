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

class ProductsDeleteJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Shop's myshopify domain (string from webhook)
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
         * Extract product data
         */
        $productData = $this->data;

        /**
         * Shopify GID
         */
        if (!isset($productData->id)) {
            Log::warning('Product delete webhook received without product ID', [
                'shop' => $this->shopDomain->toNative(),
            ]);
            return;
        }

        $shopifyProductId = 'gid://shopify/Product/' . $productData->id;

        /**
         * Delete product
         */
        $deleted = Product::where('shopify_product_id', $shopifyProductId)
            ->where('shop_id', $shop->id)
            ->delete();

        if ($deleted) {
            Log::info('Product deleted', [
                'shop' => $this->shopDomain->toNative(),
                'product_id' => $shopifyProductId,
            ]);
        } else {
            Log::warning('Product not found for deletion', [
                'shop' => $this->shopDomain->toNative(),
                'product_id' => $shopifyProductId,
            ]);
        }
    }
}
