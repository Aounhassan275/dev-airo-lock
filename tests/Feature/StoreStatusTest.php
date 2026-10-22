<?php

use App\Filament\Admin\Widgets\BillingStatsOverview;
use App\Models\StoreDetail;
use App\Models\User;
use App\Services\StoreStatusReconciler;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Osiset\ShopifyApp\Objects\Enums\ChargeType;
use Osiset\ShopifyApp\Storage\Models\Charge;
use Osiset\ShopifyApp\Storage\Models\Plan;

uses(RefreshDatabase::class);

/**
 * Store lifecycle tracking. Shopify only webhooks UNINSTALLS — closed and
 * frozen stores go silent while their local plan_id / ACTIVE charges keep
 * inflating MRR (merchants exploited this: install on a high plan, close the
 * store days later, admin keeps showing the subscription). These cover the
 * status stamping, the API-probe classification, the stale-charge janitor,
 * and the dashboard exclusion.
 */

function statusShop(string $domain = 'status-test.myshopify.com'): User
{
    return User::factory()->create(['name' => $domain]);
}

function detailFor(User $shop, array $attrs = []): StoreDetail
{
    return StoreDetail::create(array_merge([
        'user_id' => $shop->id,
        'shop_name' => 'Status Test',
        'shopify_domain' => $shop->name,
    ], $attrs));
}

function planRow(float $price = 99.99): Plan
{
    return Plan::forceCreate([
        'type' => \Osiset\ShopifyApp\Objects\Enums\PlanType::RECURRING()->toNative(),
        'name' => 'Unlimited',
        'price' => $price,
        'interval' => 'EVERY_30_DAYS',
    ]);
}

function chargeRow(User $shop, Plan $plan, int $chargeId, array $attrs = []): Charge
{
    return Charge::forceCreate(array_merge([
        'user_id' => $shop->id,
        'plan_id' => $plan->id,
        'charge_id' => $chargeId,
        'type' => ChargeType::RECURRING()->toNative(),
        'status' => 'ACTIVE',
        'price' => $plan->price,
        'interval' => 'EVERY_30_DAYS',
        'test' => false,
        'name' => $plan->name,
    ], $attrs));
}

// ── applyStoreStatus ────────────────────────────────────────────────────────

it('moves changed_at only when the status flips, checked_at always', function () {
    $shop = statusShop();
    $detail = detailFor($shop);

    $detail->applyStoreStatus(StoreDetail::STATUS_ACTIVE, 'probe OK');
    $firstChange = $detail->store_status_changed_at;
    expect($firstChange)->not->toBeNull()
        ->and($detail->store_status_checked_at)->not->toBeNull();

    $this->travel(2)->hours();

    $detail->applyStoreStatus(StoreDetail::STATUS_ACTIVE, 'probe OK again');
    expect($detail->store_status_changed_at->equalTo($firstChange))->toBeTrue()
        ->and($detail->store_status_checked_at->greaterThan($firstChange))->toBeTrue();

    $this->travel(2)->hours();

    $detail->applyStoreStatus(StoreDetail::STATUS_CLOSED, 'API 404');
    expect($detail->store_status_changed_at->greaterThan($firstChange))->toBeTrue()
        ->and($detail->store_status)->toBe(StoreDetail::STATUS_CLOSED);
});

it('sets uninstalled_at once and clears it on reinstall', function () {
    $shop = statusShop();
    $detail = detailFor($shop);

    $detail->applyStoreStatus(StoreDetail::STATUS_UNINSTALLED, 'webhook');
    $firstUninstall = $detail->uninstalled_at;
    expect($firstUninstall)->not->toBeNull();

    $this->travel(1)->hours();
    $detail->applyStoreStatus(StoreDetail::STATUS_UNINSTALLED, 'probe 401');
    expect($detail->uninstalled_at->equalTo($firstUninstall))->toBeTrue();

    $detail->applyStoreStatus(StoreDetail::STATUS_ACTIVE, 'reinstalled');
    expect($detail->uninstalled_at)->toBeNull();
});

// ── probe classification ────────────────────────────────────────────────────

it('classifies probe HTTP statuses into lifecycle verdicts', function () {
    $r = app(StoreStatusReconciler::class);

    expect($r->classifyHttpStatus(200))->toBe(StoreDetail::STATUS_ACTIVE)
        ->and($r->classifyHttpStatus(401))->toBe(StoreDetail::STATUS_UNINSTALLED)
        ->and($r->classifyHttpStatus(403))->toBe(StoreDetail::STATUS_UNINSTALLED)
        ->and($r->classifyHttpStatus(402))->toBe(StoreDetail::STATUS_FROZEN)
        ->and($r->classifyHttpStatus(404))->toBe(StoreDetail::STATUS_CLOSED)
        ->and($r->classifyHttpStatus(423))->toBe(StoreDetail::STATUS_CLOSED)
        // No verdict on transient/unknown statuses — never flip on those.
        ->and($r->classifyHttpStatus(429))->toBeNull()
        ->and($r->classifyHttpStatus(500))->toBeNull()
        ->and($r->classifyHttpStatus(0))->toBeNull();
});

