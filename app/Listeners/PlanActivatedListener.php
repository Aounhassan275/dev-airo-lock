<?php

namespace App\Listeners;

use App\Models\User;
use App\Services\MailService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Messaging\Events\PlanActivatedEvent;
use Osiset\ShopifyApp\Objects\Enums\ChargeType;
use Osiset\ShopifyApp\Storage\Models\Charge;

/**
 * Runs when a Shopify charge is accepted and the plan is applied to the shop.
 *
 * Bookkeeping: stamps plan_started_at / trial_ends_at on the shop, clears the
 * freemium flag and re-arms the quota + trial-reminder notifications.
 *
 * Notifications: "plan changed" when switching between plans, otherwise
 * "trial started" (charge carries trial days) or "plan activated".
 */
class PlanActivatedListener
{
    public function __construct(private MailService $mail) {}

    public function handle(PlanActivatedEvent $event): void
    {
        $shop = $event->shop;
        $plan = $event->plan;

        if (! $shop instanceof User || ! $plan) {
            return;
        }

        $charge = Charge::find($event->chargeId->toNative());

        // ── Bookkeeping ────────────────────────────────────────────────
        try {
            $shop->forceFill([
                'plan_started_at' => now(),
                'trial_ends_at' => $charge?->trial_ends_on,
                'shopify_freemium' => 0,
                'quota_notified_at' => null,
                'trial_reminder_sent_at' => null,
            ])->save();
        } catch (\Throwable $e) {
            Log::warning('[Billing] plan activation bookkeeping failed', [
                'shop_id' => $shop->id,
                'error' => $e->getMessage(),
            ]);
        }

        Log::info('[Billing] plan activated', [
            'shop' => $shop->name,
            'plan' => $plan->name.' ('.($plan->interval ?? '').')',
            'price' => $plan->price,
            'test_charge' => (bool) ($charge->test ?? false),
            'trial_ends_on' => $charge?->trial_ends_on,
        ]);

        // ── Notification ───────────────────────────────────────────────
        $price = isset($plan->price)
            ? '$'.number_format((float) $plan->price, 2)
            : null;

        // max_locks of 0/null is treated as unlimited by the template.
        $lockLimit = isset($plan->max_locks) ? (int) $plan->max_locks : null;

        $previousPlan = $this->previousPlanName($shop, (int) $plan->id, $charge);

        if ($previousPlan !== null && $previousPlan !== $plan->name) {
            $this->mail->planChanged(
                $shop,
                $previousPlan,
                $plan->name ?? 'Your plan',
                $this->isUpgrade($previousPlan, $plan),
                now()
            );

            return;
        }

        $inTrial = $charge
            && (int) $charge->trial_days > 0
            && $charge->trial_ends_on
            && Carbon::parse($charge->trial_ends_on)->isFuture();

        if ($inTrial) {
            $this->mail->trialStarted(
                $shop,
                $plan->name ?? 'Your plan',
                (int) $charge->trial_days,
                $charge->trial_ends_on
            );
        }

        // Always confirm the (paid) plan itself.
        $this->mail->planActivated($shop, $plan->name ?? 'Your plan', $price, $lockLimit ?: null);
    }

    /**
     * Name of the plan the shop was on before this activation, from the
     * charge history (excluding the charge that was just created).
     */
    private function previousPlanName(User $shop, int $newPlanId, ?Charge $newCharge): ?string
    {
        try {
            $previous = $shop->charges()
                ->withTrashed()
                ->whereIn('type', [
                    ChargeType::RECURRING()->toNative(),
                    ChargeType::CHARGE()->toNative(),
                ])
                ->when($newCharge, fn ($q) => $q->where('id', '!=', $newCharge->id))
                ->orderByDesc('created_at')
                ->first();

            if (! $previous || (int) $previous->plan_id === $newPlanId) {
                return null;
            }

            return $previous->plan()->withoutGlobalScopes()->first()?->name;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function isUpgrade(string $previousPlanName, $newPlan): bool
    {
        try {
            $previous = \App\Models\Plan::where('name', $previousPlanName)
                ->orderBy('price')
                ->first();

            // Compare on monthly-equivalent price so Basic-annual → Pro-monthly
            // still counts as an upgrade.
            $monthly = fn ($plan) => $plan->interval === 'ANNUAL'
                ? (float) $plan->price / 12
                : (float) $plan->price;

            return $previous === null || $monthly($newPlan) >= $monthly($previous);
        } catch (\Throwable $e) {
            return true;
        }
    }
}
