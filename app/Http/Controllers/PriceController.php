<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\User;
use App\Services\BillingService;
use App\Services\MailService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class PriceController extends Controller
{
    public function __construct(
        private BillingService $billing,
        private MailService $mail,
    ) {}

    /**
     * In-app pricing page: all active plans + the shop's current plan,
     * usage and trial state so merchants always see where they stand.
     */
    public function index()
    {
        $shop = Auth::user();

        $plans = Plan::query()
            ->active()
            ->orderBy('price')
            ->get()
            ->map(function (Plan $plan) {
                $isAnnual = $plan->interval === 'ANNUAL';
                $rawPrice = (float) $plan->price;

                return [
                    'id' => $plan->id,
                    'name' => $plan->name ?? 'Unnamed Plan',
                    'price' => '$'.number_format($rawPrice, 2).($isAnnual ? '/year' : '/month'),
                    'raw_price' => $rawPrice,
                    'interval' => $plan->interval ?? 'EVERY_30_DAYS',
                    'terms' => $plan->terms,
                    'trial_days' => (int) ($plan->trial_days ?? 0),
                    'description' => $plan->description
                        ?: config("plans.tiers.{$plan->name}.description", 'The right plan for your store.'),
                    'features' => $plan->featureLabels(),
                    'max_locks' => (int) $plan->max_locks,
                    'is_popular' => (bool) $plan->is_popular,
                ];
            })
            ->values();

        return Inertia::render('Plans', [
            'plans' => $plans,
            'currentPlanId' => $shop->plan_id,
            'billing' => $this->billing->usage($shop),
        ]);
    }

    /**
     * Kick off a plan change: responds with the embedded-admin billing URL.
     * The package's /billing/{plan} route creates the Shopify charge (test
     * charges only for dev stores / admin-flagged shops — see App\Models\Plan)
     * and Shopify walks the merchant through approval; /billing/process then
     * activates the plan, records the charge and cancels the previous one.
     */
    public function selectPlan(Request $request, $planId)
    {
        $shop = Auth::user();

        if (! ctype_digit((string) $planId)) {
            return response()->json([
                'success' => false,
                'message' => 'Plan not found or no longer available.',
            ], 404);
        }

        $plan = Plan::query()->active()->find((int) $planId);

        if (! $plan) {
            return response()->json([
                'success' => false,
                'message' => 'Plan not found or no longer available.',
            ], 404);
        }

        if ((int) $shop->plan_id === (int) $plan->id) {
            return response()->json([
                'success' => false,
                'message' => "You're already on the {$plan->name} plan.",
            ], 422);
        }

        // $0 plans never go through Shopify billing (zero-price subscriptions
        // are rejected) — apply locally, cancelling any paid subscription.
        if ((float) $plan->price <= 0) {
            return $this->activateFreePlan($shop, $plan);
        }

        $token = null;
        $authHeader = $request->header('Authorization');
        if ($authHeader && str_starts_with($authHeader, 'Bearer ')) {
            $token = substr($authHeader, 7);
        }

        // Get app handle: config → TOML → default
        $handle = (string) config('shopify-app.app_handle', '');
        if ($handle === '') {
            $tomlPath = base_path('shopify.app.toml');
            if (is_file($tomlPath)) {
                $toml = file_get_contents($tomlPath);
                if (preg_match('/^handle\s*=\s*"([^"]+)"/m', $toml, $m)) {
                    $handle = $m[1];
                }
            }
        }
        if ($handle === '') {
            $handle = 'acesslock-1';
        }

        $encodedHandle = rawurlencode($handle);
        $redirectUrl = "https://{$shop->name}/admin/apps/{$encodedHandle}/billing/{$plan->id}?token={$token}";

        Log::info('[Billing] plan selection', [
            'shop' => $shop->name,
            'from_plan_id' => $shop->plan_id,
            'to_plan_id' => $plan->id,
            'to_plan' => $plan->name.' ('.$plan->interval.')',
            'test_charge' => $plan->isTest(),
        ]);

        return response()->json([
            'success' => true,
            'redirectUrl' => $redirectUrl,
            'message' => 'Redirecting to Shopify billing…',
        ]);
    }

    /**
     * Put the shop on the free plan. There is no Shopify approval screen for
     * $0 plans, so this cancels the active paid subscription (if any) through
     * the Admin API first — the merchant must stop being billed the moment
     * they land on Free — and only then applies the plan locally. The
     * CANCELLED webhook that follows is ignored by AppSubscriptionsUpdateJob
     * because the cancelled charge no longer backs the shop's current plan.
     */
    private function activateFreePlan(User $shop, Plan $plan)
    {
        $previousPlanName = $shop->plan?->name;
        $charge = $shop->activePlanCharge();

        if ($charge && $charge->charge_id) {
            try {
                $response = $shop->api()->graph(
                    <<<'GQL'
                    mutation AppSubscriptionCancel($id: ID!) {
                        appSubscriptionCancel(id: $id) {
                            appSubscription { id status }
                            userErrors { field message }
                        }
                    }
                    GQL,
                    ['id' => "gid://shopify/AppSubscription/{$charge->charge_id}"]
                );

                $result = $response['body']['data']['appSubscriptionCancel'] ?? null;
                $status = $result['appSubscription']['status'] ?? null;
                $userErrors = $result['userErrors'] ?? [];

                if ($response['errors'] !== false || ($status !== 'CANCELLED' && count($userErrors) > 0)) {
                    throw new \RuntimeException(json_encode([
                        'errors' => $response['errors'],
                        'userErrors' => count($userErrors) ? $userErrors->toArray() : [],
                    ]));
                }
            } catch (\Throwable $e) {
                Log::error('[Billing] free plan downgrade failed to cancel subscription', [
                    'shop' => $shop->name,
                    'charge_id' => $charge->charge_id,
                    'error' => $e->getMessage(),
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'We could not cancel your current subscription. Please try again in a moment.',
                ], 502);
            }

            $charge->cancelled_on = now();
            $charge->status = 'CANCELLED';
            $charge->save();
        }

        // Same bookkeeping PlanActivatedListener does for paid activations.
        $shop->forceFill([
            'plan_id' => $plan->id,
            'plan_started_at' => now(),
            'trial_ends_at' => null,
            'shopify_freemium' => 0,
            'quota_notified_at' => null,
            'trial_reminder_sent_at' => null,
        ])->save();

        Log::info('[Billing] free plan activated', [
            'shop' => $shop->name,
            'from_plan' => $previousPlanName,
            'cancelled_charge_id' => $charge?->charge_id,
        ]);

        if ($previousPlanName !== null && $previousPlanName !== $plan->name) {
            try {
                $this->mail->planChanged($shop, $previousPlanName, $plan->name, false, now());
            } catch (\Throwable $e) {
                Log::warning('[Billing] free downgrade email failed', [
                    'shop' => $shop->name,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'freePlanActivated' => true,
            'message' => "You're now on the {$plan->name} plan.",
        ]);
    }
}
