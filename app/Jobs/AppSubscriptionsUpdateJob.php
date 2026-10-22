<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\MailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Storage\Models\Charge;
use stdClass;

/**
 * APP_SUBSCRIPTIONS_UPDATE webhook — keeps local billing state honest when a
 * subscription changes on Shopify's side without going through the app:
 *
 *  - CANCELLED / DECLINED / EXPIRED → drop the shop's plan (the plan gate
 *    then sends them back to /pricing) and send the cancellation email.
 *  - FROZEN → payment failed on renewal; plan is kept (Shopify freezes it)
 *    but the merchant is alerted to fix billing.
 *  - ACTIVE (e.g. unfrozen or re-approved) → restore the plan link if lost.
 *
 * Ordinary plan switches inside the app also emit a CANCELLED event for the
 * old subscription; those are ignored because the cancelled charge no longer
 * matches the shop's current plan charge.
 */
class AppSubscriptionsUpdateJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $shopDomain,
        public stdClass $data
    ) {}

    public function handle(MailService $mail): void
    {
        $subscription = $this->data->app_subscription ?? null;
        if (! $subscription) {
            Log::warning('[Billing] subscriptions webhook without app_subscription payload', [
                'shop' => $this->shopDomain,
            ]);

            return;
        }

        $status = strtoupper((string) ($subscription->status ?? ''));
        $chargeReference = (int) preg_replace('/[^0-9]/', '', (string) ($subscription->admin_graphql_api_id ?? ''));

        $shop = User::where('name', $this->shopDomain)->first();
        if (! $shop) {
            // Uninstalled shops are handled by AppUninstalledJob.
            return;
        }

        $charge = $chargeReference
            ? Charge::where('charge_id', $chargeReference)->where('user_id', $shop->id)->first()
            : null;

        Log::info('[Billing] subscription update webhook', [
            'shop' => $this->shopDomain,
            'status' => $status,
            'charge_reference' => $chargeReference,
            'matched_local_charge' => $charge?->id,
            'current_plan_id' => $shop->plan_id,
        ]);

        match ($status) {
            'CANCELLED', 'DECLINED', 'EXPIRED' => $this->handleTerminated($shop, $charge, $mail),
            'FROZEN' => $this->handleFrozen($shop, $mail),
            'ACTIVE' => $this->handleActive($shop, $charge),
            default => null,
        };
    }

    /** Subscription ended on Shopify's side — release the plan locally. */
    private function handleTerminated(User $shop, ?Charge $charge, MailService $mail): void
    {
        // A cancelled charge that isn't backing the current plan is just the
        // tail end of an in-app plan switch — nothing to do.
        if ($shop->plan_id === null || ($charge && (int) $charge->plan_id !== (int) $shop->plan_id)) {
            return;
        }

        // If a different, still-active charge backs the current plan (plan
        // switch race), leave the plan alone.
        if ($charge === null && $shop->activePlanCharge() !== null) {
            return;
        }

        $planName = $shop->plan?->name ?? 'Your plan';

        if ($charge && ! $charge->isCancelled()) {
            $charge->cancelled_on = now();
            $charge->status = 'CANCELLED';
            $charge->save();
        }

        $activeLocks = \App\Models\Lock::where('shop_id', $shop->id)->where('status', true)->count();

        $shop->forceFill([
            'plan_id' => null,
            'trial_ends_at' => null,
        ])->save();

        Log::info('[Billing] plan released after subscription termination', [
            'shop' => $shop->name,
            'plan' => $planName,
        ]);

        $mail->planCancelled($shop, $planName, now(), $activeLocks ?: null);
    }

    /** Renewal payment failed — Shopify froze the subscription. */
    private function handleFrozen(User $shop, MailService $mail): void
    {
        $planName = $shop->plan?->name ?? 'Your plan';
        $price = $shop->plan?->price !== null
            ? '$'.number_format((float) $shop->plan->price, 2)
            : null;

        $mail->paymentFailed($shop, $planName, null, $price);
    }

    /** Subscription (re)activated outside the normal flow — restore the link. */
    private function handleActive(User $shop, ?Charge $charge): void
    {
        if (! $charge) {
            return;
        }

        $changed = false;

        if ($charge->isCancelled() && $charge->status !== 'ACTIVE') {
            $charge->cancelled_on = null;
            $charge->status = 'ACTIVE';
            $charge->save();
            $changed = true;
        }

        if ($shop->plan_id === null && $charge->plan_id) {
            $shop->forceFill(['plan_id' => $charge->plan_id])->save();
            $changed = true;
        }

        if ($changed) {
            Log::info('[Billing] plan restored from ACTIVE subscription webhook', [
                'shop' => $shop->name,
                'plan_id' => $charge->plan_id,
            ]);
        }
    }
}
