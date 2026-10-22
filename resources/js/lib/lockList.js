// Search / filter / sort for the lock list. Pure, so it can be tested without
// rendering the dashboard — see tests/js/lockList.test.mjs.

import { lockKindLabel, resourceTypeLabel } from './resourceTypes.js';

// Which table heading each sortable field lives under. The IndexTable's column
// indices (Lock Name 0, Type 1, Items 2, Created 3, Updated 4, Status 5) are
// NOT the same numbering the comparator uses; keeping one map for both
// directions is what stops them drifting apart.
export const SORT_COLUMN_BY_FIELD = { name: 0, items: 2, status: 5 };
export const SORT_FIELD_BY_COLUMN = { 0: 'name', 2: 'items', 5: 'status' };

// Everything a merchant might reasonably type to find a lock: its name, its
// description, the ID shown under the name, what it protects ("product",
// "3 Products", "Entire store") and its kind ("Hide price").
function searchableFields(lock) {
    return [
        lock.name,
        lock.description,
        String(lock.id),
        lockKindLabel(lock.type),
        ...(lock.resourceTypes ?? []).flatMap(({ type, count }) => [type, resourceTypeLabel(type, count)]),
    ].filter(Boolean);
}

export function matchesQuery(lock, query) {
    const q = (query ?? '').trim().toLowerCase();
    if (!q) return true;
    return searchableFields(lock).some((field) => field.toLowerCase().includes(q));
}

export function sortLocks(locks, { field = 'name', direction = 'ascending' } = {}) {
    return [...locks].sort((a, b) => {
        let cmp = 0;
        if (field === 'items') cmp = a.itemCount - b.itemCount;
        else if (field === 'status') cmp = a.status.localeCompare(b.status);
        else cmp = a.name.localeCompare(b.name);
        return direction === 'ascending' ? cmp : -cmp;
    });
}

export function filterAndSortLocks(locks, { query = '', statuses = [], sort } = {}) {
    let result = locks.filter((lock) => matchesQuery(lock, query));
    if (statuses.length > 0) {
        result = result.filter((lock) => statuses.includes(lock.status));
    }
    return sortLocks(result, sort);
}
