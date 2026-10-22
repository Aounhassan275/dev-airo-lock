<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

\Illuminate\Support\Facades\Schedule::job(new \App\Jobs\ExpireLocksJob)->everyMinute();

// Activate scheduled CHECKOUT locks at their starts_at. Checkout enforcement
// is gated server-side (the Shopify Function has no clock), so a future lock
// isn't in the metafield until this writes it. Expiry is ExpireLocksJob's job.
\Illuminate\Support\Facades\Schedule::job(new \App\Jobs\ReconcileCheckoutSchedulesJob)->everyMinute();

// Time-based lock emails (activation + expiring-soon reminders).
\Illuminate\Support\Facades\Schedule::job(new \App\Jobs\LockNotificationsJob)->everyMinute();

// Opt-in weekly summary (no-op unless MAIL_DIGESTS=true). Mondays 08:00 store/app tz.
\Illuminate\Support\Facades\Schedule::command('mail:weekly-digest')->weeklyOn(1, '8:00');

// "Trial ending soon" reminders — once per trial, a few days before the
// first real charge (window in config/plans.php).
\Illuminate\Support\Facades\Schedule::command('billing:trial-reminders')->dailyAt('09:00');

// Detect closed/frozen stores and missed uninstalls (they send no webhook)
// and cancel local charges Shopify no longer backs — keeps MRR honest.
\Illuminate\Support\Facades\Schedule::command('stores:check-status')->dailyAt('06:45');

// Pages, blogs and themes have no Shopify webhooks, so without this they are
// synced once at install and never again — a page added later never appears in
// the lock picker. Nightly, off-peak; the picker's own Refresh button covers
// the merchant who needs it immediately.
\Illuminate\Support\Facades\Schedule::command('catalog:resync-webhookless')->dailyAt('04:30');
