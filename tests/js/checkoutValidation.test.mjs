import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    cartValidationsGenerateRun,
    evalCondition,
} from '../../extensions/airo-lock-checkout-validation/src/run.js';

const group = (conditions, operator = 'AND') => ({ operator, conditions });
const lockWith = (conditions, over = {}) => ({ enabled: true, prompt: 'Access required', conditions, ...over });

const input = (locks, { accessCode, email, customer, country, billingCountry } = {}) => ({
    cart: {
        accessCode: accessCode !== undefined ? { value: accessCode } : null,
        buyerIdentity: {
            isAuthenticated: Boolean(customer),
            email: email || null,
            customer: customer || null,
        },
        deliveryGroups: country ? [{ deliveryAddress: { countryCode: country } }] : [],
        billingAddress: billingCountry ? { countryCode: billingCountry } : null,
    },
    // Scheduling is enforced server-side (Laravel only writes active locks to
    // the metafield), so the function receives no clock and no schedule input.
    shop: { metafield: { value: JSON.stringify({ locks }) } },
});

const blocked = (result) => result.operations.length > 0;

test('a passcode checkout lock blocks until the right code is entered', () => {
    // The reported scenario: Checkout (Plus) lock, singlePasscode '4444'.
    const locks = [lockWith([group([{ type: 'singlePasscode', value: '4444' }])])];
    assert.ok(blocked(cartValidationsGenerateRun(input(locks))), 'no code entered');
    assert.ok(blocked(cartValidationsGenerateRun(input(locks, { accessCode: '1234' }))), 'wrong code');
    assert.ok(!blocked(cartValidationsGenerateRun(input(locks, { accessCode: '4444' }))), 'right code');
    assert.ok(!blocked(cartValidationsGenerateRun(input(locks, { accessCode: ' 4444 ' }))), 'code is trimmed');
});

test('multiple passcodes accept any listed code, including legacy backslash saves', () => {
    const canonical = [lockWith([group([{ type: 'multiplePasscodes', value: '1122\n1111' }])])];
    assert.ok(!blocked(cartValidationsGenerateRun(input(canonical, { accessCode: '1111' }))));
    const legacy = [lockWith([group([{ type: 'multiplePasscodes', value: '123\\2222\\3333' }])])];
    assert.ok(!blocked(cartValidationsGenerateRun(input(legacy, { accessCode: '2222' }))));
    assert.ok(blocked(cartValidationsGenerateRun(input(legacy, { accessCode: '123\\2222\\3333' }))), 'raw string is not a code');
});

test('AND of passcode + emailContains needs both to pass', () => {
    const locks = [lockWith([group([
        { type: 'singlePasscode', value: '4444' },
        { type: 'emailContains', value: '@gmail.com' },
    ])])];
    assert.ok(blocked(cartValidationsGenerateRun(input(locks, { accessCode: '4444' }))), 'code only');
    assert.ok(blocked(cartValidationsGenerateRun(input(locks, { email: 'a@gmail.com' }))), 'email only');
    assert.ok(!blocked(cartValidationsGenerateRun(input(locks, { accessCode: '4444', email: 'a@gmail.com' }))));
});

test('emailFromList matches listed buyer emails', () => {
    const locks = [lockWith([group([{ type: 'emailFromList', value: 'vip@x.com\nboss@y.com' }])])];
    assert.ok(!blocked(cartValidationsGenerateRun(input(locks, { email: 'BOSS@Y.com' }))), 'case-insensitive');
    assert.ok(blocked(cartValidationsGenerateRun(input(locks, { email: 'other@z.com' }))));
});

test('signedIn uses customer presence; legacy empty value means loggedIn', () => {
    const locks = [lockWith([group([{ type: 'signedIn', value: '' }])])];
    assert.ok(blocked(cartValidationsGenerateRun(input(locks))), 'guest blocked');
    assert.ok(!blocked(cartValidationsGenerateRun(input(locks, { customer: { id: 'gid://1', email: 'a@b.com' } }))));
});

test('unevaluable conditions never cause a false denial', () => {
    // tag can't be read at checkout: an AND group with only a tag must not block.
    const tagOnly = [lockWith([group([{ type: 'tag', value: 'VIP' }])])];
    assert.ok(!blocked(cartValidationsGenerateRun(input(tagOnly))));
    // OR group: the unevaluable side may be the one that passes.
    const orMix = [lockWith([group([{ type: 'tag', value: 'VIP' }, { type: 'singlePasscode', value: '4444' }], 'OR')])];
    assert.ok(!blocked(cartValidationsGenerateRun(input(orMix))));
    // AND mix: the evaluable passcode must still be enforced.
    const andMix = [lockWith([group([{ type: 'tag', value: 'VIP' }, { type: 'singlePasscode', value: '4444' }])])];
    assert.ok(blocked(cartValidationsGenerateRun(input(andMix))), 'passcode still enforced');
    assert.ok(!blocked(cartValidationsGenerateRun(input(andMix, { accessCode: '4444' }))));
});

test('location matches shipping country; custom value checks the whole address', () => {
    const pk = [lockWith([group([{ type: 'location', value: 'PK' }])])];
    assert.ok(!blocked(cartValidationsGenerateRun(input(pk, { country: 'PK' }))));
    assert.ok(blocked(cartValidationsGenerateRun(input(pk, { country: 'US' }))));
    assert.ok(
        evalCondition({ type: 'location', value: 'custom', custom: '' }, { country: 'US', province: '', city: '' }),
        'blank custom value fails open'
    );
});

