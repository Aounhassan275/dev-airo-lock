<?php

namespace App\Jobs\Products;

use App\Models\Product;
use App\Models\Variant;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncProductsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $shop;

    protected $cursor;

    public $timeout = 1200;  // 20 minutes

    public $tries = 3;

    public function __construct($shop, $cursor = null)
    {
        $this->shop = $shop;
        $this->cursor = $cursor;
    }

    public function handle(): void
    {
        $shop = $this->shop;
        $first = 200;

        $query = <<<'GQL'
            query GetProducts($first:Int!, $after:String) {
                products(first: $first, after: $after) {
                    pageInfo { hasNextPage endCursor }
                    nodes {
                        id
                        title
                        tags
                        vendor
                        productType
                        handle
                        variants(first: 50) {
                            pageInfo { hasNextPage endCursor }
                            nodes {
                                id
                                title
                            }
                        }
                        media(first: 1) {
                            edges {
                                node {
                                    ...on MediaImage {
                                        image { url }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            GQL;

        try {
            $response = $shop->api()->graph($query, [
                'first' => $first,
                'after' => $this->cursor,
            ]);

            if (! isset($response['body']['data']['products'])) {
                Log::error('Product sync failed: Invalid response', ['shop_id' => $shop->id, 'response' => $response]);

                return;
            }

            $data = $response['body']['data']['products'];

            // The Shopify SDK returns nested ResponseAccess objects, not plain PHP
            // arrays. The is_array() guards in the variant code below return false
            // for those objects, which silently skipped every variant (logs showed
            // "Found 0 variants" for products that have variants). Normalize the
            // response to plain arrays once so variant collection works.
            $data = json_decode(json_encode($data), true);

            foreach ($data['nodes'] as $p) {
                // Initialize variants array correctly
                $variants = [];

                // Get initial variants from the product query
                if (isset($p['variants']['nodes']) && is_array($p['variants']['nodes'])) {
                    // Use array_values to ensure we have a clean indexed array
                    foreach ($p['variants']['nodes'] as $node) {
                        if (is_array($node) || is_object($node)) {
                            $variants[] = (array) $node;
                        }
                    }
                }

                $variantPageInfo = $p['variants']['pageInfo'] ?? null;

                // Handle variants pagination
                if ($variantPageInfo && $variantPageInfo['hasNextPage']) {
                    $cursor = $variantPageInfo['endCursor'];
                    while ($cursor) {
                        $variantQuery = <<<'GQL'
                            query GetVariants($id: ID!, $cursor: String) {
                                product(id: $id) {
                                    variants(first: 50, after: $cursor) {
                                        pageInfo { hasNextPage endCursor }
                                        nodes {
                                            id
                                            title
                                        }
                                    }
                                }
                            }
                            GQL;

                        $variantResponse = $shop->api()->graph($variantQuery, [
                            'id' => $p['id'],
                            'cursor' => $cursor,
                        ]);

                        $variantData = $variantResponse['body']['data']['product']['variants'] ?? null;
                        // Normalize ResponseAccess -> plain arrays (see note above).
                        $variantData = $variantData !== null ? json_decode(json_encode($variantData), true) : null;

                        if ($variantData && isset($variantData['nodes']) && is_array($variantData['nodes'])) {
                            // Add each variant node to the array
                            foreach ($variantData['nodes'] as $node) {
                                if (is_array($node) || is_object($node)) {
                                    $variants[] = (array) $node;
                                }
                            }

                            if ($variantData['pageInfo']['hasNextPage']) {
                                $cursor = $variantData['pageInfo']['endCursor'];
                            } else {
                                $cursor = null;
                            }
                        } else {
                            $cursor = null;
                        }
                    }
                }

                Product::updateOrCreate(
                    [
                        'shop_id' => $shop->id,
                        'shopify_product_id' => $p['id'],
                    ],
                    [
                        'title' => $p['title'],
                        'vendor' => $p['vendor'] ?? null,
                        'product_type' => $p['productType'] ?? null,
                        'image_url' => $p['media']['edges'][0]['node']['image']['url'] ?? null,
                        'tags' => $p['tags'],
                        'handle' => $p['handle'] ?? null,
                    ]
                );

                foreach ($variants as $variant) {
                    // Ensure variant is an array
                    if (! is_array($variant)) {
                        Log::warning("Skipping non-array variant for product {$p['id']}", ['variant' => $variant]);

                        continue;
                    }

                    if (! isset($variant['id'])) {
                        Log::warning("Skipping variant without ID for product {$p['id']}", ['variant' => $variant]);

                        continue;
                    }

                    try {
                        Variant::updateOrCreate(
                            [
                                'shop_id' => $shop->id,
                                'variant_id' => $variant['id'],  // Shopify Variant GID
                            ],
                            [
                                'shopify_product_id' => $p['id'],
                                'title' => $variant['title'] ?? '',
                            ]
                        );
                    } catch (\Exception $e) {
                        Log::error("Failed to save variant {$variant['id']} for product {$p['id']}: ".$e->getMessage());
                    }
                }
            }

            if ($data['pageInfo']['hasNextPage']) {
                self::dispatch($shop, $data['pageInfo']['endCursor']);
            } else {
                Log::info('Product sync completed for shop', ['shop_id' => $shop->id]);
            }
        } catch (\Exception $e) {
            Log::error('Product sync failed', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage(),
                'cursor' => $this->cursor,
            ]);
            throw $e;
        }
    }
}
