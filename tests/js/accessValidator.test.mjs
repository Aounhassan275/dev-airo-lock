import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// access_validator.js is a browser IIFE that hangs itself on window —
// evaluate it against a stub to get at the real shipped logic.
const read = (name) =>
    readFileSync(fileURLToPath(new URL(`../../extensions/access-controll/assets/${name}`, import.meta.url)), 'utf8');

const context = { window: {}, localStorage: undefined, sessionStorage: undefined };
// The theme block loads access_i18n.js first (deferred scripts run in
// document order), so field labels resolve through the catalog. Mirror
// that order here.
new Function('window', read('access_i18n.js')).call(context, context.window);
new Function('window', read('access_validator.js')).call(context, context.window);
const { getPasscodeRequirements, evaluateConditionsWithInputs } = context.window.AccessValidator;
const { t: translate, configure } = context.window.AccessI18n;

const group = (conditions, operator = 'AND') => ({ operator, conditions });
const labels = (conds) => getPasscodeRequirements(conds).map((r) => r.displayLabel);

const GUEST = { loggedIn: false, email: '', tags: [] };

test('a passcode + email lock renders one passcode field and one email field', () => {
    // Regression: emailContains fell through a case-sensitive 'Email' check
    // and rendered as "Passcode 2" — a masked field customers could not pass.
    const conds = [group([
        { type: 'multiplePasscodes', value: '1122\n1111' },
        { type: 'emailContains', value: '@gmail.com' },
    ])];
    assert.deepEqual(labels(conds), ['Enter Passcode', 'Email Address']);
});

test('all email condition types label as Email Address', () => {
    const conds = [group([
        { type: 'specificEmail', value: 'x@y.com' },
        { type: 'emailFromList', value: 'a@b.com' },
    ])];
    assert.deepEqual(labels(conds), ['Email Address 1', 'Email Address 2']);
});

test('lone fields keep their unnumbered labels', () => {
    assert.deepEqual(labels([group([{ type: 'singlePasscode', value: '123' }])]), ['Enter Passcode']);
    assert.deepEqual(labels([group([{ type: 'emailContains', value: '@x.com' }])]), ['Email Address']);
    assert.deepEqual(labels([group([{ type: 'ageVerification', value: '18' }])]), ['Date of Birth']);
});

test('repeated passcode fields are numbered', () => {
    const conds = [group([
        { type: 'singlePasscode', value: '123' },
        { type: 'passcodeFromList', value: 'a\nb' },
    ])];
    assert.deepEqual(labels(conds), ['Passcode 1', 'Passcode 2']);
});

test('a custom admin-set label is used verbatim', () => {
    const conds = [group([
        { type: 'singlePasscode', value: '123', label: 'VIP code' },
        { type: 'emailContains', value: '@x.com' },
    ])];
    assert.deepEqual(labels(conds), ['VIP code', 'Email Address']);
});

test('passcode AND email-contains validates with one passcode plus a matching email', () => {
    const conds = [group([
        { type: 'multiplePasscodes', value: '1122\n1111' },
        { type: 'emailContains', value: '@gmail.com' },
    ])];
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['1122', 'abc@gmail.com']));
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['1111', 'abc@gmail.com']));
    assert.ok(!evaluateConditionsWithInputs(conds, GUEST, ['1111', 'abc@yahoo.com']), 'wrong email domain');
    assert.ok(!evaluateConditionsWithInputs(conds, GUEST, ['9999', 'abc@gmail.com']), 'wrong passcode');
});

test('typed email wins over the account email; blank falls back to it', () => {
    const conds = [group([{ type: 'emailContains', value: '@vip.com' }])];
    const loggedIn = { loggedIn: true, email: 'personal@gmail.com' };
    // A signed-in customer typing an authorized address must not be
    // overridden by their non-matching account email.
    assert.ok(evaluateConditionsWithInputs(conds, loggedIn, ['boss@vip.com']));
    // Left blank, the matching account email still satisfies the condition.
    const matching = { loggedIn: true, email: 'me@vip.com' };
    assert.ok(evaluateConditionsWithInputs(conds, matching, ['']));
    assert.ok(!evaluateConditionsWithInputs(conds, loggedIn, ['']), 'blank + non-matching account');
});

