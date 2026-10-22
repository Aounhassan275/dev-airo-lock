<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * Representative sample variables for each email template, mirroring what
 * App\Services\MailService passes at runtime. Shared by the browser preview
 * (EmailPreviewController) and the `mail:test` command.
 */
class EmailSamples
{
    public static function all(): array
    {
        $shop = 'Aurora Apparel';
        $url = config('app.url');
        $soon = Carbon::now()->addDay()->format('M j, Y · g:i A');
        $date = Carbon::now()->addDays(10)->format('M j, Y');

        $base = ['shopName' => $shop, 'appUrl' => $url];

        return [
            'welcome' => $base,
            'reinstall' => $base,
            'uninstall' => $base,

            'lock-created' => $base + ['lockName' => 'VIP Collection', 'protection' => 'Password', 'itemCount' => 12, 'startsAt' => null, 'expiresAt' => $soon],
            'lock-activated' => $base + ['lockName' => 'Black Friday Preview', 'itemCount' => 8, 'expiresAt' => $soon],
            'lock-expired' => $base + ['lockName' => 'Flash Sale', 'itemCount' => 5, 'expiredAt' => $soon],
            'lock-deleted' => $base + ['lockName' => 'Members Area', 'itemCount' => 3],
            'lock-expiring-soon' => $base + ['lockName' => 'Early Access', 'itemCount' => 6, 'expiresAt' => $soon, 'timeLeft' => '24 hours'],

            'access-denied-summary' => $base + ['period' => 'last 7 days', 'deniedCount' => 142, 'allowedCount' => 318, 'topLock' => 'VIP Collection'],
            'access-rule-changed' => $base + ['lockName' => 'VIP Collection', 'changeSummary' => 'Access changed from Password to Customer login.'],

            'pricing-launch' => $base + [
                'pricingUrl' => $url,
                'activeLocks' => 7,
                'freeLockLimit' => 5,
                'trialDays' => 7,
                'planRows' => [
                    ['name' => 'Basic', 'locks' => 'Up to 5', 'monthly' => '$9.99', 'annual' => '$99.99'],
                    ['name' => 'Pro', 'locks' => 'Up to 20', 'monthly' => '$29.99', 'annual' => '$299.99'],
                    ['name' => 'Unlimited', 'locks' => 'Unlimited', 'monthly' => '$99.99', 'annual' => '$999.99'],
                ],
            ],
            'trial-started' => $base + ['planName' => 'Pro', 'trialDays' => 7, 'trialEndsAt' => $date],
            'trial-ending' => $base + ['planName' => 'Pro', 'daysLeft' => 2, 'trialEndsAt' => $date],
            'plan-activated' => $base + ['planName' => 'Pro', 'price' => '$29.99', 'lockLimit' => 10],
            'plan-changed' => $base + ['oldPlan' => 'Basic', 'newPlan' => 'Pro', 'isUpgrade' => true, 'effectiveAt' => $date],
            'plan-cancelled' => $base + ['planName' => 'Pro', 'activeUntil' => $date, 'activeLocks' => 4],
            'payment-failed' => $base + ['planName' => 'Pro', 'retryAt' => $date, 'amount' => '$29.99'],
            'quota-reached' => $base + ['planName' => 'Basic', 'lockLimit' => 5, 'usedLocks' => 5],

            'weekly-digest' => $base + ['period' => 'this week', 'activeLocks' => 9, 'protectedItems' => 47, 'blockedAttempts' => 142],
        ];
    }
}
