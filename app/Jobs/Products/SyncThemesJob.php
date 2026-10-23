<?php

namespace App\Jobs\Products;

use App\Models\Theme;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncThemesJob implements ShouldQueue
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
        $first = 50;

        $query = <<<'GQL'
        query GetThemes($first:Int!, $after:String) {
            themes(first: $first, after: $after) {
                pageInfo { hasNextPage endCursor }
                edges {
                    node {
                        id
                        name
                        role
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

            if (!isset($response['body']['data']['themes'])) {
                Log::error('Theme sync failed: Invalid response', ['shop_id' => $shop->id, 'response' => $response]);
                $shop->forgetRevokedAccessToken($response);

                // Throw rather than return: a silent return made a manual refresh
                // report "Updated from Shopify" with nothing fetched.
                throw new \RuntimeException('Shopify returned no themes data: '.json_encode($response['body']['errors'] ?? $response['errors'] ?? null));
            }

            $data = $response['body']['data']['themes'];

            foreach ($data['edges'] as $t) {
                Theme::updateOrCreate(
                    [
                        'shop_id' => $shop->id,
                        'shopify_theme_id' => $t['node']['id'],
                    ],
                    [
                        'name' => $t['node']['name'],
                        'role' => $t['node']['role'],
                    ]
                );
            }

            if ($data['pageInfo']['hasNextPage']) {
                self::dispatch($shop, $data['pageInfo']['endCursor']);
            } else {
                Log::info('Theme sync completed for shop', ['shop_id' => $shop->id]);
            }
        } catch (\Exception $e) {
            Log::error('Theme sync failed', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage(),
                'cursor' => $this->cursor
            ]);
            throw $e;
        }
    }
}