test('a legacy backslash-separated passcode save accepts each individual code', () => {
    // The old admin placeholder showed a literal '\n', so merchants saved
    // '123\2222\3333' as one line — each code must still work, and the
    // whole raw string must NOT be accepted as a passcode.
    const conds = [group([{ type: 'multiplePasscodes', value: '123\\2222\\3333' }])];
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['123']));
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['2222']));
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['3333']));
    assert.ok(!evaluateConditionsWithInputs(conds, GUEST, ['123\\2222\\3333']), 'raw string is not a passcode');
    assert.ok(!evaluateConditionsWithInputs(conds, GUEST, ['9999']));
});

test('a legacy backslash-separated email list matches each address', () => {
    const conds = [group([{ type: 'emailFromList', value: 'a@x.com\\b@y.com' }])];
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['b@y.com']));
    assert.ok(!evaluateConditionsWithInputs(conds, GUEST, ['c@z.com']));
});

test('a bulk-entered email list of a few hundred addresses matches anywhere in the list', () => {
    // What the "Add in bulk" field produces: one newline-joined value holding
    // the merchant's whole customer list. Case is the merchant's, not the
    // shopper's, so a mixed-case entry must still match a lowercase sign-in.
    const list = Array.from({ length: 200 }, (_, i) => `customer${i}@example.com`);
    list[137] = 'VIP.Buyer@Example.com';
    const conds = [group([{ type: 'emailFromList', value: list.join('\n') }])];

    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['customer0@example.com']), 'first entry');
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['customer199@example.com']), 'last entry');
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['vip.buyer@example.com']), 'mixed-case entry');
    assert.ok(!evaluateConditionsWithInputs(conds, GUEST, ['customer200@example.com']), 'not on the list');
});

test('OR groups grant access when either group is satisfied', () => {
    const conds = [
        group([{ type: 'multiplePasscodes', value: '1122' }]),
        group([{ type: 'emailContains', value: '@gmail.com' }]),
    ];
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['1122', '']), 'passcode group passes');
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['', 'a@gmail.com']), 'email group passes');
    assert.ok(!evaluateConditionsWithInputs(conds, GUEST, ['', '']), 'neither passes');
});

// ---------------------------------------------------------------------------
// Multi-language storefront strings
// ---------------------------------------------------------------------------

test('field labels carry a translation key so they render per locale', () => {
    const conds = [group([
        { type: 'singlePasscode', value: '123' },
        { type: 'emailContains', value: '@x.com' },
    ])];
    const reqs = getPasscodeRequirements(conds);
    assert.deepEqual(reqs.map((r) => r.labelKey), ['label.passcode', 'label.email']);
    assert.deepEqual(
        reqs.map((r) => translate(r.labelKey, r.labelVars, 'de')),
        ['Code eingeben', 'E-Mail-Adresse'],
    );
});

test('numbered labels keep their index across languages', () => {
    const conds = [group([
        { type: 'singlePasscode', value: '123' },
        { type: 'passcodeFromList', value: 'a\nb' },
    ])];
    const reqs = getPasscodeRequirements(conds);
    assert.deepEqual(reqs.map((r) => r.labelKey), ['label.passcodeN', 'label.passcodeN']);
    assert.deepEqual(
        reqs.map((r) => translate(r.labelKey, r.labelVars, 'fr')),
        ['Code 1', 'Code 2'],
    );
});

test('a custom admin-set label is never translated away', () => {
    const conds = [group([{ type: 'singlePasscode', value: '123', label: 'VIP code' }])];
    const [req] = getPasscodeRequirements(conds);
    assert.equal(req.customLabel, 'VIP code');
    assert.equal(req.displayLabel, 'VIP code');
});