test('location falls back to billing address on no-ship carts', () => {
    const pk = [lockWith([group([{ type: 'location', value: 'PK' }])])];
    // Digital cart: no delivery address, billing is PK → allowed.
    assert.ok(!blocked(cartValidationsGenerateRun(input(pk, { billingCountry: 'PK' }))));
    assert.ok(blocked(cartValidationsGenerateRun(input(pk, { billingCountry: 'US' }))));
});

test('a location lock never blocks before any address is known', () => {
    // Digital cart at the very first step: no shipping, no billing yet.
    const pk = [lockWith([group([{ type: 'location', value: 'PK' }])])];
    assert.ok(!blocked(cartValidationsGenerateRun(input(pk))), 'location unevaluable → allow, not block');
    // But an AND passcode alongside it still enforces.
    const mix = [lockWith([group([{ type: 'location', value: 'PK' }, { type: 'singlePasscode', value: '4444' }])])];
    assert.ok(blocked(cartValidationsGenerateRun(input(mix))), 'passcode still required');
    assert.ok(!blocked(cartValidationsGenerateRun(input(mix, { accessCode: '4444' }))));
});

test('invert flips an evaluable condition', () => {
    const notGmail = [lockWith([group([{ type: 'emailContains', value: '@gmail.com', invert: true }])])];
    assert.ok(blocked(cartValidationsGenerateRun(input(notGmail, { email: 'a@gmail.com' }))));
    assert.ok(!blocked(cartValidationsGenerateRun(input(notGmail, { email: 'a@yahoo.com' }))));
});

test('OR across groups grants access when either group passes', () => {
    const locks = [lockWith([
        group([{ type: 'singlePasscode', value: '4444' }]),
        group([{ type: 'emailContains', value: '@vip.com' }]),
    ])];
    assert.ok(!blocked(cartValidationsGenerateRun(input(locks, { email: 'a@vip.com' }))), 'email group passes');
    assert.ok(!blocked(cartValidationsGenerateRun(input(locks, { accessCode: '4444' }))), 'passcode group passes');
    assert.ok(blocked(cartValidationsGenerateRun(input(locks))));
});

test('disabled locks are skipped; scheduling is not the function’s concern', () => {
    const conds = [group([{ type: 'singlePasscode', value: '4444' }])];
    assert.ok(!blocked(cartValidationsGenerateRun(input([lockWith(conds, { enabled: false })]))), 'disabled skipped');
    // Any lock present in the metafield is active by construction (Laravel
    // only writes active checkout locks), so the function enforces it
    // regardless of any residual starts_at/expires_at fields on the payload.
    assert.ok(blocked(cartValidationsGenerateRun(input([lockWith(conds, { starts_at: '2099-01-01T00:00:00Z' })]))), 'function does not gate schedule');
});

test('missing or malformed metafield is a no-op', () => {
    assert.ok(!blocked(cartValidationsGenerateRun({ shop: { metafield: null } })));
    assert.ok(!blocked(cartValidationsGenerateRun({ shop: { metafield: { value: 'not json' } } })));
    assert.ok(!blocked(cartValidationsGenerateRun({ shop: { metafield: { value: '{"locks":[]}' } } })));
});

test('a lock with no conditions blocks nobody', () => {
    assert.ok(!blocked(cartValidationsGenerateRun(input([lockWith([])]))));
});

// ---------------------------------------------------------------------------
// Paired credentials at checkout
//
// Both halves are known here without any extra field: the address comes from
// buyer identity, the code from the cart's access-code attribute.
// ---------------------------------------------------------------------------

const PAIRS = 'alice@x.com,AAA-1\nbob@x.com,BBB-2';

test('a paired credential blocks a code issued to a different buyer', () => {
    const locks = [lockWith([group([{ type: 'pairedCredentials', value: PAIRS }])])];

    assert.ok(
        !blocked(cartValidationsGenerateRun(input(locks, { email: 'alice@x.com', accessCode: 'AAA-1' }))),
        'her own code lets her through',
    );
    assert.ok(
        blocked(cartValidationsGenerateRun(input(locks, { email: 'alice@x.com', accessCode: 'BBB-2' }))),
        "Bob's code must not work for Alice",
    );
    assert.ok(
        blocked(cartValidationsGenerateRun(input(locks, { email: 'mallory@x.com', accessCode: 'AAA-1' }))),
        'an address that is not on the list',
    );
});

test('a paired credential needs both halves at checkout', () => {
    const conds = { type: 'pairedCredentials', value: PAIRS };

    assert.ok(evalCondition(conds, { email: 'alice@x.com', accessCode: 'AAA-1' }));
    assert.ok(!evalCondition(conds, { email: 'alice@x.com', accessCode: '' }), 'no code entered yet');
    assert.ok(!evalCondition(conds, { email: '', accessCode: 'AAA-1' }), 'no email known yet');
});

test('the checkout split matches the storefront: only the first separator', () => {
    assert.ok(evalCondition({ type: 'pairedCredentials', value: 'dan@x.com,VIP,24' }, {
        email: 'dan@x.com',
        accessCode: 'VIP,24',
    }));
});
