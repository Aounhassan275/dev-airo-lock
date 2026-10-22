<?php

use App\Models\AccessLog;
use App\Models\AccessRule;
use App\Models\Lock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * The three mandatory GDPR compliance webhooks had no handler classes, so
 * Osiset's WebhookController fatalled with "Class ...Job not found" and returned
 * 500 to Shopify on every delivery — a mandatory-webhook compliance failure.
 * These prove the classes now resolve by the vendor's convention and that
 * redact actually erases shopper PII from the access log.
 */

/** Mirrors Osiset\ShopifyApp WebhookController: topic slug -> job class. */
function resolveGdprJobClass(string $slug): string
{
    return '\\App\\Jobs\\'.str_replace('-', '', ucwords($slug, '-')).'Job';
}

function makeGdprShop(string $domain = 'gdpr-lock.myshopify.com'): User
{
    return User::factory()->create(['name' => $domain]);
}

function makeRuleWithLog(User $shop, int $customerId): AccessLog
{
    $lock = Lock::create([
        'shop_id' => $shop->id, 'name' => 'L', 'handle' => 'l-'.uniqid(),
        'status' => true, 'type' => 'standard',
    ]);
    $rule = AccessRule::create([
        'shop_id' => $shop->id, 'lock_id' => $lock->id,
        'resource_type' => 'product', 'handle' => 'p-'.uniqid(),
        'conditions' => [], 'enabled' => true,
    ]);

    return AccessLog::create([
        'access_rule_id' => $rule->id,
        'customer_id' => $customerId,
        'ip_address' => '203.0.113.7',
        'user_agent' => 'Mozilla/5.0',
        'granted' => true,
    ]);
}

it('resolves the compliance topics to classes that exist', function () {
    foreach ([
        'customers-data-request' => \App\Jobs\CustomersDataRequestJob::class,
        'customers-redact' => \App\Jobs\CustomersRedactJob::class,
        'shop-redact' => \App\Jobs\ShopRedactJob::class,
    ] as $slug => $expected) {
        $resolved = resolveGdprJobClass($slug);
        expect(class_exists($resolved))->toBeTrue();
        expect(ltrim($resolved, '\\'))->toBe(ltrim($expected, '\\'));
    }
});

it('erases only the redacted shopper\'s access logs', function () {
    $shop = makeGdprShop();
    $theirs = makeRuleWithLog($shop, 777);
    $others = makeRuleWithLog($shop, 888);

    (new \App\Jobs\CustomersRedactJob($shop->name, (object) [
        'customer' => (object) ['id' => 777],
    ]))->handle();

    expect(AccessLog::find($theirs->id))->toBeNull();
    expect(AccessLog::find($others->id))->not->toBeNull();
});

it('does not touch another shop\'s logs for the same customer id', function () {
    $shopA = makeGdprShop('a.myshopify.com');
    $shopB = makeGdprShop('b.myshopify.com');
    $logA = makeRuleWithLog($shopA, 777);
    $logB = makeRuleWithLog($shopB, 777);

    (new \App\Jobs\CustomersRedactJob($shopA->name, (object) [
        'customer' => (object) ['id' => 777],
    ]))->handle();

    expect(AccessLog::find($logA->id))->toBeNull();
    expect(AccessLog::find($logB->id))->not->toBeNull();
});

it('erases all of the shop\'s data on shop/redact', function () {
    $shop = makeGdprShop('closing.myshopify.com');
    $log = makeRuleWithLog($shop, 777);

    (new \App\Jobs\ShopRedactJob($shop->name, (object) []))->handle();

    expect(User::withTrashed()->find($shop->id))->toBeNull();
    expect(AccessRule::where('shop_id', $shop->id)->count())->toBe(0);
    expect(AccessLog::find($log->id))->toBeNull();
    expect(Lock::where('shop_id', $shop->id)->count())->toBe(0);
});

it('is safe to run for an unknown shop', function () {
    (new \App\Jobs\CustomersDataRequestJob('ghost.myshopify.com', (object) ['customer' => (object) ['id' => 1]]))->handle();
    (new \App\Jobs\CustomersRedactJob('ghost.myshopify.com', (object) ['customer' => (object) ['id' => 1]]))->handle();
    (new \App\Jobs\ShopRedactJob('ghost.myshopify.com', (object) []))->handle();

    expect(true)->toBeTrue();
});
