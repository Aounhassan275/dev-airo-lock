<?php

namespace App\Jobs;

use App\Http\Controllers\AccessLockcontroller;
use App\Models\Lock;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Background retry for storefront metafield sync (see
 * AccessLockcontroller::syncMetafieldsWithRetry).
 *
 * A lock save never fails because Shopify throttled us or the local resource
 * cache was stale — the DB is committed and this job keeps retrying the
 * storefront write with backoff until the metafields match the DB. Throwing
 * on partial failure is what re-queues the job (see $tries/backoff()).
 */
class SyncLockMetafieldsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 6;

    public function __construct(
        public int $shopId,
        public int $lockId,
    ) {}

    /** @return int[] seconds before each retry */
    public function backoff(): array
    {
        return [60, 180, 600, 1800, 3600];
    }

    public function handle(): void
    {
        $shop = User::find($this->shopId);
        $lock = Lock::with('accessRules')->find($this->lockId);

        if (!$shop) {
            return;
        }

        $controller = app(AccessLockcontroller::class);

        // Lock deleted since the save — just refresh the global config so the
        // storefront stops enforcing it.
        if (!$lock) {
            $controller->updateGlobalMetafield($shop);
            return;
        }

        // No global rewrite here: the controller that dispatched this job
        // already wrote the global config from the same DB state, and it is
        // the largest payload in the system — re-sending it on every retry
        // would burn the very rate-limit budget the per-rule retries need.
        $failures = $controller->syncLockRulesToMetafields($shop, $lock);

        if (!empty($failures)) {
            Log::warning('[LockSync] retry attempt still incomplete', [
                'shop_id' => $this->shopId,
                'lock_id' => $this->lockId,
                'attempt' => $this->attempts(),
                'failures' => $failures,
            ]);

            throw new \RuntimeException(
                "Lock {$this->lockId} metafield sync incomplete: " . implode('; ', $failures)
            );
        }

        Log::info('[LockSync] retry completed — storefront in sync', [
            'shop_id' => $this->shopId,
            'lock_id' => $this->lockId,
            'attempt' => $this->attempts(),
        ]);
    }

    public function failed(\Throwable $e): void
    {
        Log::error('[LockSync] giving up after max retries — storefront may be out of sync', [
            'shop_id' => $this->shopId,
            'lock_id' => $this->lockId,
            'error' => $e->getMessage(),
        ]);
    }
}
