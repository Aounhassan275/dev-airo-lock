<?php

namespace App\Jobs\Products;

use App\Models\Page;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncPagesJob implements ShouldQueue
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
        query GetPages($first:Int!, $after:String) {
            pages(first: $first, after: $after) {
                pageInfo { hasNextPage endCursor }
                nodes { id title handle }
            }
        }
        GQL;

        try {
            $response = $shop->api()->graph($query, [
                'first' => $first,
                'after' => $this->cursor
            ]);

            if (!isset($response['body']['data']['pages'])) {
                Log::error('Page sync failed: Invalid response', ['shop_id' => $shop->id, 'response' => $response]);
                return;
            }

            $data = $response['body']['data']['pages'];

            foreach ($data['nodes'] as $p) {
                Page::updateOrCreate(
                    [
                        'shop_id' => $shop->id,
                        'shopify_page_id' => $p['id'],
                    ],
                    [
                        'title' => $p['title'],
                        'handle' => $p['handle'],
                    ]
                );
            }

            if ($data['pageInfo']['hasNextPage']) {
                self::dispatch($shop, $data['pageInfo']['endCursor']);
            } else {
                Log::info('Page sync completed for shop', ['shop_id' => $shop->id]);
            }
        } catch (\Exception $e) {
            Log::error('Page sync failed', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage(),
                'cursor' => $this->cursor
            ]);
            throw $e;
        }
    }
}
