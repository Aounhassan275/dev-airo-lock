<?php

namespace App\Jobs\Products;

use App\Models\Collection;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncCollectionsJob implements ShouldQueue
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
        query GetCollections($first:Int!, $after:String) {
            collections(first: $first, after: $after) {
                pageInfo { hasNextPage endCursor }
                nodes {
                    id
                    title
                    handle
                    productsCount { count }
                }
            }
        }
        GQL;

        try {
            $response = $shop->api()->graph($query, [
                'first' => $first,
                'after' => $this->cursor
            ]);

            if (!isset($response['body']['data']['collections'])) {
                Log::error('Collection sync failed: Invalid response', ['shop_id' => $shop->id, 'response' => $response]);
                return;
            }

            $data = $response['body']['data']['collections'];

            foreach ($data['nodes'] as $c) {
                Collection::updateOrCreate(
                    [
                        'shop_id' => $shop->id,
                        'shopify_collection_id' => $c['id'],
                    ],
                    [
                        'title' => $c['title'],
                        'handle' => $c['handle'],
                        'products_count' => $c['productsCount']['count'],
                    ]
                );
            }

            if ($data['pageInfo']['hasNextPage']) {
                self::dispatch($shop, $data['pageInfo']['endCursor']);
            } else {
                Log::info('Collection sync completed for shop', ['shop_id' => $shop->id]);
            }
        } catch (\Exception $e) {
            Log::error('Collection sync failed', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage(),
                'cursor' => $this->cursor
            ]);
            throw $e;
        }
    }
}
