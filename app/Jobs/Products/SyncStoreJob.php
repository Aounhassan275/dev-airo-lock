<?php

namespace App\Jobs\Products;

use App\Models\Store;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncStoreJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $shop;

    public $timeout = 600;
    public $tries = 3;

    public function __construct($shop)
    {
        $this->shop = $shop;
    }

    public function handle(): void
    {
        $shop = $this->shop;

        $query = <<<'GQL'
        {
            shop {
                id
                name
                primaryDomain {
                    url
                }
            }
        }
        GQL;

        try {
            $response = $shop->api()->graph($query);

            if (!isset($response['body']['data']['shop'])) {
                Log::error('Store sync failed: Invalid response', [
                    'shop_id' => $shop->id,
                    'status' => $response['status'] ?? null,
                    'errors' => $response['errors'] ?? null,
                    'body' => isset($response['body']) ? (method_exists($response['body'], 'toArray') ? $response['body']->toArray() : $response['body']) : null,
                    'has_password' => !empty($shop->password),
                ]);
                return;
            }

            $data = $response['body']['data']['shop'];

            Store::updateOrCreate(
                [
                    'shop_id' => $shop->id,
                ],
                [
                    'shopify_store_id' => $data['id'],
                    'name' => $data['name'],
                    'url' => $data['primaryDomain']['url'],
                ]
            );

            Log::info('Store sync completed', ['shop_id' => $shop->id]);
        } catch (\Exception $e) {
            Log::error('Store sync failed', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage()
            ]);
            throw $e;
        }
    }
}
