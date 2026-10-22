import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    countDuplicateEmails,
    formatPair,
    isCompletePair,
    joinPairs,
    pairsToCsv,
    pairTemplateCsv,
    parseBulkPairs,
    parsePair,
    splitPairs,
} from '../../resources/js/lib/pairList.js';

const BOM = String.fromCharCode(0xfeff);

test('a stored line splits into its two halves', () => {
    assert.deepEqual(parsePair('alice@x.com,AAA-1'), { email: 'alice@x.com', passcode: 'AAA-1' });
    assert.deepEqual(parsePair('  Alice@X.com ,  AAA-1  '), { email: 'alice@x.com', passcode: 'AAA-1' });
});

test('semicolon, tab and colon separate a pair too', () => {
    for (const line of ['a@x.com;C1', 'a@x.com\tC1', 'a@x.com:C1']) {
        assert.deepEqual(parsePair(line), { email: 'a@x.com', passcode: 'C1' }, line);
    }
});

test('only the FIRST separator splits, so a passcode may contain one', () => {
    // An email can contain none of the separators, so everything after the
    // first one belongs to the code.
    assert.deepEqual(parsePair('a@x.com,VIP,24'), { email: 'a@x.com', passcode: 'VIP,24' });
    assert.deepEqual(parsePair('a@x.com,10:30'), { email: 'a@x.com', passcode: '10:30' });
});

test('a line with no separator is an email with no passcode', () => {
    assert.deepEqual(parsePair('a@x.com'), { email: 'a@x.com', passcode: '' });
    assert.ok(!isCompletePair(parsePair('a@x.com')));
    assert.ok(!isCompletePair(parsePair('a@x.com,')));
    assert.ok(isCompletePair(parsePair('a@x.com,1')));
});

test('rows round-trip through the stored value unchanged', () => {
    const rows = [
        { email: 'a@x.com', passcode: 'A1' },
        { email: 'b@x.com', passcode: 'B2' },
    ];
    assert.equal(joinPairs(rows), 'a@x.com,A1\nb@x.com,B2');
    assert.deepEqual(splitPairs(joinPairs(rows)), rows);
});

test('an empty value still gives the editor one blank row', () => {
    assert.deepEqual(splitPairs(''), [{ email: '', passcode: '' }]);
    assert.equal(formatPair({ email: '', passcode: '' }), '');
});

test('bulk paste builds pairs and reports what it dropped', () => {
    const { pairs, invalid, duplicates } = parseBulkPairs(
        'alice@x.com,A1\nbob@x.com,B2\nno-code@x.com\n,orphan-code\nnot-an-email,C3',
    );
    assert.deepEqual(pairs, [
        { email: 'alice@x.com', passcode: 'A1' },
        { email: 'bob@x.com', passcode: 'B2' },
    ]);
    assert.deepEqual(invalid, ['no-code@x.com', ',orphan-code', 'not-an-email,C3']);
    assert.equal(duplicates, 0);
});

test('an address already on the list is a duplicate even with a different code', () => {
    // One passcode per address is the whole point of the type, so the second
    // code for the same person is dropped rather than silently shadowed.
    const { pairs, duplicates } = parseBulkPairs('alice@x.com,NEW\ncarol@x.com,C3', {
        existing: [{ email: 'alice@x.com', passcode: 'OLD' }],
    });
    assert.deepEqual(pairs, [{ email: 'carol@x.com', passcode: 'C3' }]);
    assert.equal(duplicates, 1);
});

test('a repeat inside one paste is counted once', () => {
    const { pairs, duplicates } = parseBulkPairs('a@x.com,1\nA@X.com,2');
    assert.deepEqual(pairs, [{ email: 'a@x.com', passcode: '1' }]);
    assert.equal(duplicates, 1);
});

test('an exported file re-imports to exactly the same pairs', () => {
    const rows = [
        { email: 'alice@x.com', passcode: 'A1' },
        { email: 'bob@x.com', passcode: 'VIP,24' },
    ];
    const csv = pairsToCsv(rows);
    assert.ok(csv.startsWith(BOM), 'Excel reads it as UTF-8');
    assert.ok(csv.includes('"VIP,24"'), 'a code containing the separator is quoted');

    const { pairs, invalid } = parseBulkPairs(csv);
    assert.deepEqual(pairs, rows);
    assert.deepEqual(invalid, ['email,passcode'], 'the heading is skipped, not imported');
});

test('the template is a fillable file in the same format', () => {
    const { pairs, invalid } = parseBulkPairs(pairTemplateCsv());
    assert.equal(pairs.length, 3);
    assert.deepEqual(invalid, ['email,passcode']);
    assert.ok(pairs.every(isCompletePair));
});

test('duplicate emails are counted for the editor warning', () => {
    assert.equal(countDuplicateEmails([{ email: 'a@x.com' }, { email: 'A@X.com' }, { email: 'b@x.com' }]), 1);
    assert.equal(countDuplicateEmails([{ email: '' }, { email: '' }]), 0, 'blank rows are not duplicates');
});

test('a 200-pair paste survives intact', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `customer${i}@example.com,CODE-${i}`);
    const { pairs, invalid, duplicates } = parseBulkPairs(lines.join('\n'));
    assert.equal(pairs.length, 200);
    assert.deepEqual(invalid, []);
    assert.equal(duplicates, 0);
    assert.deepEqual(pairs[199], { email: 'customer199@example.com', passcode: 'CODE-199' });
});
