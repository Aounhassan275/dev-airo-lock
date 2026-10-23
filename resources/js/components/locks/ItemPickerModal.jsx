import { Modal, Pagination, Spinner } from '@shopify/polaris';
import { RefreshIcon, SearchIcon, TYPE_ICONS } from './LockIcons';

// Must match how the builder builds a selection id everywhere else
// (`${type}-${shopifyId || localId}`), or a row never shows as ticked.
const ID_FIELD = {
    products: 'shopify_product_id',
    collections: 'shopify_collection_id',
    pages: 'shopify_page_id',
    blogs: 'shopify_blog_id',
    themes: 'shopify_theme_id',
};

export const pickerSelectionId = (type, item) => `${type}-${item[ID_FIELD[type] || 'id'] || item.id}`;

const NOUNS = {
    products: ['product', 'products'],
    collections: ['collection', 'collections'],
    pages: ['page', 'pages'],
    blogs: ['blog', 'blogs'],
    themes: ['theme', 'themes'],
    store: ['store', 'stores'],
    variants: ['variant', 'variants'],
    checkout: ['checkout', 'checkouts'],
};

export const nounFor = (type, n) => {
    const [one, many] = NOUNS[type] || ['item', 'items'];
    return n === 1 ? one : many;
};

const THUMB_CLASS = {
    products: 'products',
    collections: 'collections',
    pages: 'pages',
    blogs: 'blogs',
    themes: 'liquid-theme',
};

function itemMeta(type, item) {
    if (type === 'products' && item.vendor) return `Vendor: ${item.vendor}`;
    if (type === 'collections' && item.products_count) return `${item.products_count} products`;
    if ((type === 'pages' || type === 'blogs') && item.handle) return `/${type}/${item.handle}`;
    return '';
}

/**
 * The item picker. Every list, filter, page and selection lives in the page
 * that opens it; this only draws them — search, Title/Vendor sort, filters,
 * a toolbar that reports and acts (count, Refresh from Shopify, Select all),
 * the rows, paging and the overlap warning.
 */
