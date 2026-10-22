<?php

namespace App\Jobs;

use App\Http\Controllers\AccessLockcontroller;
use App\Models\Lock;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ExpireLocksJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Create a new job instance.
     */
    public function __construct()
    {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $expiredLocks = Lock::whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->where('status', true)  // Only active locks? Or all? Probably all to clean up.
            ->get();

        if ($expiredLocks->isEmpty()) {
            return;
        }

        $controller = app(AccessLockcontroller::class);
        $touchedShops = [];

        foreach ($expiredLocks as $lock) {
            try {
                $shop = \App\Models\User::find($lock->shop_id);
                if (!$shop) {
                    Log::error('ExpireLocksJob: Shop not found for lock ' . $lock->id);
                    continue;
                }

                // Capture before rules/lock are removed, for the email below.
                $lockName = $lock->name;
                $itemCount = $lock->accessRules->count();
                $expiredAt = $lock->expires_at;

                foreach ($lock->accessRules as $rule) {
                    // Surgical removal of THIS lock's entry from the resource's
                    // locks[] array. The old REST implementation deleted the
                    // whole metafield object, which silently destroyed
                    // enforcement for every OTHER lock sharing the resource.
                    $controller->removeMetafield($shop, $rule);
                    $rule->delete();
                }

                $lock->delete();
                $touchedShops[$shop->id] = $shop;
                Log::info('ExpireLocksJob: Lock ' . $lock->id . ' deleted successfully.');

                app(\App\Services\MailService::class)
                    ->lockExpired($shop, $lockName, $itemCount, $expiredAt);
            } catch (\Exception $e) {
                Log::error('ExpireLocksJob: Failed to delete lock ' . $lock->id, ['error' => $e->getMessage()]);
            }
        }

        // Keep the shop-level global config in step with the deletions so the
        // storefront's global fallback stops enforcing expired locks too.
        foreach ($touchedShops as $shop) {
            try {
                $controller->updateGlobalMetafield($shop);
            } catch (\Exception $e) {
                Log::error('ExpireLocksJob: global metafield refresh failed', [
                    'shop_id' => $shop->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