test('locale resolution falls back exact → language → english', () => {
    configure(null);
    // Exact regional match is not in the catalog; the language is.
    assert.equal(translate('button.submit', null, 'fr-CA'), 'Envoyer');
    // Aliased locale codes land on the right dictionary.
    assert.equal(translate('button.submit', null, 'pt-BR'), 'Enviar');
    assert.equal(translate('button.submit', null, 'zh'), '提交');
    // A locale we ship no translations for still renders readable English.
    assert.equal(translate('button.submit', null, 'is'), 'Submit');
});

test('merchant overrides beat the built-in catalog, per locale', () => {
    configure({
        mode: 'auto',
        translations: { de: { 'button.submit': 'Los geht’s' }, default: { 'header.locked': 'Members only' } },
    });
    assert.equal(translate('button.submit', null, 'de'), 'Los geht’s');
    // Untouched keys still come from the catalog.
    assert.equal(translate('button.close', null, 'de'), 'Schließen');
    // A "default" override applies to every locale that has no specific one.
    assert.equal(translate('header.locked', null, 'fr'), 'Members only');
    configure(null);
});

test('a pinned locale overrides whatever the storefront is in', () => {
    assert.equal(configure({ mode: 'fixed', locale: 'ja' }), 'ja');
    assert.equal(translate('button.submit'), '送信');
    assert.equal(configure({ mode: 'auto' }), 'en');
    configure(null);
});

test('a pinned language survives the metafield payload shape', () => {
    // Exactly what buildRuleMetafieldData writes and access_core reads back:
    // rule.widget.settings is the widget configuration, language and all.
    const rule = {
        rule_id: 7,
        enabled: true,
        prompt: null,
        conditions: [group([{ type: 'singlePasscode', value: '12345' }])],
        widget: {
            id: 3,
            type: 'form',
            name: 'Testing Widget',
            settings: {
                designOptions: { colors: {}, layout: { buttonText: '' } },
                language: { mode: 'fixed', locale: 'pt', translations: {} },
            },
        },
    };

    const lockData = { widget: rule.widget || (rule.settings && rule.settings.widget_json) || null };
    const settings = lockData.widget && lockData.widget.settings;

    assert.equal(configure(settings.language), 'pt');
    assert.equal(translate('header.locked'), '🔒 Acesso restrito');
    assert.equal(translate('label.passcode'), 'Inserir código');
    assert.equal(translate('button.submit'), 'Enviar');
    configure(null);
});

// ---------------------------------------------------------------------------
// Baked labels on a multi-language store
//
// In AUTO mode PopupTextBaker writes each generated label as a locale-keyed
// object ({default, en, pt-pt, …}) rather than a string. Requirements are
// consumed by several renderers, and one that interpolates the value directly
// used to print "[object Object]" above the input.
// ---------------------------------------------------------------------------

const BAKED_EMAIL_LABEL = {
    default: 'Email Address',
    en: 'Email Address',
    'pt-pt': 'Endereço de e-mail',
    ur: 'ای میل ایڈریس',
};

/**
 * Requirements as they are built on a page served in `locale`, with
 * access_utils.js loaded the way the theme block loads it.
 *
 * AccessUtils reads the locale from the document at call time, not at load
 * time, so the stub has to stay installed for the duration of the call.
 */
function requirementsIn(locale, conds) {
    const ctx = { window: {} };
    const previousDocument = globalThis.document;
    globalThis.document = { getElementById: () => null, documentElement: { lang: locale } };
    try {
        new Function('window', read('access_utils.js')).call(ctx, ctx.window);
        new Function('window', read('access_i18n.js')).call(ctx, ctx.window);
        new Function('window', read('access_validator.js')).call(ctx, ctx.window);

        return ctx.window.AccessValidator.getPasscodeRequirements(conds);
    } finally {
        globalThis.document = previousDocument;
    }
}

