// Selection ids for the lock item picker.
//
// Every selected item is identified by `${contentType}-${id}`. Catalog
// resources take that id from their synced row; the store has no row of its own
// in the picker, so it gets a synthetic one. That synthetic id must be used by
// EVERY place that builds or resolves a selection id — picker, hydration,
// selected-items summary, save payload — or an item selected in one place
// cannot be found in another.
//
// Keeping the raw `stores` record (with its numeric primary key, and no handle
// column at all) in some of those maps while the picker synthesized
// `online_store` is what made "Entire store" locks open with an empty Selected
// Items list and silently drop their shop rule on save.

export const STORE_ITEM_ID = 'online_store';

// The shop rule's handle stays empty. That is what every shop rule in the
// database already carries (the stores table has no handle), and the backend
// keys rules on (resource_type|handle) when syncing a lock — sending a
// different handle would delete the existing rule and recreate it, churning its
// Shopify metafield. Shop-wide lookups ignore the handle anyway; see
// ProxyController ("Shop-wide locks aren't keyed by handle").
export function storeItem(store) {
    return {
        ...(store || {}),
        id: STORE_ITEM_ID,
        name: 'Entire Store',
        title: 'Entire Store',
        handle: '',
    };
}

export const CHECKOUT_ITEM = {
    id: 'shop',
    handle: 'checkout',
    title: 'Storefront Checkout',
    name: 'Storefront Checkout',
};

const ID_FIELD_BY_TYPE = {
    products: 'shopify_product_id',
    collections: 'shopify_collection_id',
    pages: 'shopify_page_id',
    blogs: 'shopify_blog_id',
    themes: 'shopify_theme_id',
};

// Falls back to the local row id when the Shopify id is missing (sync lag).
export function selectionId(type, item) {
    const idField = ID_FIELD_BY_TYPE[type] || 'id';
    return `${type}-${item[idField] || item.id}`;
}

export function findBySelectionId(items, type, selId) {
    return (items || []).find((item) => selectionId(type, item) === selId) || null;
}

// The lists every selection id is resolved against, keyed by content type.
export function itemListsByType({
    products = [],
    collections = [],
    pages = [],
    blogs = [],
    themes = [],
    variants = [],
    store = null,
} = {}) {
    return {
        products,
        collections,
        pages,
        blogs,
        themes,
        variants,
        store: [storeItem(store)],
        checkout: [CHECKOUT_ITEM],
    };
}

// contentType (picker) <-> resource_type (database).
export const CONTENT_TYPE_BY_RESOURCE = {
    product: 'products',
    collection: 'collections',
    page: 'pages',
    blog: 'blogs',
    theme: 'themes',
    variant: 'variants',
    shop: 'store',
    store: 'store',
    checkout: 'checkout',
};

export const RESOURCE_TYPE_BY_CONTENT = {
    products: 'product',
    collections: 'collection',
    pages: 'page',
    blogs: 'blog',
    themes: 'theme',
    variants: 'variant',
    store: 'shop',
    checkout: 'checkout',
};
