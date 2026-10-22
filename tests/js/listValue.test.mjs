import assert from 'node:assert/strict';
import { test } from 'node:test';

import { joinListValue, splitListValue } from '../../resources/js/lib/listValue.js';

test('canonical newline-joined values split per line', () => {
    assert.deepEqual(splitListValue('1122\n1111'), ['1122', '1111']);
    assert.deepEqual(splitListValue('a\r\nb'), ['a', 'b'], 'CRLF saves too');
});

test('a legacy backslash-separated save splits into its values', () => {
    // The old placeholder showed a literal "\n", so merchants typed
    // 123\2222\3333 on one line — that whole string became one passcode.
    assert.deepEqual(splitListValue('123\\2222\\3333'), ['123', '2222', '3333']);
    assert.deepEqual(splitListValue('p1\\np2\\np3'), ['p1', 'p2', 'p3'], 'literal \\n typed verbatim');
});

test('plain single values pass through untouched', () => {
    assert.deepEqual(splitListValue('1234'), ['1234']);
    assert.deepEqual(splitListValue(''), ['']);
    assert.deepEqual(splitListValue(null), ['']);
});

test('empty fields survive a split/join round trip while editing', () => {
    assert.deepEqual(splitListValue('a\n'), ['a', '']);
    assert.equal(joinListValue(['a', '']), 'a\n');
    assert.equal(joinListValue(splitListValue('a\n\nb')), 'a\n\nb');
});

test('a repaired legacy value joins into the canonical form', () => {
    assert.equal(joinListValue(splitListValue('123\\2222\\3333')), '123\n2222\n3333');
});