test('a baked label never reaches a renderer as an object', () => {
    const conds = [group([{ type: 'emailFromList', value: 'a@x.com', label: BAKED_EMAIL_LABEL }])];

    for (const req of getPasscodeRequirements(conds)) {
        assert.equal(typeof req.customLabel, 'string');
        assert.equal(typeof req.label, 'string');
        assert.equal(typeof req.displayLabel, 'string');
        assert.ok(!`${req.displayLabel}`.includes('[object'), 'renders as text, not [object Object]');
    }
});

test('a baked label resolves to the language the shopper is browsing in', () => {
    const conds = [group([{ type: 'emailFromList', value: 'a@x.com', label: BAKED_EMAIL_LABEL }])];

    assert.equal(requirementsIn('pt-PT', conds)[0].displayLabel, 'Endereço de e-mail');
    assert.equal(requirementsIn('ur', conds)[0].displayLabel, 'ای میل ایڈریس');
    assert.equal(requirementsIn('en', conds)[0].displayLabel, 'Email Address');
});

test('an unlisted browsing language falls back to default, then to the first entry', () => {
    const conds = (label) => [group([{ type: 'emailFromList', value: 'a@x.com', label }])];

    assert.equal(
        requirementsIn('fr', conds(BAKED_EMAIL_LABEL))[0].displayLabel,
        'Email Address',
        'default wins when the shopper language is not in the object',
    );
    assert.equal(
        requirementsIn('fr', conds({ 'pt-pt': 'Endereço de e-mail', ur: 'ای میل ایڈریس' }))[0].displayLabel,
        'Endereço de e-mail',
        'no default: the first language in the object wins, rather than rendering nothing',
    );
});

test('two baked labels of the same kind still get numbered', () => {
    // `label` doubles as a grouping key. While it held an object every field
    // collapsed into one "[object Object]" bucket, so the numbering that tells
    // a customer which box takes which value was computed against the wrong
    // counts.
    const conds = [group([
        { type: 'specificEmail', value: 'x@y.com', label: BAKED_EMAIL_LABEL },
        { type: 'emailFromList', value: 'a@b.com', label: BAKED_EMAIL_LABEL },
    ])];
    const reqs = requirementsIn('en', conds);

    assert.deepEqual(reqs.map((r) => r.displayLabel), ['Email Address', 'Email Address']);
    assert.equal(reqs[0].label, reqs[1].label, 'both share one grouping key');
});

test('a merchant-typed string label is still used verbatim', () => {
    const conds = [group([{ type: 'emailFromList', value: 'a@x.com', label: 'Members only' }])];
    assert.equal(requirementsIn('pt-PT', conds)[0].displayLabel, 'Members only');
});

// ---------------------------------------------------------------------------
// Paired credentials — one passcode per email address
//
// An email allow-list and a passcode list are independent conditions: any
// listed code opens the lock for any listed address. This type asks the paired
// question instead, and is the only condition that consumes TWO popup inputs.
// ---------------------------------------------------------------------------

const PAIRS = 'alice@x.com,AAA-1\nbob@x.com,BBB-2\ncarol@x.com,CCC-3';
const paired = (value = PAIRS) => [group([{ type: 'pairedCredentials', value }])];

test('a paired condition generates one email field and one passcode field', () => {
    const reqs = getPasscodeRequirements(paired());
    assert.deepEqual(reqs.map((r) => r.field), ['email', 'passcode']);
    assert.deepEqual(reqs.map((r) => r.labelKey), ['label.email', 'label.passcode']);
    assert.deepEqual(reqs.map((r) => r.displayLabel), ['Email Address', 'Enter Passcode']);
});