// ── stale-charge janitor ────────────────────────────────────────────────────

it('keeps charges Shopify still backs', function () {
    $shop = statusShop();
    $plan = planRow();
    $charge = chargeRow($shop, $plan, 111);
    $shop->forceFill(['plan_id' => $plan->id])->save();

    $cancelled = app(StoreStatusReconciler::class)->cancelStaleCharges($shop->fresh(), [
        ['id' => 'gid://shopify/AppSubscription/111', 'status' => 'ACTIVE'],
    ]);

    expect($cancelled)->toBe(0)
        ->and($charge->fresh()->status)->toBe('ACTIVE')
        ->and($shop->fresh()->plan_id)->toBe($plan->id);
});

it('cancels charges Shopify no longer backs and releases the plan', function () {
    $shop = statusShop();
    $plan = planRow();
    $charge = chargeRow($shop, $plan, 111);
    $shop->forceFill(['plan_id' => $plan->id])->save();

    $cancelled = app(StoreStatusReconciler::class)->cancelStaleCharges($shop->fresh(), []);

    expect($cancelled)->toBe(1)
        ->and($charge->fresh()->status)->toBe('CANCELLED')
        ->and($charge->fresh()->cancelled_on)->not->toBeNull()
        ->and($shop->fresh()->plan_id)->toBeNull();
});

it('keeps the plan when a different live charge still backs it', function () {
    $shop = statusShop();
    $oldPlan = planRow(9.99);
    $newPlan = planRow(99.99);
    $staleCharge = chargeRow($shop, $oldPlan, 111);
    chargeRow($shop, $newPlan, 222);
    $shop->forceFill(['plan_id' => $newPlan->id])->save();

    $cancelled = app(StoreStatusReconciler::class)->cancelStaleCharges($shop->fresh(), [
        ['id' => 'gid://shopify/AppSubscription/222', 'status' => 'ACTIVE'],
    ]);

    expect($cancelled)->toBe(1)
        ->and($staleCharge->fresh()->status)->toBe('CANCELLED')
        ->and($shop->fresh()->plan_id)->toBe($newPlan->id);
});

// ── uninstall webhook stamps the lifecycle ──────────────────────────────────

it('stamps the StoreDetail as uninstalled when the webhook lands', function () {
    Mail::fake();
    $shop = statusShop('uninstall-status.myshopify.com');
    $detail = detailFor($shop);

    $job = new \App\Jobs\AppUninstalledJob('uninstall-status.myshopify.com', new stdClass);
    $job->handle(
        app(\Osiset\ShopifyApp\Contracts\Commands\Shop::class),
        app(\Osiset\ShopifyApp\Contracts\Queries\Shop::class),
        app(\Osiset\ShopifyApp\Actions\CancelCurrentPlan::class),
    );

    $detail->refresh();
    expect($detail->store_status)->toBe(StoreDetail::STATUS_UNINSTALLED)
        ->and($detail->uninstalled_at)->not->toBeNull()
        // StoreDetail must survive the uninstall wipe — it's the churn record.
        ->and(StoreDetail::where('user_id', $shop->id)->exists())->toBeTrue();
});

// ── dashboard exclusion ─────────────────────────────────────────────────────

it('excludes dead stores from MRR and counts them as churn', function () {
    $plan = planRow();

    $alive = statusShop('alive.myshopify.com');
    $alive->forceFill(['plan_id' => $plan->id])->save();
    chargeRow($alive, $plan, 111);
    detailFor($alive, ['store_status' => StoreDetail::STATUS_ACTIVE]);

    $closed = statusShop('closed.myshopify.com');
    $closed->forceFill(['plan_id' => $plan->id])->save();
    chargeRow($closed, $plan, 222);
    detailFor($closed, [
        'store_status' => StoreDetail::STATUS_CLOSED,
        'store_status_changed_at' => now()->subDays(3),
    ]);

    $stats = (new ReflectionMethod(BillingStatsOverview::class, 'getStats'))
        ->invoke(app(BillingStatsOverview::class));

    $byLabel = collect($stats)->mapWithKeys(fn ($s) => [$s->getLabel() => $s->getValue()]);

    expect($byLabel['MRR (real charges)'])->toBe('$99.99')
        ->and($byLabel['Paying shops'])->toBe(1)
        ->and($byLabel['Churned (30d)'])->toBe(1);
});
