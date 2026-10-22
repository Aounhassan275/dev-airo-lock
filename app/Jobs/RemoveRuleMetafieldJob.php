<?php

namespace App\Jobs;

use App\Http\Controllers\AccessLockcontroller;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Background retry for removing one lock's entry from a resource's
 * storefront metafield AFTER the DB rows are gone (lock deleted, or a
 * resource deselected during an edit). Without this, a transient Shopify
 * failure during cleanup left a stale metafield entry enforcing a lock the
 * admin no longer shows — the storefront reads the per-resource metafield
 * FIRST, so the global-config rebuild alone does not stop enforcement.
 */
class RemoveRuleMetafieldJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 6;

    public function __construct(
        public int $shopId,
        public string $resourceType,
        public ?string $handle,
        public int $lockId,
        public array $ruleIds,
    ) {}

    /** @return int[] seconds before each retry */
    public function backoff(): array
    {
        return [60, 180, 600, 1800, 3600];
    }

    public function handle(): void
    {
        $shop = User::find($this->shopId);
        if (!$shop) {
            return;
        }

        $result = app(AccessLockcontroller::class)->removeLockFromResourceMetafield(
            $shop,
            $this->resourceType,
            $this->handle,
            $this->lockId,
            $this->ruleIds
        );

        // Resource gone from Shopify = nothing left to clean.
        if (($result['success'] ?? false) || ($result['code'] ?? '') === 'not_found') {
            Log::info('[LockSync] stale metafield entry removed', [
                'shop_id' => $this->shopId,
                'resource_type' => $this->resourceType,
                'handle' => $this->handle,
                'lock_id' => $this->lockId,
            ]);

            return;
        }

        throw new \RuntimeException(
            "Metafield cleanup incomplete for {$this->resourceType} \"{$this->handle}\" (lock {$this->lockId}): "
            . (is_string($result['error'] ?? null) ? $result['error'] : json_encode($result['errors'] ?? 'unknown error'))
        );
    }

    public function failed(\Throwable $e): void
    {
        Log::error('[LockSync] giving up on metafield cleanup — stale entry may still enforce on the storefront', [
            'shop_id' => $this->shopId,
            'resource_type' => $this->resourceType,
            'handle' => $this->handle,
            'lock_id' => $this->lockId,
            'error' => $e->getMessage(),
        ]);
    }
}
