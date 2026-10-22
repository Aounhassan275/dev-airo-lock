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
 * Activates scheduled CHECKOUT locks at their starts_at.
 *
 * Checkout locks are gated server-side: syncLockRulesToMetafields writes a
 * checkout rule to the shop metafield only while the lock is active (the
 * Shopify validation Function has no reliable clock, so it can't gate the
 * schedule itself). A lock scheduled to start in the future is therefore
 * NOT in the metafield at save time; this every-minute job re-syncs those
 * whose start moment has just passed so enforcement begins on time.
 *
 * Expiry is handled by ExpireLocksJob (it removes the metafield entry and
 * deletes the lock), so this job only needs to cover the activation edge.
 * Runs on a short trailing window so the work stays bounded to locks that
 * actually just crossed their start.
 */
class ReconcileCheckoutSchedulesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Trailing window (minutes) — wide enough to absorb a few missed ticks. */
    private const WINDOW_MINUTES = 15;

    public function handle(): void
    {
        $justStarted = Lock::query()
            ->where('status', true)
            ->whereNotNull('starts_at')
            ->where('starts_at', '<=', now())
            ->where('starts_at', '>=', now()->subMinutes(self::WINDOW_MINUTES))
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->whereHas('accessRules', fn ($q) => $q->where('resource_type', 'checkout'))
            ->with('accessRules')
            ->get();

        if ($justStarted->isEmpty()) {
            return;
        }

        $controller = app(AccessLockcontroller::class);

        foreach ($justStarted as $lock) {
            try {
                $shop = User::find($lock->shop_id);
                if (!$shop) {
                    continue;
                }
                $controller->syncLockRulesToMetafields($shop, $lock);
                Log::info('ReconcileCheckoutSchedulesJob: activated checkout lock', ['lock_id' => $lock->id]);
            } catch (\Exception $e) {
                Log::error('ReconcileCheckoutSchedulesJob: failed to activate lock ' . $lock->id, [
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
