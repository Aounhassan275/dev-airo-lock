import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    SORT_COLUMN_BY_FIELD,
    SORT_FIELD_BY_COLUMN,
    filterAndSortLocks,
    matchesQuery,
} from '../../resources/js/lib/lockList.js';

const lock = (over = {}) => ({
    id: '1',
    name: 'Annie Beatty',
    description: '',
    status: 'Active',
    type: 'standard',
    itemCount: 1,
    resourceTypes: [{ type: 'product', count: 1 }],
    ...over,
});

const names = (locks) => locks.map((l) => l.name);

test('search matches name, description, id and what the lock protects', () => {
    const shirt = lock({ id: '91', name: 'Annie Beatty', description: 'VIP only' });
    assert.ok(matchesQuery(shirt, 'annie'), 'by name, case-insensitively');
    assert.ok(matchesQuery(shirt, 'vip'), 'by description');
    assert.ok(matchesQuery(shirt, '91'), 'by the ID shown in the row');
    assert.ok(matchesQuery(shirt, 'product'), 'by what it protects');
    assert.ok(!matchesQuery(shirt, 'blog'), 'and nothing else');
});

test('a pasted name with stray whitespace still matches', () => {
    assert.ok(matchesQuery(lock({ name: 'Annie Beatty' }), '  Annie  '));
});

test('an empty query keeps every lock', () => {
    const all = [lock({ id: '1' }), lock({ id: '2', name: 'Zed' })];
    assert.equal(filterAndSortLocks(all, { query: '   ' }).length, 2);
});

test('a store-wide lock is findable by "store", not by "product"', () => {
    const storewide = lock({ name: 'Whole shop', resourceTypes: [{ type: 'shop', count: 1 }] });
    assert.ok(matchesQuery(storewide, 'store'), '"Entire store" label');
    assert.ok(!matchesQuery(storewide, 'product'));
});

test('status filter narrows to the chosen statuses', () => {
    const all = [
        lock({ id: '1', name: 'On', status: 'Active' }),
        lock({ id: '2', name: 'Off', status: 'Inactive' }),
    ];
    assert.deepEqual(names(filterAndSortLocks(all, { statuses: ['Inactive'] })), ['Off']);
    assert.deepEqual(names(filterAndSortLocks(all, { statuses: ['Active', 'Inactive'] })), ['Off', 'On']);
    assert.equal(filterAndSortLocks(all, { statuses: [] }).length, 2, 'no filter means no narrowing');
});

test('search and status filter compose', () => {
    const all = [
        lock({ id: '1', name: 'Summer sale', status: 'Active' }),
        lock({ id: '2', name: 'Summer preview', status: 'Inactive' }),
    ];
    assert.deepEqual(
        names(filterAndSortLocks(all, { query: 'summer', statuses: ['Active'] })),
        ['Summer sale'],
    );
});

test('sorting by items orders by item count, ascending and descending', () => {
    const all = [
        lock({ id: '1', name: 'Few', itemCount: 2 }),
        lock({ id: '2', name: 'Many', itemCount: 30 }),
        lock({ id: '3', name: 'None', itemCount: 0 }),
    ];
    // Regression: the Items header used to sort by status, because the table's
    // column index (2) was fed straight into a comparator that read 2 as
    // "status". Numerically, too — not '30' < '2' as strings.
    assert.deepEqual(
        names(filterAndSortLocks(all, { sort: { field: 'items', direction: 'ascending' } })),
        ['None', 'Few', 'Many'],
    );
    assert.deepEqual(
        names(filterAndSortLocks(all, { sort: { field: 'items', direction: 'descending' } })),
        ['Many', 'Few', 'None'],
    );
});

test('sorting by status actually reorders (the Status header used to be inert)', () => {
    const all = [
        lock({ id: '1', name: 'Off', status: 'Inactive' }),
        lock({ id: '2', name: 'On', status: 'Active' }),
    ];
    assert.deepEqual(
        names(filterAndSortLocks(all, { sort: { field: 'status', direction: 'ascending' } })),
        ['On', 'Off'],
    );
});

test('sorting by name is the default and honours direction', () => {
    const all = [lock({ id: '1', name: 'Zed' }), lock({ id: '2', name: 'Amy' })];
    assert.deepEqual(names(filterAndSortLocks(all, {})), ['Amy', 'Zed']);
    assert.deepEqual(
        names(filterAndSortLocks(all, { sort: { field: 'name', direction: 'descending' } })),
        ['Zed', 'Amy'],
    );
});

test('the column/field sort maps are exact inverses of each other', () => {
    for (const [field, column] of Object.entries(SORT_COLUMN_BY_FIELD)) {
        assert.equal(SORT_FIELD_BY_COLUMN[column], field, `column ${column} must map back to ${field}`);
    }
    // Columns the table marks unsortable must not resolve to a field, or a
    // header click would silently sort by something else.
    for (const column of [1, 3, 4, 6]) {
        assert.equal(SORT_FIELD_BY_COLUMN[column], undefined);
    }
});
