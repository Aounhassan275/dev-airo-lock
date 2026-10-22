import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// grantStore/readGrant/writeGrant are private to the access_core IIFE, so the
// functions are lifted out of the shipped file and exercised directly. That
// keeps the test honest — it runs the real source, not a copy.
const source = readFileSync(
    fileURLToPath(new URL('../../extensions/access-controll/assets/access_core.js', import.meta.url)),
    'utf8',
);

function extract(name) {
    const start = source.indexOf(`    function ${name}(`);
    assert.notEqual(start, -1, `${name} not found in access_core.js`);
    // Functions in this file are indented four spaces and close on "    }".
    const end = source.indexOf('\n    }\n', start);
    assert.notEqual(end, -1, `could not find the end of ${name}`);

    return source.slice(start, end + 6);
}

/** A storage stub that records what was written, plus one that throws. */
function makeStorage() {
    const data = new Map();
    return {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => data.set(k, v),
        _data: data,
    };
}

function load({ blocked = false } = {}) {
    const local = makeStorage();
    const session = makeStorage();
    const windowStub = blocked
        ? {
              get localStorage() {
                  throw new Error('blocked');
              },
              get sessionStorage() {
                  throw new Error('blocked');
              },
          }
        : { localStorage: local, sessionStorage: session };

    const factory = new Function(
        'window',
        `${extract('grantStore')}\n${extract('readGrant')}\n${extract('writeGrant')}\nreturn { grantStore, readGrant, writeGrant };`,
    );

    return { ...factory(windowStub), local, session };
}

const lock = (reprompt) => ({ lockData: { lock_settings: reprompt === undefined ? {} : { reprompt } } });

test('remember is the default and keeps the old behaviour', () => {
    const { readGrant, writeGrant, local, session } = load();

    writeGrant(lock('remember'), 'k');
    assert.equal(local._data.get('k'), 'granted');
    assert.equal(session._data.size, 0);
    assert.equal(readGrant(lock('remember'), 'k'), 'granted');
});

test('a lock saved before this setting existed still remembers', () => {
    // The single most important case: every existing lock must be unchanged.
    const { readGrant, writeGrant, local } = load();

    writeGrant(lock(undefined), 'k');
    assert.equal(local._data.get('k'), 'granted');
    assert.equal(readGrant(lock(undefined), 'k'), 'granted');
});

test('an unknown mode from a newer admin falls back to remembering', () => {
    const { readGrant, writeGrant, local } = load();

    writeGrant(lock('something-new'), 'k');
    assert.equal(local._data.get('k'), 'granted');
    assert.equal(readGrant(lock('something-new'), 'k'), 'granted');
});

test('session keeps the grant only for this visit', () => {
    const { readGrant, writeGrant, local, session } = load();

    writeGrant(lock('session'), 'k');
    assert.equal(session._data.get('k'), 'granted', 'written to sessionStorage');
    assert.equal(local._data.size, 0, 'and never to localStorage');
    assert.equal(readGrant(lock('session'), 'k'), 'granted', 'still unlocked while browsing');
});

test('always never remembers, so every page asks again', () => {
    const { readGrant, writeGrant, local, session } = load();

    writeGrant(lock('always'), 'k');
    assert.equal(local._data.size, 0);
    assert.equal(session._data.size, 0);
    assert.equal(readGrant(lock('always'), 'k'), null);
});

test('always ignores a flag left behind by an earlier setting', () => {
    // A merchant switching a lock to "ask every page" expects that to take
    // effect for customers who are already unlocked, not just new ones.
    const { readGrant, local } = load();
    local._data.set('k', 'granted');

    assert.equal(readGrant(lock('always'), 'k'), null);
    assert.equal(readGrant(lock('remember'), 'k'), 'granted', 'the flag is still there for other modes');
});

test('settings are also read from the global-config shape', () => {
    // checkAccess sees lock_settings; the strip-locked-items pass builds
    // { lockData: { lock_settings: ls } } — and `settings` is the older name.
    const { writeGrant, local, session } = load();

    writeGrant({ lockData: { settings: { reprompt: 'session' } } }, 'k');
    assert.equal(session._data.get('k'), 'granted');
    assert.equal(local._data.size, 0);
});

test('blocked site data never throws, it just stops remembering', () => {
    // Private mode and blocked cookies throw on ACCESS, before any read or
    // write — an uncaught error there would break the lock entirely.
    const { readGrant, writeGrant } = load({ blocked: true });

    assert.doesNotThrow(() => writeGrant(lock('remember'), 'k'));
    assert.equal(readGrant(lock('remember'), 'k'), null);
});

test('a malformed payload does not throw, and defaults to remembering', () => {
    // Failing open to the old behaviour is the right default here: a lock that
    // forgets how to remember is an annoyance, one that throws is broken.
    const { readGrant, writeGrant, local } = load();

    assert.doesNotThrow(() => writeGrant({}, 'a'));
    assert.doesNotThrow(() => writeGrant(null, 'b'));
    assert.equal(local._data.get('a'), 'granted');
    assert.equal(local._data.get('b'), 'granted');
    assert.equal(readGrant(null, 'a'), 'granted');
    assert.equal(readGrant(null, 'missing'), null);
});
