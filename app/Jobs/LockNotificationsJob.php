<?php

namespace App\Jobs;

use App\Models\Lock;
use App\Services\MailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Per-minute sweep that fires the two time-based lock emails exactly once each:
 *   • lock-activated      — a scheduled lock has reached its starts_at
 *   • lock-expiring-soon  — a lock is within the warning window of expires_at
 *
 * Idempotency is enforced via the activation_notified_at / expiry_reminder_sent_at
 * columns so re-runs never double-send. Actual expiry/teardown is handled
 * separately by ExpireLocksJob.
 */
class LockNotificationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Hours before expires_at to send the "expiring soon" reminder. */
    private const EXPIRY_WARNING_HOURS = 24;

    public function handle(MailService $mail): void
    {
        $this->notifyActivations($mail);
        $this->notifyExpiringSoon($mail);
    }

    private function notifyActivations(MailService $mail): void
    {
        $locks = Lock::with('shop')
            ->where('status', true)
            ->whereNotNull('starts_at')
            ->where('starts_at', '<=', now())
            ->whereNull('activation_notified_at')
            ->get();

        foreach ($locks as $lock) {
            try {
                if ($lock->shop) {
                    $mail->lockActivated($lock->shop, $lock);
                }
                $lock->forceFill(['activation_notified_at' => now()])->saveQuietly();
            } catch (\Throwable $e) {
                Log::error('LockNotificationsJob: activation notify failed', [
                    'lock_id' => $lock->id,
                    'error'   => $e->getMessage(),
                ]);
            }
        }
    }

    private function notifyExpiringSoon(MailService $mail): void
    {
        $locks = Lock::with('shop')
            ->where('status', true)
            ->whereNotNull('expires_at')
            ->whereNull('expiry_reminder_sent_at')
            ->whereBetween('expires_at', [now(), now()->addHours(self::EXPIRY_WARNING_HOURS)])
            ->get();

        foreach ($locks as $lock) {
            try {
                if ($lock->shop) {
                    $mail->lockExpiringSoon($lock->shop, $lock);
                }
                $lock->forceFill(['expiry_reminder_sent_at' => now()])->saveQuietly();
            } catch (\Throwable $e) {
                Log::error('LockNotificationsJob: expiry reminder failed', [
                    'lock_id' => $lock->id,
                    'error'   => $e->getMessage(),
                ]);
            }
        }
    }
}
