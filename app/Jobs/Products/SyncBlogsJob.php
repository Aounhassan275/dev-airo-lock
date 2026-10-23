<?php

namespace App\Jobs\Products;

use App\Models\Blog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncBlogsJob implements ShouldQueue
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
        query GetBlogs($first:Int!, $after:String) {
            blogs(first: $first, after: $after) {
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

            if (!isset($response['body']['data']['blogs'])) {
                Log::error('Blog sync failed: Invalid response', ['shop_id' => $shop->id, 'response' => $response]);
                $shop->forgetRevokedAccessToken($response);

                // Throw rather than return: a silent return made a manual refresh
                // report "Updated from Shopify" with nothing fetched.
                throw new \RuntimeException('Shopify returned no blogs data: '.json_encode($response['body']['errors'] ?? $response['errors'] ?? null));
            }

            $data = $response['body']['data']['blogs'];

            foreach ($data['nodes'] as $b) {
                Blog::updateOrCreate(
                    [
                        'shop_id' => $shop->id,
                        'shopify_blog_id' => $b['id'],
                    ],
                    [
                        'title' => $b['title'],
                        'handle' => $b['handle'],
                    ]
                );
            }

            if ($data['pageInfo']['hasNextPage']) {
                self::dispatch($shop, $data['pageInfo']['endCursor']);
            } else {
                Log::info('Blog sync completed for shop', ['shop_id' => $shop->id]);
            }
        } catch (\Exception $e) {
            Log::error('Blog sync failed', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage(),
                'cursor' => $this->cursor
            ]);
            throw $e;
        }
    }
}
