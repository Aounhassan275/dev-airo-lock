import { useEffect, useMemo, useState } from 'react';
import { selectionId } from '../../lib/lockItems';
import { countLabel } from './constants';
import Icon, { SyncGlyph } from './icons';

const RENDER_CAP = 200;

const THUMB_CLASS = {
    products: 'products',
    collections: 'collections',
    pages: 'pages',
    blogs: 'blogs',
    themes: 'liquid-theme',
};

const THUMB_ICON = { products: 'products', collections: 'collections', pages: 'pages', blogs: 'pages', themes: 'themes' };

/** The line under each row's title — the thing that tells two rows apart. */
function metaFor(type, item) {
    switch (type) {
        case 'products':
            return item.vendor ? `Vendor: ${item.vendor}` : item.handle ? `/products/${item.handle}` : '';
        case 'collections':
            return item.products_count != null ? countLabel(Number(item.products_count) || 0, 'products') : '';
        case 'pages':
            return item.handle ? `/pages/${item.handle}` : '';
        case 'blogs':
            return item.handle ? `/blogs/${item.handle}` : '';
        case 'themes':
            return item.role === 'main' ? 'Live theme' : item.role ? `${item.role.charAt(0).toUpperCase()}${item.role.slice(1)}` : '';
        default:
            return '';
    }
}

/**
 * The resource picker: search, search-by, Refresh from Shopify, Select all,
 * and a toolbar that reports the selection as it changes.
 *
 * Ticks live here until "Add" is pressed, so Cancel leaves the lock as it was.
 */
export default function ItemPicker({
    open,
    type,
    noun,
    items = [],
    selected = [],
    lockedBy,
    refreshing = false,
    onRefresh,
    onClose,
    onAdd,
}) {
    const [ticks, setTicks] = useState(selected);
    const [query, setQuery] = useState('');
    const [searchBy, setSearchBy] = useState('title');

    // Every open starts from what the lock currently holds.
    useEffect(() => {
        if (open) {
            setTicks(selected);
            setQuery('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, type]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return items;
        return items.filter((item) => {
            if (searchBy === 'vendor') return String(item.vendor || '').toLowerCase().includes(q);
            if (searchBy === 'id') return String(selectionId(type, item)).toLowerCase().includes(q);
            return String(item.title || item.name || item.handle || '').toLowerCase().includes(q);
        });
    }, [items, query, searchBy, type]);

    const filteredIds = useMemo(() => filtered.map((item) => selectionId(type, item)), [filtered, type]);
    const allTicked = filteredIds.length > 0 && filteredIds.every((id) => ticks.includes(id));

    if (!open) return null;

    const toggle = (id) => setTicks((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    const toggleAll = () => {
        if (allTicked) setTicks((prev) => prev.filter((id) => !filteredIds.includes(id)));
        else setTicks((prev) => [...new Set([...prev, ...filteredIds])]);
    };

    const picked = ticks.length;
    const shown = filtered.slice(0, RENDER_CAP);
    const label = noun || type;

    return (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="presentation">
            <div className="modal" style={{ maxWidth: 640 }} role="dialog" aria-modal="true" aria-labelledby="ob-pick-title">
                <div className="modal-head">
                    <h2 className="h-md" id="ob-pick-title">Select {label}</h2>
                    <button type="button" className="btn plain" onClick={onClose} aria-label="Close">
                        <Icon name="close" size={14} />
                    </button>
                </div>

                <div className="ob-pick-search">
                    <div className="row g8 wrap">
                        <label className="searchbar grow">
                            <Icon name="search" size={14} strokeWidth={2} />
                            <input
                                className="ob-search-in"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={`Search ${label}…`}
                                aria-label={`Search ${label}`}
                            />
                        </label>
                        <select className="select" style={{ width: 'auto' }} value={searchBy} onChange={(e) => setSearchBy(e.target.value)} aria-label="Search by">
                            <option value="title">Title</option>
                            {type === 'products' ? <option value="vendor">Vendor</option> : null}
                            <option value="id">ID</option>
                        </select>
                    </div>
                </div>

                <div className={`pick-bar${refreshing ? ' syncing' : ''}`}>
                    <span className={`pick-n${picked === 0 ? ' none' : ''}`}>
                        {picked === 0 ? countLabel(items.length, label) : `${picked} of ${items.length} selected`}
                    </span>
                    <span className="grow" />
                    {onRefresh ? (
                        <button type="button" className="btn" onClick={onRefresh} disabled={refreshing}>
                            <span className="pick-sync"><SyncGlyph /> Refresh from Shopify</span>
                        </button>
                    ) : null}
                    <button type="button" className="btn" onClick={toggleAll} disabled={filteredIds.length === 0}>
                        {allTicked ? 'Clear selection' : 'Select all'}
                    </button>
                </div>

                <div className="pick-list" style={{ borderTop: '1px solid var(--p-border-soft)' }}>
                    {shown.length === 0 ? (
                        <div className="pick-empty">
                            {items.length === 0
                                ? `No ${label} found in your store yet. Try Refresh from Shopify.`
                                : 'Nothing matches that search.'}
                        </div>
                    ) : (
                        shown.map((item) => {
                            const id = selectionId(type, item);
                            const on = ticks.includes(id);
                            const owner = lockedBy ? lockedBy(item) : null;
                            const meta = metaFor(type, item);
                            return (
                                <label key={id} className={`pick-row${on ? ' on' : ''}`}>
                                    <input type="checkbox" checked={on} onChange={() => toggle(id)} />
                                    <span className={`thumb ${THUMB_CLASS[type] || ''}`}>
                                        {item.image_url ? (
                                            <img src={item.image_url} alt="" className="ob-thumb-img" />
                                        ) : (
                                            <Icon name={THUMB_ICON[type] || 'products'} size={16} />
                                        )}
                                    </span>
                                    <span className="grow" style={{ minWidth: 0 }}>
                                        <span className="sm strong" style={{ display: 'block' }}>
                                            {item.title || item.name || item.handle || 'Untitled'}
                                        </span>
                                        {meta || owner ? (
                                            <span className="xs sub">
                                                {meta}
                                                {owner ? `${meta ? ' · ' : ''}Already in “${owner}”` : ''}
                                            </span>
                                        ) : null}
                                    </span>
                                </label>
                            );
                        })
                    )}
                    {filtered.length > RENDER_CAP ? (
                        <div className="pick-empty">
                            Showing {RENDER_CAP} of {filtered.length}. Search to narrow the list.
                        </div>
                    ) : null}
                </div>

                <div className="modal-foot between">
                    <span className="xs sub">
                        {picked === 0 ? 'Nothing selected yet' : 'Only these are locked. Everything else stays open.'}
                    </span>
                    <div className="row g8">
                        <button type="button" className="btn" onClick={onClose}>Cancel</button>
                        <button type="button" className="btn primary" disabled={picked === 0} onClick={() => onAdd(ticks)}>
                            {picked === 0 ? 'Add selected' : `Add ${countLabel(picked, label)}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
