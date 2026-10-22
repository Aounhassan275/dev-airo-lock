<?php

namespace App\Console\Commands;

use App\Models\Lock;
use App\Models\Plan;
use App\Models\User;
use App\Services\MailService;
use Illuminate\Console\Command;

/**
 * One-time paid-plans launch rollout for existing merchants.
 *
 * For every installed shop that has NOT subscribed to a paid plan yet:
 *   1. Grants legacy "Free access" (shopify_freemium = 1) so the app keeps
 *      working: the plan gate lets them in with entry-tier limits (Basic
 *      features, entry lock limit). Their EXISTING locks — including ones
 *      over the limit or with premium conditions — keep enforcing on the
 *      storefront untouched; they just can't create beyond the free limit
 *      or save premium features without upgrading.
 *   2. Sends the "pricing has launched" announcement email (plan table is
 *      built live from the plans catalog).
 *
 * Idempotent: emails are stamped on users.pricing_launch_notified_at, so
 * re-running only picks up shops not yet notified. Shops that already
 * subscribed to a paid plan are skipped entirely.
 *
 * Usage:
 *   php artisan billing:launch-announce --dry-run          # preview only
 *   php artisan billing:launch-announce                    # full rollout
 *   php artisan billing:launch-announce --shop=x.myshopify.com  # one shop (re-sends)
 *   php artisan billing:launch-announce --no-grant-free    # email only, no free access
 */
class BillingLaunchAnnounce extends Command
{
    protected $signature = 'billing:launch-announce
                            {--dry-run : List what would happen without changing or sending anything}
                            {--shop= : Only this shop domain (re-sends even if already notified)}
                            {--no-grant-free : Do not grant legacy free access, only send the email}';

    protected $description = 'Grant existing shops legacy free access and email them the paid-plans launch announcement';

    public function handle(MailService $mail): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $onlyShop = $this->option('shop');
        $grantFree = ! $this->option('no-grant-free');

        $planRows = $this->planRows();
        if ($planRows === []) {
            $this->error('No active plans found — seed the plan catalog first (db:seed --class=PlansTableSeeder).');

            return self::FAILURE;
        }

        $freeLockLimit = (int) (Plan::query()->active()->orderBy('price')->value('max_locks') ?: 5);
        $trialDays = (int) (Plan::query()->active()->orderBy('price')->value('trial_days') ?: 7);
        $handle = $this->appHandle();

        $query = User::query()
            ->whereNull('plan_id') // shops already on a paid plan need no announcement
            ->where('is_admin', false)
            ->with('storeDetail');

        if ($onlyShop) {
            $query->where('name', $onlyShop);
        } else {
            $query->whereNull('pricing_launch_notified_at');
        }

        $shops = $query->get();

        if ($shops->isEmpty()) {
            $this->info($onlyShop ? "Shop {$onlyShop} not found or already on a paid plan." : 'Nothing to do — everyone is either notified or on a paid plan.');

            return self::SUCCESS;
        }

        $this->table(
            ['Shop', 'Email', 'Locks', 'Free access', 'Action'],
            $shops->map(function (User $shop) use ($grantFree, $dryRun) {
                $email = $shop->storeDetail->email ?? $shop->email ?? '—';
                $locks = Lock::where('shop_id', $shop->id)->count();
                $free = $shop->isFreemium() ? 'already' : ($grantFree ? 'grant' : 'no');

                return [$shop->name, $email, $locks, $free, $dryRun ? 'DRY RUN' : 'email + stamp'];
            })
        );

        if ($dryRun) {
            $this->info('Dry run — no emails sent, no flags changed. Targets: '.$shops->count());

            return self::SUCCESS;
        }

        if (! $onlyShop && ! $this->confirm("Send the launch announcement to {$shops->count()} shop(s)?", true)) {
            return self::SUCCESS;
        }

        $sent = 0;
        $granted = 0;

        foreach ($shops as $shop) {
            if ($grantFree && ! $shop->isFreemium()) {
                $shop->forceFill(['shopify_freemium' => 1])->save();
                $granted++;
            }

            $pricingUrl = "https://{$shop->name}/admin/apps/".rawurlencode($handle).'/pricing';
            $activeLocks = Lock::where('shop_id', $shop->id)->count();

            $mail->pricingLaunch($shop, $planRows, $freeLockLimit, $activeLocks, $pricingUrl, $trialDays);

            $shop->forceFill(['pricing_launch_notified_at' => now()])->save();
            $sent++;
        }

        $this->info("Done. Emails queued: {$sent} · Free access granted: {$granted}.");
        $this->line('Re-running is safe — already-notified shops are skipped.');

        return self::SUCCESS;
    }

    /**
     * Plan table rows for the email, from the live catalog (monthly rows,
     * with the matching annual price when one exists).
     */
    private function planRows(): array
    {
        $plans = Plan::query()->active()->orderBy('price')->get();

        return $plans
            ->where('interval', 'EVERY_30_DAYS')
            ->map(function (Plan $plan) use ($plans) {
                $annual = $plans->first(fn (Plan $p) => $p->interval === 'ANNUAL' && $p->name === $plan->name);

                return [
                    'name' => $plan->name,
                    'locks' => (int) $plan->max_locks === 0 ? 'Unlimited' : 'Up to '.$plan->max_locks,
                    'monthly' => '$'.number_format((float) $plan->price, 2),
                    'annual' => $annual ? '$'.number_format((float) $annual->price, 2) : null,
                ];
            })
            ->values()
            ->all();
    }

    /** App handle for the embedded-admin pricing deep link: config → TOML → default. */
    private function appHandle(): string
    {
        $handle = (string) config('shopify-app.app_handle', '');

        if ($handle === '' && is_file(base_path('shopify.app.toml'))) {
            $toml = file_get_contents(base_path('shopify.app.toml'));
            if (preg_match('/^handle\s*=\s*"([^"]+)"/m', $toml, $m)) {
                $handle = $m[1];
            }
        }

        return $handle !== '' ? $handle : 'acesslock-1';
    }
}
