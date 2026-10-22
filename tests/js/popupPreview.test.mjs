import assert from 'node:assert/strict';
import { test } from 'node:test';

import { inputFieldsFor, previewFields, resolvePopupCopy } from '../../resources/js/lib/popupPreview.js';

// Stands in for the translation catalog. The expected values are the real
// English strings, so a drift in the catalog shows up as a failure here too.
const DEFAULTS = {
    'header.locked': '🔒 Access Required',
    'prompt.default': 'Access restricted.',
    'button.submit': 'Submit',
    'label.passcode': 'Enter Passcode',
    'placeholder.code': 'Enter code',
    'label.email': 'Email Address',
    'placeholder.email': 'Enter your email',
    'label.dob': 'Date of Birth',
};
const translate = (key) => DEFAULTS[key] ?? key;

const resolve = (opts) => resolvePopupCopy({ translate, ...opts });

test('with nothing set, every string is the translated default', () => {
    const copy = resolve({});
    assert.equal(copy.title, '🔒 Access Required');
    assert.equal(copy.description, 'Access restricted.');
    assert.equal(copy.button, 'Submit');
    assert.equal(copy.passcodeLabel, 'Enter Passcode');
    assert.equal(copy.emailPlaceholder, 'Enter your email');
});

test('the widget beats the default', () => {
    const design = {
        headerSettings: { text: 'Members only' },
        layout: { buttonText: 'Go' },
        placeholderText: 'code',
        emailPlaceholderText: 'email',
    };
    const copy = resolve({ design });
    assert.equal(copy.title, 'Members only');
    assert.equal(copy.button, 'Go');
    assert.equal(copy.passcodePlaceholder, 'code');
    assert.equal(copy.emailPlaceholder, 'email');
});

test('the lock override beats the widget', () => {
    const design = { headerSettings: { text: 'Members only' }, layout: { buttonText: 'Go' } };
    const copy = resolve({ design, text: { header: 'VIP Early Access' } });

    assert.equal(copy.title, 'VIP Early Access');
    assert.equal(copy.button, 'Go', 'an untouched field keeps the widget wording');
});

test('a blank or whitespace override is not an override', () => {
    const design = { headerSettings: { text: 'Members only' }, layout: { buttonText: 'Go' } };
    const copy = resolve({ design, text: { header: '', button: '   ' } });

    assert.equal(copy.title, 'Members only');
    assert.equal(copy.button, 'Go');
});

test('labels never consult the widget', () => {
    // Labels are written onto the CONDITION server-side, so a widget has no
    // say in them — only the override and the translated default.
    const design = { headerSettings: { text: 'x' }, placeholderText: 'from widget' };
    const copy = resolve({ design, text: { passcode_label: 'Your invite code' } });

    assert.equal(copy.passcodeLabel, 'Your invite code');
    assert.equal(resolve({ design }).passcodeLabel, 'Enter Passcode');
});

test('the message line falls back to the generic prompt', () => {
    assert.equal(resolve({ description: '  ' }).description, 'Access restricted.');
    assert.equal(resolve({ description: 'VIPs only until 10am' }).description, 'VIPs only until 10am');
});

// ---------------------------------------------------------------------------
// Which boxes the popup draws
// ---------------------------------------------------------------------------

test('field kinds match the storefront validator', () => {
    assert.deepEqual(inputFieldsFor('singlePasscode'), ['passcode']);
    assert.deepEqual(inputFieldsFor('multiplePasscodes'), ['passcode']);
    assert.deepEqual(inputFieldsFor('emailFromList'), ['email']);
    assert.deepEqual(inputFieldsFor('specificEmail'), ['email']);
    assert.deepEqual(inputFieldsFor('ageVerification'), ['dob']);
    // Two boxes, and NOT matched by the "contains email" test.
    assert.deepEqual(inputFieldsFor('pairedCredentials'), ['email', 'passcode']);
    // Conditions that need no input draw nothing.
    assert.deepEqual(inputFieldsFor('tag'), []);
    assert.deepEqual(inputFieldsFor('signedIn'), []);
    assert.deepEqual(inputFieldsFor('location'), []);
    assert.deepEqual(inputFieldsFor(''), []);
});

test('fields come out in the order the popup renders them', () => {
    const groups = [{ conditions: [{ type: 'pairedCredentials' }, { type: 'singlePasscode' }] }];

    assert.deepEqual(previewFields(groups).map((f) => f.kind), ['email', 'passcode', 'passcode']);
});

test('a condition label applies to that condition s first field only', () => {
    const groups = [{ conditions: [{ type: 'pairedCredentials', label: 'Your registered email' }] }];

    assert.deepEqual(previewFields(groups), [
        { kind: 'email', label: 'Your registered email' },
        { kind: 'passcode', label: null },
    ]);
});

test('a lock whose conditions need no input shows no fields', () => {
    assert.deepEqual(previewFields([{ conditions: [{ type: 'tag' }, { type: 'signedIn' }] }]), []);
    assert.deepEqual(previewFields([]), []);
});