export default function ItemPickerModal({
    open,
    onClose,
    contentType,
    searchQuery,
    onSearch,
    searchBy,
    onSearchBy,
    searchOptions = [],
    filterButton = null,
    activeFilterTags = null,
    filteredData = [],
    paginatedData = [],
    isLoading = false,
    selectedItems = [],
    onToggle,
    onSelectAll,
    refreshing = false,
    onRefresh,
    otherLockNameFor,
    currentPage = 1,
    totalPages = 1,
    onPrevPage,
    onNextPage,
    selectedOverlaps = [],
}) {
    const type = contentType || '';
    const many = nounFor(type, 2);
    const pickedHere = filteredData.filter((item) => selectedItems.includes(pickerSelectionId(type, item))).length;
    const allSelected = filteredData.length > 0 && pickedHere === filteredData.length;
    const total = selectedItems.length;

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Select ${type ? many : 'content'}`}
            large
            primaryAction={{
                content: total === 0 ? 'Add selected' : `Add ${total} ${nounFor(type, total)}`,
                onAction: onClose,
                disabled: total === 0,
            }}
            secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
            footer={
                <span className="pg-lock-builder lb-foot">
                    {total === 0 ? 'Nothing selected yet' : 'Only these are locked. Everything else stays open.'}
                </span>
            }
        >
            <div className="airo pg-lock-builder lb-modal lb-picker">
                <div className="lb-pick-search">
                    <div className="row g8 wrap">
                        <label className="searchbar grow lb-searchbar">
                            <SearchIcon />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(e) => onSearch(e.target.value)}
                                placeholder={`Search ${many}…`}
                                aria-label={`Search ${many}`}
                                autoComplete="off"
                            />
                        </label>
                        <select
                            className="select lb-auto"
                            value={searchBy}
                            onChange={(e) => onSearchBy(e.target.value)}
                            aria-label="Search by"
                        >
                            {searchOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                    {o.label}
                                </option>
                            ))}
                        </select>
                        {filterButton}
                    </div>
                    {activeFilterTags}
                </div>

                <div className={`pick-bar${refreshing ? ' syncing' : ''}`}>
                    <span className={`pick-n${pickedHere === 0 ? ' none' : ''}`}>
                        {pickedHere === 0
                            ? `${filteredData.length} ${nounFor(type, filteredData.length)}`
                            : `${pickedHere} of ${filteredData.length} selected`}
                    </span>
                    <span className="grow" />
                    {/* Pages, blogs and themes have no Shopify webhooks, so this
                        list goes stale after install until it is re-read. */}
                    <button type="button" className="btn" onClick={onRefresh} disabled={refreshing}>
                        <span className="pick-sync">
                            <RefreshIcon />
                            Refresh from Shopify
                        </span>
                    </button>
                    {paginatedData.length > 0 ? (
                        <button type="button" className="btn" onClick={onSelectAll}>
                            {allSelected ? 'Clear selection' : 'Select all'}
                        </button>
                    ) : null}
                </div>

                <div className="pick-list lb-pick-list">
                    {isLoading ? (
                        <div className="pick-empty">
                            <Spinner size="large" />
                        </div>
                    ) : paginatedData.length > 0 ? (
                        paginatedData.map((item) => {
                            const selId = pickerSelectionId(type, item);
                            const isSelected = selectedItems.includes(selId);
                            const otherLockName = otherLockNameFor ? otherLockNameFor(type, item.handle) : null;
                            const meta = itemMeta(type, item);

                            return (
                                <label key={selId} className={`pick-row${isSelected ? ' on' : ''}`}>
                                    <input type="checkbox" checked={isSelected} onChange={() => onToggle(selId)} />
                                    {type === 'products' && item.image_url ? (
                                        <span className="thumb lb-thumb-img">
                                            <img src={item.image_url} alt="" />
                                        </span>
                                    ) : (
                                        <span className={`thumb ${THUMB_CLASS[type] || ''}`}>{TYPE_ICONS[type] || TYPE_ICONS.products}</span>
                                    )}
                                    <span className="grow">
                                        <span className="row g8 wrap">
                                            <span className="sm strong">{item.title || item.name}</span>
                                            {otherLockName ? (
                                                <span className="badge warning">{`Locked by "${otherLockName}"`}</span>
                                            ) : null}
                                        </span>
                                        {meta ? <span className="xs sub">{meta}</span> : null}
                                    </span>
                                </label>
                            );
                        })
                    ) : (
                        <div className="pick-empty">No {many} found</div>
                    )}
                </div>

                {totalPages > 1 ? (
                    <div className="lb-pick-pages">
                        <Pagination
                            hasNext={currentPage < totalPages}
                            hasPrevious={currentPage > 1}
                            onNext={onNextPage}
                            onPrevious={onPrevPage}
                            label={`Page ${currentPage} of ${totalPages}`}
                        />
                    </div>
                ) : null}

                {/* Overlap warning — only ONE lock is enforced per item */}
                {selectedOverlaps.length > 0 ? (
                    <div className="lb-pick-warn">
                        <div className="notice lb-warn">
                            <span>
                                <b>Some selected items are already covered by another active lock.</b>{' '}
                                Only one lock is enforced per item — the one saved most recently (a custom widget design takes priority).
                                {' '}Overlapping: {selectedOverlaps.slice(0, 3).map((o) => `${o.title} (locked by "${o.lockName}")`).join(', ')}
                                {selectedOverlaps.length > 3 ? ` and ${selectedOverlaps.length - 3} more` : ''}.
                                {' '}Consider editing the existing lock instead, or remove the item from one of them.
                            </span>
                        </div>
                    </div>
                ) : null}
            </div>
        </Modal>
    );
}
