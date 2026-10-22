<?php

namespace App\Services;

use App\Mail\AppMail;
use App\Models\Lock;
use App\Models\StoreDetail;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Central dispatcher for all transactional emails.
 *
 * Every public method resolves the recipient, builds the template variables
 * and sends a queued AppMail. Sends are best-effort: a missing email address,
 * a disabled toggle, or an SMTP error is logged and swallowed so app flow is
 * never interrupted by mail.
 *
 * Master switch: config('mail.app_notifications') (env MAIL_APP_NOTIFICATIONS).
 */
class MailService
{
    /* ───────────────────────── App lifecycle ───────────────────────── */

    public function welcome(User $shop, bool $reinstall = false): void
    {
        [$email, $name] = $this->recipient($shop);

        $reinstall
            ? $this->send($email, $name, 'reinstall', 'Welcome back to '.config('app.name'))
            : $this->send($email, $name, 'welcome', 'Welcome to '.config('app.name'));
    }

    /**
     * Sent from the uninstall job. Recipient data is passed in explicitly
     * because the shop record may be torn down moments later.
     */
    public function uninstall(?string $email, ?string $shopName): void
    {
        $this->send($email, $shopName, 'uninstall', config('app.name').' has been uninstalled');
    }

    /* ─────────────────────────── Lock lifecycle ─────────────────────── */

    public function lockCreated(User $shop, Lock $lock): void
    {
        [$email, $name, $detail] = $this->recipient($shop);

        $this->send($email, $name, 'lock-created', 'Lock created · '.$lock->name, [
            'lockName' => $lock->name,
            'protection' => $this->protectionLabel($lock),
            'itemCount' => $lock->accessRules()->count(),
            'startsAt' => $this->fmt($lock->starts_at, $detail),
            'expiresAt' => $this->fmt($lock->expires_at, $detail),
        ]);
    }

    public function lockActivated(User $shop, Lock $lock): void
    {
        [$email, $name, $detail] = $this->recipient($shop);

        $this->send($email, $name, 'lock-activated', 'Lock activated · '.$lock->name, [
            'lockName' => $lock->name,
            'itemCount' => $lock->accessRules()->count(),
            'expiresAt' => $this->fmt($lock->expires_at, $detail),
        ]);
    }

    public function lockExpired(User $shop, string $lockName, int $itemCount, $expiredAt = null): void
    {
        [$email, $name, $detail] = $this->recipient($shop);

        $this->send($email, $name, 'lock-expired', 'Lock expired · '.$lockName, [
            'lockName' => $lockName,
            'itemCount' => $itemCount,
            'expiredAt' => $this->fmt($expiredAt, $detail),
        ]);
    }

    public function lockDeleted(User $shop, string $lockName, int $itemCount): void
    {
        [$email, $name] = $this->recipient($shop);

        $this->send($email, $name, 'lock-deleted', 'Lock deleted · '.$lockName, [
            'lockName' => $lockName,
            'itemCount' => $itemCount,
        ]);
    }

    public function lockExpiringSoon(User $shop, Lock $lock): void
    {
        [$email, $name, $detail] = $this->recipient($shop);

        $this->send($email, $name, 'lock-expiring-soon', 'Lock expiring soon · '.$lock->name, [
            'lockName' => $lock->name,
            'itemCount' => $lock->accessRules()->count(),
            'expiresAt' => $this->fmt($lock->expires_at, $detail),
            'timeLeft' => $lock->expires_at
                ? now()->diffForHumans($lock->expires_at, ['parts' => 1, 'syntax' => Carbon::DIFF_ABSOLUTE])
                : 'soon',
        ]);
    }

    /* ───────────────────────── Access activity ──────────────────────── */

    public function accessDeniedSummary(User $shop, string $period, int $deniedCount, ?int $allowedCount = null, ?string $topLock = null): void
    {
        [$email, $name] = $this->recipient($shop);

        $this->send($email, $name, 'access-denied-summary', 'Your access activity · '.config('app.name'), [
            'period' => $period,
            'deniedCount' => $deniedCount,
            'allowedCount' => $allowedCount,
            'topLock' => $topLock,
        ]);
    }

    public function accessRuleChanged(User $shop, string $lockName, ?string $changeSummary = null): void
    {
        [$email, $name] = $this->recipient($shop);

        $this->send($email, $name, 'access-rule-changed', 'Access rule updated · '.$lockName, [
            'lockName' => $lockName,
            'changeSummary' => $changeSummary,
        ]);
    }

    /* ──────────────────────────── Plans ─────────────────────────────── */

    /**
     * One-time "free period has ended — pricing is live" launch announcement.
     * Sent by the billing:launch-announce command.
     */
    public function pricingLaunch(User $shop, array $planRows, int $freeLockLimit, int $activeLocks, string $pricingUrl, int $trialDays = 7): void
    {
        [$email, $name] = $this->recipient($shop);

        $this->send($email, $name, 'pricing-launch', 'Pricing has launched — your store keeps free access', [
            'planRows' => $planRows,
            'freeLockLimit' => $freeLockLimit,
            'activeLocks' => $activeLocks,
            'pricingUrl' => $pricingUrl,
            'trialDays' => $trialDays,
        ]);
    }

    public function trialStarted(User $shop, string $planName, int $trialDays, $trialEndsAt): void
    {
        [$email, $name, $detail] = $this->recipient($shop);

        $this->send($email, $name, 'trial-started', 'Your free trial has started', [
            'planName' => $planName,
            'trialDays' => $trialDays,
            'trialEndsAt' => $this->fmt($trialEndsAt, $detail, true),
        ]);
    }

