<?php

namespace App\Jobs;

use App\Models\Product;
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

    public $timeout = 1200; // 20 minutes
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
                'after' => $this->cursor
            ]);

            if (!isset($response['body']['data']['products'])) {
                Log::error('Product sync failed: Invalid response', ['shop_id' => $shop->id, 'response' => $response]);
                return;
            }

            $data = $response['body']['data']['products'];

            foreach ($data['nodes'] as $p) {
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
                        'tags' => json_encode($p['tags']),
                        'handle' => $p['handle'] ?? null,
                    ]
                );
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
                'cursor' => $this->cursor
            ]);
            throw $e;
        }
    }
}
