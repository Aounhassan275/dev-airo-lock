import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
    CONTENT_TYPE_BY_RESOURCE,
    RESOURCE_TYPE_BY_CONTENT,
    findBySelectionId,
    itemListsByType,
    selectionId,
    storeItem,
} from '../../resources/js/lib/lockItems.js';

// A real `stores` row: numeric primary key, no handle column.
const STORE_ROW = { id: 7, shop_id: 3, name: 'Acme', url: 'https://acme.myshopify.com' };
const PRODUCT = { id: 12, shopify_product_id: '999', handle: 'blue-shirt', title: 'Blue Shirt' };

test('an "Entire store" selection resolves back to the store, whatever the stores row id is', () => {
    const lists = itemListsByType({ store: STORE_ROW });
    const selId = selectionId('store', lists.store[0]);

    assert.equal(selId, 'store-online_store');
    // The regression: the picker synthesized `store-online_store` while the save
    // payload and the summary looked the selection up against the raw stores row
    // (`store-7`). Nothing matched, so the Selected Items card rendered empty and
    // the shop rule was dropped from the save.
    assert.deepEqual(findBySelectionId(lists.store, 'store', selId), lists.store[0]);
    assert.notEqual(selId, `store-${STORE_ROW.id}`);
});

test('the store item still resolves before the shop has synced a stores row', () => {
    const lists = itemListsByType({ store: null });
    assert.ok(findBySelectionId(lists.store, 'store', 'store-online_store'));
});

test('a shop rule round-trips: rule -> selection id -> payload item', () => {
    const lists = itemListsByType({ store: STORE_ROW });

    // Hydration: the rule names a resource_type, not a picker row.
    const contentType = CONTENT_TYPE_BY_RESOURCE.shop;
    const item = lists[contentType][0];
    const selId = selectionId(contentType, item);

    // Save: the selection id has to find its way back to a payload item.
    const found = findBySelectionId(lists[contentType], contentType, selId);
    assert.ok(found, 'the selection must resolve, or the rule gets deleted on save');
    assert.equal(RESOURCE_TYPE_BY_CONTENT[contentType], 'shop');
    // Empty handle is the existing convention for shop rules; the backend keys
    // rules on (resource_type|handle), so changing it would churn the rule.
    assert.equal(found.handle, '');
});

test('products key off the Shopify id, falling back to the local row id when it is missing', () => {
    const unsynced = { id: 44, shopify_product_id: null, handle: 'new-thing' };
    const lists = itemListsByType({ products: [PRODUCT, unsynced] });

    assert.equal(selectionId('products', PRODUCT), 'products-999');
    assert.equal(selectionId('products', unsynced), 'products-44');
    assert.equal(findBySelectionId(lists.products, 'products', 'products-999'), PRODUCT);
    assert.equal(findBySelectionId(lists.products, 'products', 'products-44'), unsynced);
});

test('a resource missing from the picker resolves to null rather than a wrong item', () => {
    const lists = itemListsByType({ products: [PRODUCT] });
    assert.equal(findBySelectionId(lists.products, 'products', 'products-does-not-exist'), null);
});

test('every content type maps back to the resource type it came from', () => {
    for (const [contentType, resourceType] of Object.entries(RESOURCE_TYPE_BY_CONTENT)) {
        assert.equal(CONTENT_TYPE_BY_RESOURCE[resourceType], contentType);
    }
});

test('storeItem does not leak the raw row id into the picker', () => {
    assert.equal(storeItem(STORE_ROW).id, 'online_store');
    assert.equal(storeItem(STORE_ROW).title, 'Entire Store');
});
