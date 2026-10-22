<?php

namespace App\Jobs;

use App\Jobs\Products\SyncProductsJob;
use App\Jobs\Products\SyncCollectionsJob;
use App\Jobs\Products\SyncPagesJob;
use App\Jobs\Products\SyncBlogsJob;
use App\Jobs\Products\SyncThemesJob;
use App\Jobs\Products\SyncStoreJob;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class ProductFetchJob implements ShouldQueue
{
    use Queueable;

    protected $shop;

    public $timeout = 1200; // 20 minutes
    public $tries = 3;

    public function __construct($shop)
    {
        $this->shop = $shop;
    }

    public function handle(): void
    {
        Log::info('Starting full shop sync', ['shop_id' => $this->shop->id]);

        SyncStoreJob::dispatch($this->shop);
        SyncProductsJob::dispatch($this->shop);
        SyncCollectionsJob::dispatch($this->shop);
        SyncPagesJob::dispatch($this->shop);
        SyncBlogsJob::dispatch($this->shop);
        SyncThemesJob::dispatch($this->shop);
    }
}