    public function trialEnding(User $shop, string $planName, int $daysLeft, $trialEndsAt): void
    {
        [$email, $name, $detail] = $this->recipient($shop);

        $this->send($email, $name, 'trial-ending', 'Your trial is ending soon', [
            'planName' => $planName,
            'daysLeft' => $daysLeft,
            'trialEndsAt' => $this->fmt($trialEndsAt, $detail, true),
        ]);
    }

    public function planActivated(User $shop, string $planName, ?string $price = null, ?int $lockLimit = null): void
    {
        [$email, $name] = $this->recipient($shop);

        $this->send($email, $name, 'plan-activated', $planName.' is now active', [
            'planName' => $planName,
            'price' => $price,
            'lockLimit' => $lockLimit,
        ]);
    }

    public function planChanged(User $shop, string $oldPlan, string $newPlan, bool $isUpgrade, $effectiveAt = null): void
    {
        [$email, $name, $detail] = $this->recipient($shop);

        $this->send($email, $name, 'plan-changed', 'Your plan was updated', [
            'oldPlan' => $oldPlan,
            'newPlan' => $newPlan,
            'isUpgrade' => $isUpgrade,
            'effectiveAt' => $this->fmt($effectiveAt, $detail, true),
        ]);
    }

    public function planCancelled(User $shop, string $planName, $activeUntil = null, ?int $activeLocks = null): void
    {
        [$email, $name, $detail] = $this->recipient($shop);

        $this->send($email, $name, 'plan-cancelled', 'Your subscription was cancelled', [
            'planName' => $planName,
            'activeUntil' => $this->fmt($activeUntil, $detail, true),
            'activeLocks' => $activeLocks,
        ]);
    }

    public function paymentFailed(User $shop, string $planName, $retryAt = null, ?string $amount = null): void
    {
        [$email, $name, $detail] = $this->recipient($shop);

        $this->send($email, $name, 'payment-failed', 'Payment failed · action needed', [
            'planName' => $planName,
            'retryAt' => $this->fmt($retryAt, $detail, true),
            'amount' => $amount,
        ]);
    }

    public function quotaReached(User $shop, string $planName, int $lockLimit, int $usedLocks): void
    {
        [$email, $name] = $this->recipient($shop);

        $this->send($email, $name, 'quota-reached', "You've reached your lock limit", [
            'planName' => $planName,
            'lockLimit' => $lockLimit,
            'usedLocks' => $usedLocks,
        ]);
    }

    /* ──────────────────────────── System ────────────────────────────── */

    public function weeklyDigest(User $shop, string $period, int $activeLocks, int $protectedItems, int $blockedAttempts): void
    {
        [$email, $name] = $this->recipient($shop);

        $this->send($email, $name, 'weekly-digest', 'Your weekly lock report', [
            'period' => $period,
            'activeLocks' => $activeLocks,
            'protectedItems' => $protectedItems,
            'blockedAttempts' => $blockedAttempts,
        ]);
    }

    /* ─────────────────────────── Internals ──────────────────────────── */

    /**
     * Resolve [email, shopName, StoreDetail] for a shop. Email falls back from
     * the Shopify-provided store email to the user record.
     *
     * @return array{0: ?string, 1: ?string, 2: ?StoreDetail}
     */
    private function recipient(User $shop): array
    {
        $detail = $shop->storeDetail;

        return [
            $detail->email ?? $shop->email ?? null,
            $detail->shop_name ?? null,
            $detail,
        ];
    }

    /**
     * Low-level send. Applies the master toggle, the common template vars and
     * swallows any failure.
     */
    private function send(?string $email, ?string $shopName, string $template, string $subject, array $data = []): void
    {
        if (! config('mail.app_notifications', true)) {
            return;
        }

        if (empty($email)) {
            Log::info('[MailService] skipped '.$template.' — no recipient email');

            return;
        }

        $data = array_merge([
            'shopName' => $shopName,
            'appUrl' => config('app.url'),
            'preheader' => $subject,
        ], $data);

        try {
            Mail::to($email)->send(new AppMail($template, $subject, $data));
        } catch (\Throwable $e) {
            Log::error('[MailService] failed to send '.$template, [
                'email' => $email,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /** Format a datetime in the store's timezone (falls back to app tz). */
    private function fmt($value, ?StoreDetail $detail, bool $dateOnly = false): ?string
    {
        if (empty($value)) {
            return null;
        }

        $date = $value instanceof Carbon ? $value->copy() : Carbon::parse($value);

        if ($detail && ! empty($detail->iana_timezone)) {
            try {
                $date->setTimezone($detail->iana_timezone);
            } catch (\Throwable $e) {
                // keep app timezone
            }
        }

        return $dateOnly ? $date->format('M j, Y') : $date->format('M j, Y · g:i A');
    }

    /** Best-effort human label for a lock's access type, or null. */
    private function protectionLabel(Lock $lock): ?string
    {
        $rule = $lock->accessRules()->first();
        $conditions = $rule?->conditions;

        if (is_string($conditions)) {
            $conditions = json_decode($conditions, true);
        }

        if (! is_array($conditions) || empty($conditions)) {
            return null;
        }

        $first = $conditions[0] ?? $conditions;
        $type = is_array($first) ? ($first['type'] ?? $first['method'] ?? null) : null;

        return $type ? Str::headline((string) $type) : null;
    }
}
