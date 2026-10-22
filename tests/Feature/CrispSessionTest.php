<?php

use App\Models\Lock;
use App\Models\StoreDetail;
use App\Models\User;
use App\Support\CrispSession;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * The Crisp widget used to read Auth::user()->storeDetails — the relation is
 * storeDetail, singular — so every field taken from it reached support empty.
 */

function crispValue(array $crisp, string $key): ?string
{
    foreach ($crisp['data'] as [$k, $v]) {
        if ($k === $key) {
            return $v;
        }
    }

    return null;
}

function shopWithDetail(array $detail = []): User
{
    $shop = User::factory()->create(['name' => 'cars-elixzadh.myshopify.com']);

    StoreDetail::create(array_merge([
        'user_id' => $shop->id,
        'shop_name' => 'Cars Elixzadh',
        'email' => 'owner@example.com',
        'plan_name' => 'Basic',
        'shopify_domain' => 'cars-elixzadh.myshopify.com',
        'primary_domain' => 'https://carselixzadh.com/',
        'country' => 'PK',
        'currency' => 'USD',
    ], $detail));

    return $shop->fresh();
}

it('sends the store domain and Shopify plan that used to arrive blank', function () {
    $crisp = CrispSession::for(shopWithDetail());

    expect(crispValue($crisp, 'store_domain'))->toBe('carselixzadh.com')
        ->and(crispValue($crisp, 'shopify_plan'))->toBe('Basic')
        ->and(crispValue($crisp, 'store_name'))->toBe('Cars Elixzadh')
        ->and(crispValue($crisp, 'myshopify_domain'))->toBe('cars-elixzadh.myshopify.com');
});

it('names the visitor after the store instead of leaving them anonymous', function () {
    expect(CrispSession::for(shopWithDetail())['nickname'])->toBe('carselixzadh.com');
});

it('falls back to the myshopify domain when the store details never synced', function () {
    $shop = User::factory()->create(['name' => 'unsynced-shop.myshopify.com']);

    $crisp = CrispSession::for($shop);

    expect($crisp['nickname'])->toBe('unsynced-shop.myshopify.com')
        ->and(crispValue($crisp, 'store_domain'))->toBe('unsynced-shop.myshopify.com')
        // Nothing known about it — no blank rows for support to squint at.
        ->and(crispValue($crisp, 'shopify_plan'))->toBeNull();
});

it('flags a development store, from the authoritative Shopify field', function () {
    $crisp = CrispSession::for(shopWithDetail(['partner_development' => true, 'plan_name' => 'Developer Preview']));

    expect(crispValue($crisp, 'dev_store'))->toBe('yes')
        ->and($crisp['segments'])->toContain('dev-store');
});

it('does not flag an ordinary merchant as a dev store', function () {
    $crisp = CrispSession::for(shopWithDetail(['partner_development' => false]));

    expect(crispValue($crisp, 'dev_store'))->toBe('no')
        ->and($crisp['segments'])->not->toContain('dev-store');
});

it('reports the app plan, not the Shopify plan, and how many locks are in use', function () {
    $shop = shopWithDetail();
    Lock::create(['shop_id' => $shop->id, 'name' => 'A', 'handle' => 'a', 'status' => true, 'type' => 'standard']);
    Lock::create(['shop_id' => $shop->id, 'name' => 'B', 'handle' => 'b', 'status' => true, 'type' => 'standard']);

    $crisp = CrispSession::for($shop);

    expect(crispValue($crisp, 'app_plan'))->toBe('No plan')
        ->and(crispValue($crisp, 'app_plan_status'))->toBe('No plan')
        ->and(crispValue($crisp, 'locks_used'))->toStartWith('2 / ')
        ->and(crispValue($crisp, 'shopify_plan'))->toBe('Basic')
        ->and($crisp['segments'])->toContain('no-plan');
});

it('tells support when the theme app embed is off — the usual cause of "locks do nothing"', function () {
    $crisp = CrispSession::for(shopWithDetail(['embed_enabled' => false]));

    expect(crispValue($crisp, 'app_embed'))->toBe('no')
        ->and($crisp['segments'])->toContain('embed-off');
});

it('says the embed status is unknown rather than claiming it is off', function () {
    $crisp = CrispSession::for(shopWithDetail());

    expect(crispValue($crisp, 'app_embed'))->toBe('unknown')
        ->and($crisp['segments'])->not->toContain('embed-off');
});

it('every value is a string, as the Crisp session:data API requires', function () {
    $crisp = CrispSession::for(shopWithDetail());

    foreach ($crisp['data'] as $pair) {
        expect($pair)->toHaveCount(2)
            ->and($pair[0])->toBeString()
            ->and($pair[1])->toBeString();
    }
});

it('returns nothing when nobody is logged in', function () {
    expect(CrispSession::for(null))->toBeNull();
});
