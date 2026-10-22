<?php

namespace App\Services;

use App\Models\StoreDetail;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Osiset\ShopifyApp\Storage\Models\Charge;

/**
 * Detects dead stores and dead subscriptions that webhooks can't tell us
 * about. Shopify only webhooks app UNINSTALLS; a store that is CLOSED or
 * FROZEN (unpaid Shopify bill) goes silent — its token stops working but the
 * local plan_id and ACTIVE charge rows live on, inflating MRR and the
 * paying-shops count. Merchants also abuse this: install on a high plan for
 * a few days, then close the store.
 *
 * One probe call per shop answers both questions:
 *  - HTTP status of the shop query → store lifecycle (see classifyHttpStatus)
 *  - currentAppInstallation.activeSubscriptions → the real subscription list,
 *    reconciled against local ACTIVE/ACCEPTED charges (catches CANCELLED
 *    webhooks that never arrived, e.g. shops whose APP_SUBSCRIPTIONS_UPDATE
 *    registration predates the webhook's introduction).
 */
class StoreStatusReconciler
{
    private const PROBE_QUERY = 'query AiroStoreStatusProbe {
        shop { name plan { displayName partnerDevelopment shopifyPlus } }
        currentAppInstallation { activeSubscriptions { id status test } }
    }';

    /**
     * @return array{status: ?string, reason: string, stale_charges: int}
     */
    public function reconcile(User $shop): array
    {
        $detail = StoreDetail::firstOrNew(['user_id' => $shop->id]);

        try {
            $response = $shop->api()->graph(self::PROBE_QUERY);
        } catch (\Throwable $e) {
            // Transport failure — no verdict. Never flip a store's status on
            // a network error; the next run will see it.
            Log::warning('[StoreStatus] probe failed (transport)', [
                'shop' => $shop->name,
                'error' => $e->getMessage(),
            ]);

            return ['status' => null, 'reason' => 'probe error: '.$e->getMessage(), 'stale_charges' => 0];
        }

        $httpStatus = (int) ($response['status'] ?? 0);
        $body = json_decode(json_encode($response['body'] ?? []), true);
        $shopData = $body['data']['shop'] ?? $body['container']['data']['shop'] ?? null;

        // GraphQL-level auth errors can come back as 200 with an errors array
        // (or as 401/403 transport). Treat "no shop data on a 200" as unknown,
        // not as a dead store.
        if ($httpStatus === 200 && ! $shopData) {
            Log::warning('[StoreStatus] probe returned 200 without shop data', [
                'shop' => $shop->name,
                'errors' => $body['errors'] ?? $body['container']['errors'] ?? null,
            ]);

            return ['status' => null, 'reason' => 'probe returned no shop data', 'stale_charges' => 0];
        }

        $status = $this->classifyHttpStatus($httpStatus);

        if ($status === null) {
            return ['status' => null, 'reason' => 'HTTP '.$httpStatus.' — no verdict', 'stale_charges' => 0];
        }

        $reason = $this->reasonFor($status, $httpStatus);
        $detail->applyStoreStatus($status, $reason);

        $staleCharges = 0;
        if ($status === StoreDetail::STATUS_ACTIVE) {
            // Keep the Shopify plan name fresh while we have the data (it
            // changes when merchants up/downgrade their Shopify plan).
            $planName = $shopData['plan']['displayName'] ?? null;
            if ($planName && $detail->plan_name !== $planName) {
                $detail->forceFill(['plan_name' => $planName])->save();
            }

            $activeSubs = $body['data']['currentAppInstallation']['activeSubscriptions']
                ?? $body['container']['data']['currentAppInstallation']['activeSubscriptions']
                ?? [];
            $staleCharges = $this->cancelStaleCharges($shop, $activeSubs);
        }

        return ['status' => $status, 'reason' => $reason, 'stale_charges' => $staleCharges];
    }

    /**
     * Map the probe's HTTP status to a lifecycle verdict. Null = no verdict
     * (transient / unknown) — the caller must not change anything.
     *
     *  - 401/403: token revoked → app uninstalled (webhook was missed)
     *  - 402: store frozen — Shopify suspended it over an unpaid bill
     *  - 404: store closed / no longer exists
     *  - 423: store locked by Shopify — treated as closed for revenue purposes
     */
    public function classifyHttpStatus(int $httpStatus): ?string
    {
        return match (true) {
            $httpStatus === 200 => StoreDetail::STATUS_ACTIVE,
            $httpStatus === 401, $httpStatus === 403 => StoreDetail::STATUS_UNINSTALLED,
            $httpStatus === 402 => StoreDetail::STATUS_FROZEN,
            $httpStatus === 404, $httpStatus === 423 => StoreDetail::STATUS_CLOSED,
            default => null,
        };
    }

    private function reasonFor(string $status, int $httpStatus): string
    {
        return match ($status) {
            StoreDetail::STATUS_ACTIVE => 'API probe OK',
            StoreDetail::STATUS_UNINSTALLED => 'API '.$httpStatus.' — token revoked (missed uninstall webhook?)',
            StoreDetail::STATUS_FROZEN => 'API 402 — store frozen by Shopify billing',
            StoreDetail::STATUS_CLOSED => 'API '.$httpStatus.' — store closed',
            default => 'API '.$httpStatus,
        };
    }

    /**
     * Cancel local charges Shopify no longer backs, and release the shop's
     * plan when its backing charge turns out to be dead (mirrors
     * AppSubscriptionsUpdateJob::handleTerminated, minus the email — this is
     * a janitor catching up on old news, not a fresh cancellation).
     *
     * @param array<int, array{id?: string, status?: string}> $activeSubscriptions
     */
    public function cancelStaleCharges(User $shop, array $activeSubscriptions): int
    {
        $liveIds = collect($activeSubscriptions)
            ->map(fn ($sub) => (int) preg_replace('/[^0-9]/', '', (string) ($sub['id'] ?? '')))
            ->filter()
            ->all();

        $staleCharges = Charge::query()
            ->where('user_id', $shop->id)
            ->whereNull('cancelled_on')
            ->whereIn('status', ['ACTIVE', 'ACCEPTED'])
            ->whereNotIn('charge_id', $liveIds)
            ->get();

        foreach ($staleCharges as $charge) {
            $charge->status = 'CANCELLED';
            $charge->cancelled_on = now();
            $charge->save();

            Log::info('[StoreStatus] cancelled stale local charge', [
                'shop' => $shop->name,
                'charge_id' => $charge->charge_id,
                'plan_id' => $charge->plan_id,
            ]);
        }

        // Plan release: only when the plan's backing charge is gone AND no
        // other live charge covers it (plan-switch race guard).
        if ($shop->plan_id !== null
            && $staleCharges->contains(fn ($c) => (int) $c->plan_id === (int) $shop->plan_id)
            && $shop->activePlanCharge() === null) {
            $shop->forceFill(['plan_id' => null, 'trial_ends_at' => null])->save();

            Log::info('[StoreStatus] released plan (no live subscription backs it)', [
                'shop' => $shop->name,
            ]);
        }

        return $staleCharges->count();
    }
}
