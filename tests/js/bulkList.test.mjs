import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    countDuplicates,
    isValidEmail,
    listFilename,
    listHeader,
    parseBulkList,
    templateCsv,
    toCsv,
} from '../../resources/js/lib/bulkList.js';

const BOM = String.fromCharCode(0xfeff);

test('a pasted column of values becomes one value per line', () => {
    const { values, invalid, duplicates } = parseBulkList('VIP-1\nVIP-2\nVIP-3');
    assert.deepEqual(values, ['VIP-1', 'VIP-2', 'VIP-3']);
    assert.deepEqual(invalid, []);
    assert.equal(duplicates, 0);
});

test('spreadsheet separators split too', () => {
    assert.deepEqual(parseBulkList('a, b; c\td').values, ['a', 'b', 'c', 'd']);
    assert.deepEqual(parseBulkList('a\r\nb').values, ['a', 'b'], 'CRLF');
    // Backslash is the reserved legacy separator (see listValue.js).
    assert.deepEqual(parseBulkList('a\\b').values, ['a', 'b']);
    assert.deepEqual(parseBulkList('p1\\np2').values, ['p1', 'p2'], 'literal \\n typed verbatim');
});

test('blank lines and CSV quoting are stripped', () => {
    assert.deepEqual(parseBulkList('a\n\n  \nb').values, ['a', 'b']);
    assert.deepEqual(parseBulkList('"a"\n\'b\'').values, ['a', 'b']);
});

test('values already in the list are skipped, not duplicated', () => {
    const { values, duplicates } = parseBulkList('a\nb\nc', { existing: ['b'] });
    assert.deepEqual(values, ['a', 'c']);
    assert.equal(duplicates, 1);
});

test('repeats inside one paste are counted once', () => {
    const { values, duplicates } = parseBulkList('a\na\na');
    assert.deepEqual(values, ['a']);
    assert.equal(duplicates, 2);
});

test('email lists lowercase, and match existing entries case-insensitively', () => {
    const { values, duplicates } = parseBulkList('VIP@Example.com\nother@example.com', {
        kind: 'email',
        existing: ['vip@example.com'],
    });
    assert.deepEqual(values, ['other@example.com']);
    assert.equal(duplicates, 1);
});

test('a CSV header row and other junk land in invalid, not in the list', () => {
    const { values, invalid } = parseBulkList('Customer email\nreal@example.com\nnot-an-email', { kind: 'email' });
    assert.deepEqual(values, ['real@example.com']);
    assert.deepEqual(invalid, ['customer email', 'not-an-email']);
});

test('passcode lists accept values an email list would reject', () => {
    assert.deepEqual(parseBulkList('Customer email\n1234', { kind: 'passcode' }).values, ['Customer email', '1234']);
});

test('email validation is permissive but rejects obvious non-addresses', () => {
    assert.ok(isValidEmail('a.b+tag@sub.example.co.uk'));
    assert.ok(!isValidEmail('a@b'));
    assert.ok(!isValidEmail('no-at-sign.example.com'));
    assert.ok(!isValidEmail(''));
});

test('duplicate counting matches the field warning', () => {
    assert.equal(countDuplicates(['a', 'b', 'a', '']), 1);
    assert.equal(countDuplicates(['A@x.com', 'a@x.com'], 'email'), 1);
    assert.equal(countDuplicates(['A@x.com', 'a@x.com'], 'passcode'), 0, 'passcodes are case-sensitive');
});

// ---------------------------------------------------------------------------
// Download format
// ---------------------------------------------------------------------------

test('an exported list is a single column under a heading', () => {
    const csv = toCsv(['VIP-1', 'VIP-2'], 'passcode');
    assert.equal(csv, `${BOM}passcode\r\nVIP-1\r\nVIP-2\r\n`);
    assert.equal(listHeader('email'), 'email');
    assert.match(listFilename('email'), /\.csv$/);
});

test('the exported file carries a BOM so Excel reads it as UTF-8', () => {
    assert.ok(toCsv(['a@x.com'], 'email').startsWith(BOM));
});

test('a value that would break the column is quoted', () => {
    assert.equal(toCsv(['plain', 'has,comma', 'has"quote'], 'passcode'), `${BOM}passcode\r\nplain\r\n"has,comma"\r\n"has""quote"\r\n`);
});

test('an exported list re-imports to exactly the same values', () => {
    // The round trip merchants will actually do: download, edit in a
    // spreadsheet, upload back. The heading must not become an entry and the
    // BOM must not ride along on the first value.
    const emails = ['a@x.com', 'b@x.com', 'c@x.com'];
    const { values, invalid, duplicates } = parseBulkList(toCsv(emails, 'email'), { kind: 'email' });
    assert.deepEqual(values, emails);
    assert.deepEqual(invalid, ['email'], 'the heading is reported as skipped, not imported');
    assert.equal(duplicates, 0);
});

test('a passcode export re-imports without inventing a "passcode" entry', () => {
    // Regression guard: an email heading fails the address check on its own,
    // but a passcode heading is a perfectly valid passcode string.
    const { values, invalid } = parseBulkList(toCsv(['VIP-1', 'VIP-2'], 'passcode'), { kind: 'passcode' });
    assert.deepEqual(values, ['VIP-1', 'VIP-2']);
    assert.deepEqual(invalid, ['passcode']);
});

test('a heading is only stripped at the top of the list', () => {
    const { values } = parseBulkList('VIP-1\ncode\nVIP-2', { kind: 'passcode' });
    assert.deepEqual(values, ['VIP-1', 'code', 'VIP-2'], 'a value reading "code" further down is real data');
});

test('the template is a fillable file in the same format', () => {
    const { values, invalid } = parseBulkList(templateCsv('email'), { kind: 'email' });
    assert.equal(values.length, 3, 'example rows');
    assert.deepEqual(invalid, ['email']);
    assert.ok(values.every(isValidEmail));
});

test('a 200-entry paste survives intact', () => {
    const emails = Array.from({ length: 200 }, (_, i) => `customer${i}@example.com`);
    const { values, invalid, duplicates } = parseBulkList(emails.join('\n'), { kind: 'email' });
    assert.equal(values.length, 200);
    assert.deepEqual(invalid, []);
    assert.equal(duplicates, 0);
});