test('a baked condition label must not relabel the email box', () => {
    // PopupTextBaker writes one label per condition, and the storefront applies
    // it to the condition's FIRST field. For a two-field condition that put
    // "Enter Passcode" above the email input, so labelKeyFor() now refuses to
    // bake one for this type. This asserts the shape that used to break.
    const reqs = getPasscodeRequirements([group([
        { type: 'pairedCredentials', value: PAIRS, label: 'Enter Passcode' },
    ])]);
    assert.deepEqual(reqs.map((r) => r.displayLabel), ['Enter Passcode', 'Enter Passcode']);
});

test('a passcode only opens the lock for the address it was issued to', () => {
    const ok = (email, code) => evaluateConditionsWithInputs(paired(), GUEST, [email, code]);

    assert.ok(ok('alice@x.com', 'AAA-1'), 'own code');
    assert.ok(ok('ALICE@X.com', 'AAA-1'), 'address case does not matter');
    assert.ok(ok('bob@x.com', 'BBB-2'));
    // The behaviour the separate email/passcode lists could not express.
    assert.ok(!ok('alice@x.com', 'BBB-2'), "another customer's code must not work");
    assert.ok(!ok('mallory@x.com', 'AAA-1'), 'an address not on the list');
});

test('both halves are required', () => {
    const ok = (email, code) => evaluateConditionsWithInputs(paired(), GUEST, [email, code]);

    assert.ok(!ok('alice@x.com', ''), 'email alone');
    assert.ok(!ok('', 'AAA-1'), 'code alone');
    assert.ok(!ok('', ''));
});

test('a signed-in customer can leave the email box blank', () => {
    const alice = { loggedIn: true, email: 'alice@x.com', tags: [] };

    assert.ok(evaluateConditionsWithInputs(paired(), alice, ['', 'AAA-1']), 'account email is used');
    assert.ok(!evaluateConditionsWithInputs(paired(), alice, ['', 'BBB-2']), "but not with someone else's code");
});

test('the second field does not steal the next condition input', () => {
    // Regression guard for the input iterator: every other condition consumes
    // exactly one input, so a two-field condition must advance it by two or
    // every later field reads the wrong box.
    const conds = [group([
        { type: 'pairedCredentials', value: PAIRS },
        { type: 'singlePasscode', value: 'SHARED' },
    ])];
    assert.deepEqual(getPasscodeRequirements(conds).map((r) => r.field), ['email', 'passcode', 'passcode']);

    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['alice@x.com', 'AAA-1', 'SHARED']));
    assert.ok(!evaluateConditionsWithInputs(conds, GUEST, ['alice@x.com', 'AAA-1', 'WRONG']));
    assert.ok(!evaluateConditionsWithInputs(conds, GUEST, ['alice@x.com', 'BBB-2', 'SHARED']));
});

test('inputs still line up when an earlier OR group fails', () => {
    const conds = [
        group([{ type: 'pairedCredentials', value: PAIRS }]),
        group([{ type: 'singlePasscode', value: 'BACKUP' }]),
    ];
    // Three fields: email, passcode, backup passcode.
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['', '', 'BACKUP']), 'second group reads the third box');
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['alice@x.com', 'AAA-1', '']), 'first group passes');
    assert.ok(!evaluateConditionsWithInputs(conds, GUEST, ['alice@x.com', 'BBB-2', 'NOPE']));
});

test('a passcode containing the separator still matches', () => {
    const conds = paired('dan@x.com,VIP,24');
    assert.ok(evaluateConditionsWithInputs(conds, GUEST, ['dan@x.com', 'VIP,24']));
    assert.ok(!evaluateConditionsWithInputs(conds, GUEST, ['dan@x.com', 'VIP']));
});

test('a merchant-typed label names the first field only', () => {
    const conds = [group([{ type: 'pairedCredentials', value: PAIRS, label: 'Your registered email' }])];
    const reqs = getPasscodeRequirements(conds);

    assert.equal(reqs[0].displayLabel, 'Your registered email');
    assert.equal(reqs[1].displayLabel, 'Enter Passcode', 'the passcode field keeps its own default');
});
