<?php

use App\Http\Controllers\AccessLockcontroller;
use App\Models\AccessRule;
use App\Models\Lock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Regression guard for "Hide the Add to Cart button" never applying outside
 * the product's own page.
 *
 * The site-wide storefront pass (access_core.js hideLockedResources) is fed
 * exclusively by buildGlobalLockList — via the access_lock.global_config
 * metafield and the app-proxy /rules `global` payload. Until 2026-07 the list
 * omitted hide_add_to_cart entirely, so homepage / collection / search cards
 * kept fully working quick-add buttons for locked products. It also needs
 * rule_id: the storefront's unlock-grant cache is keyed by rule_id (metafield
 * entries carry no lock_id), and without it the pass can't honor an unlock
 * earned on the product page.
 */

function shopForGlobalList(): User
{
    return User::factory()->create();
}

function activeLockWithRule(User $shop, array $ruleSettings): AccessRule
{
    $lock = Lock::create([
        'shop_id' => $shop->id,
        'name' => 'atc-lock',
        'handle' => 'multi-atc',
        'status' => true,
        'type' => 'mixed',
    ]);

    return AccessRule::create([
        'shop_id' => $shop->id,
        'lock_id' => $lock->id,
        'resource_type' => 'product',
        'handle' => 'locked-product',
        'enabled' => true,
        'conditions' => [['operator' => 'AND', 'conditions' => [['type' => 'singlePasscode', 'value' => '1234']]]],
        'settings' => $ruleSettings,
    ]);
}

it('carries hide_add_to_cart and rule_id into the global lock list', function () {
    $shop = shopForGlobalList();
    $rule = activeLockWithRule($shop, ['hide_add_to_cart' => true]);

    $list = app(AccessLockcontroller::class)->buildGlobalLockList($shop);

    expect($list)->toHaveCount(1)
        ->and($list[0]['rule_id'])->toBe($rule->id)
        ->and($list[0]['target_type'])->toBe('product')
        ->and($list[0]['target_handle'])->toBe('locked-product')
        ->and($list[0]['lock_settings']['hide_add_to_cart'])->toBeTrue();
});

it('reports hide_add_to_cart false when the lock does not use it', function () {
    $shop = shopForGlobalList();
    activeLockWithRule($shop, ['hide_completely' => true]);

    $list = app(AccessLockcontroller::class)->buildGlobalLockList($shop);

    expect($list)->toHaveCount(1)
        ->and($list[0]['lock_settings']['hide_add_to_cart'])->toBeFalse()
        ->and($list[0]['lock_settings']['hide_completely'])->toBeTrue();
});
