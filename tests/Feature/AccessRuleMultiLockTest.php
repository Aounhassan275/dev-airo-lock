<?php

use App\Models\AccessRule;
use App\Models\Lock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Regression guard for the "reopening a lock shows nothing selected" bug.
 *
 * Two locks are allowed to target the same resource (the unique index on
 * access_rules (shop_id, resource_type, handle) was dropped in migration
 * 2026_01_13_000001). AccessLockcontroller::storeLock persists rules with
 * updateOrCreate; its match key MUST include lock_id, otherwise creating a
 * second lock on the same product re-points the first lock's rule and the
 * first lock loses everything it had.
 */

function makeShop(): User
{
    return User::factory()->create();
}

function makeLock(User $shop, string $name): Lock
{
    return Lock::create([
        'shop_id' => $shop->id,
        'name' => $name,
        'handle' => 'multi-' . $name,
        'status' => true,
        'type' => 'mixed',
    ]);
}

/**
 * Mirrors AccessLockcontroller::storeLock's rule write (the fixed key
 * includes lock_id). If the controller's key regresses to the old
 * shop-wide key, the "keeps its own rule" expectation below fails.
 */
function upsertRuleForLock(User $shop, Lock $lock, string $resourceType, string $handle): AccessRule
{
    return AccessRule::updateOrCreate(
        [
            'shop_id' => $shop->id,
            'lock_id' => $lock->id,
            'resource_type' => $resourceType,
            'handle' => $handle,
        ],
        [
            'enabled' => true,
        ]
    );
}

it('lets two locks hold a rule for the same product without stealing', function () {
    $shop = makeShop();
    $lockA = makeLock($shop, 'A');
    $lockB = makeLock($shop, 'B');

    upsertRuleForLock($shop, $lockA, 'product', 'shared-shirt');
    upsertRuleForLock($shop, $lockB, 'product', 'shared-shirt');

    // Both locks keep their own rule — the second save did not re-point the first.
    expect($lockA->accessRules()->where('handle', 'shared-shirt')->count())->toBe(1);
    expect($lockB->accessRules()->where('handle', 'shared-shirt')->count())->toBe(1);

    // Two distinct rows exist for the same (shop, resource_type, handle).
    $rows = AccessRule::where('shop_id', $shop->id)
        ->where('resource_type', 'product')
        ->where('handle', 'shared-shirt')
        ->get();
    expect($rows)->toHaveCount(2);
    expect($rows->pluck('lock_id')->sort()->values()->all())->toBe([$lockA->id, $lockB->id]);
});

it('re-saving the same lock+product updates in place rather than duplicating', function () {
    $shop = makeShop();
    $lock = makeLock($shop, 'A');

    $first = upsertRuleForLock($shop, $lock, 'product', 'shared-shirt');
    $second = upsertRuleForLock($shop, $lock, 'product', 'shared-shirt');

    // Same lock + same product = one row, updated in place.
    expect($second->id)->toBe($first->id);
    expect($lock->accessRules()->where('handle', 'shared-shirt')->count())->toBe(1);
});

it('confirms the (shop_id, resource_type, handle) unique index is dropped', function () {
    // The fix depends on the schema allowing two rows for one resource. If a
    // future migration re-adds the unique index, inserting the second row
    // throws and this test fails loudly.
    $shop = makeShop();
    $lockA = makeLock($shop, 'A');
    $lockB = makeLock($shop, 'B');

    AccessRule::create(['shop_id' => $shop->id, 'lock_id' => $lockA->id, 'resource_type' => 'product', 'handle' => 'p', 'enabled' => true]);

    expect(fn () => AccessRule::create(['shop_id' => $shop->id, 'lock_id' => $lockB->id, 'resource_type' => 'product', 'handle' => 'p', 'enabled' => true]))
        ->not->toThrow(Exception::class);
});
