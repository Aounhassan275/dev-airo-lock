<?php

use App\Models\AccessRule;
use App\Models\Lock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * The lock list labels each lock with what it protects (Product / Page /
 * Entire store …), which comes from Lock::attachResourceTypes.
 */

function makeLockFor(User $shop, string $name): Lock
{
    return Lock::create([
        'shop_id' => $shop->id,
        'name' => $name,
        'handle' => 'rt-' . $name,
        'status' => true,
        'type' => 'mixed',
    ]);
}

function addRule(User $shop, Lock $lock, string $resourceType, string $handle): AccessRule
{
    return AccessRule::create([
        'shop_id' => $shop->id,
        'lock_id' => $lock->id,
        'resource_type' => $resourceType,
        'handle' => $handle,
        'conditions' => [],
        'enabled' => true,
    ]);
}

it('reports each lock\'s resource types, biggest group first', function () {
    $shop = User::factory()->create();

    $mixed = makeLockFor($shop, 'mixed');
    addRule($shop, $mixed, 'page', 'about');
    addRule($shop, $mixed, 'product', 'shirt');
    addRule($shop, $mixed, 'product', 'hat');
    addRule($shop, $mixed, 'product', 'mug');

    $storewide = makeLockFor($shop, 'storewide');
    addRule($shop, $storewide, 'shop', 'all');

    $locks = Lock::attachResourceTypes(Lock::where('shop_id', $shop->id)->get());

    expect($locks->firstWhere('id', $mixed->id)->resource_types)->toBe([
        ['type' => 'product', 'count' => 3],
        ['type' => 'page', 'count' => 1],
    ]);
    expect($locks->firstWhere('id', $storewide->id)->resource_types)->toBe([
        ['type' => 'shop', 'count' => 1],
    ]);
});

it('gives a lock with no rules an empty list rather than omitting the attribute', function () {
    $shop = User::factory()->create();
    $empty = makeLockFor($shop, 'empty');

    $locks = Lock::attachResourceTypes(Lock::where('shop_id', $shop->id)->get());

    expect($locks->firstWhere('id', $empty->id)->resource_types)->toBe([]);
});

it('counts only its own rules when two locks share a resource', function () {
    $shop = User::factory()->create();

    $first = makeLockFor($shop, 'first');
    $second = makeLockFor($shop, 'second');
    addRule($shop, $first, 'product', 'shared-shirt');
    addRule($shop, $second, 'product', 'shared-shirt');
    addRule($shop, $second, 'blog', 'news');

    $locks = Lock::attachResourceTypes(Lock::where('shop_id', $shop->id)->get());

    expect($locks->firstWhere('id', $first->id)->resource_types)->toBe([
        ['type' => 'product', 'count' => 1],
    ]);
    expect($locks->firstWhere('id', $second->id)->resource_types)
        ->toContain(['type' => 'product', 'count' => 1])
        ->toContain(['type' => 'blog', 'count' => 1]);
});
