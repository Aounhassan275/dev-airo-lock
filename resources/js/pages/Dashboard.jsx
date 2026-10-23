import { router, usePage } from '@inertiajs/react';
import { useAppBridge } from '@shopify/app-bridge-react';
import { Modal, Text } from '@shopify/polaris';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { filterAndSortLocks } from '../lib/lockList';
import { lockKindLabel, resourceTypeLabel } from '../lib/resourceTypes';
import '../../css/pages/locks.css';

// ---------------------------------------------------------------------------
// Tiny Shopify toast helper (works with App Bridge 3+)
// ---------------------------------------------------------------------------
function useShopifyToast() {
    const app = useAppBridge();
    return useCallback(
        (message, { isError = false, duration = 3000 } = {}) => {
            try {
                const Toast = app?.toast ?? window?.shopify?.toast;
                if (Toast?.show) {
                    Toast.show(message, { duration, isError });
                }
            } catch {
                // absolute last resort — never use browser alert
            }
        },
        [app],
    );
}

// ---------------------------------------------------------------------------
// Icons (stroked, from the mockup)
// ---------------------------------------------------------------------------
const svgProps = {
    width: 19, height: 19, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
};
const IcoActive = () => (<svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></svg>);
const IcoInactive = () => (<svg {...svgProps}><path d="M3 3l18 18M10.6 10.7a2 2 0 002.8 2.8" /><path d="M16.7 16.7A9.5 9.5 0 0112 18c-5 0-9-6-9-6a16 16 0 014.1-4.8" /></svg>);
const IcoUnlocked = () => (<svg {...svgProps}><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 017.5-2" /></svg>);
const IcoShield = () => (<svg {...svgProps}><path d="M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>);
const smallSvg = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, 'aria-hidden': true };
const IcoEdit = () => (<svg {...smallSvg}><path d="M14 6l4 4L8 20H4v-4z" /></svg>);
const IcoDelete = () => (<svg {...smallSvg}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></svg>);
const IcoSearch = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>);

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
const fmtDate = (ms) =>
    new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function relativeDay(ms) {
    if (Number.isNaN(ms)) return '—';
    const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today = startOf(new Date());
    const day = startOf(new Date(ms));
    if (day === today) return 'Today';
    if (day === today - 86400000) return 'Yesterday';
    return fmtDate(ms);
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const TABS = [
    { id: 'all', label: 'All' },
    { id: 'Active', label: 'Active' },
    { id: 'Inactive', label: 'Inactive' },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function Dashboard() {
    const app = useAppBridge();
    const showToast = useShopifyToast();
    const {
        locks: fetchedLocks,
        storesCount,
        plan,
    } = usePage().props;

    useEffect(() => {
        app?.saveBar?.hide('my-save-bar').catch(() => {});
        app?.saveBar?.hide('lock-save-bar').catch(() => {});
    }, [app]);

    const currentPlan = plan;

    // NOTE: the storefront "app embed disabled" warning is rendered app-wide
    // by <GlobalExtensionNotice> (app.jsx), so it shows on every page.

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleteType, setDeleteType] = useState(null);
    const [lockToDelete, setLockToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [togglingStatusIds, setTogglingStatusIds] = useState(new Set());

    const goToCreateLock = () => {
        if (currentPlan?.limitReached) {
            const message = currentPlan.hasUnlimitedLocks
                ? 'Something went wrong. Please contact support.'
                : `You've reached the maximum of ${currentPlan.maxLocks} locks for your ${currentPlan.name} plan. Please upgrade to create more locks.`;
            showToast(message, { isError: true });
            router.visit('/pricing');
            return;
        }
        router.visit('/lock/create');
    };

    // Per-lock 30-day activity arrives from DashboardController@locks as
    // activity_30d; when it's absent the Activity column and stat are omitted
    // rather than shown as zeros.
    const hasActivity = (fetchedLocks || []).some((l) => l && l.activity_30d);

    const locks = useMemo(() => {
        const now = Date.now();
        const computeScheduleState = (startsAt, expiresAt) => {
            const startsMs = startsAt ? Date.parse(startsAt) : NaN;
            const expiresMs = expiresAt ? Date.parse(expiresAt) : NaN;
            if (!Number.isNaN(expiresMs) && now >= expiresMs) {
                return { kind: 'expired', date: fmtDate(expiresMs) };
            }
            if (!Number.isNaN(startsMs) && now < startsMs) {
                return { kind: 'scheduled', date: fmtDate(startsMs), full: new Date(startsMs).toLocaleString() };
            }
            return null;
        };
        return (fetchedLocks || []).map((lock) => {
            const updatedMs = Date.parse(lock.updated_at);
            const createdMs = Date.parse(lock.created_at);
            return {
                id: lock.id.toString(),
                name: lock.name,
                description: lock.description || '',
                status: lock.status === true || lock.status === '1' || lock.status === 1 || lock.status === 'Active' ? 'Active' : 'Inactive',
                createdAt: Number.isNaN(createdMs) ? '—' : fmtDate(createdMs),
                // A lock with no rules protects nothing — say 0 rather than 1.
                itemCount: lock.access_rules_count ?? 0,
                type: lock.type,
                resourceTypes: Array.isArray(lock.resource_types) ? lock.resource_types : [],
                updatedMs: Number.isNaN(updatedMs) ? 0 : updatedMs,
                lastUpdated: relativeDay(updatedMs),
                scheduleState: computeScheduleState(lock.starts_at, lock.expires_at),
                seen: Number(lock.activity_30d?.seen ?? 0),
                unlocked: Number(lock.activity_30d?.unlocked ?? 0),
                original: lock,
            };
        });
    }, [fetchedLocks]);

    const [queryValue, setQueryValue] = useState('');
    const [tab, setTab] = useState('all');
    const [sortKey, setSortKey] = useState('updated');
    const [currentPage, setCurrentPage] = useState(1);
    const [planBannerDismissed, setPlanBannerDismissed] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const itemsPerPage = 10;

    const statusFilter = useMemo(() => (tab === 'all' ? [] : [tab]), [tab]);

    const filteredLocks = useMemo(() => {
        const base = filterAndSortLocks(locks, {
            query: queryValue,
            statuses: statusFilter,
            sort: { field: 'name', direction: 'ascending' },
        });
        if (sortKey === 'name') return base;
        const key = {
            updated: (l) => l.updatedMs,
            activity: (l) => l.unlocked,
            items: (l) => l.itemCount,
        }[sortKey];
        // Stable on top of the name order, so ties stay alphabetical.
        return [...base].sort((a, b) => key(b) - key(a));
    }, [locks, queryValue, statusFilter, sortKey]);

    const totalPages = Math.max(1, Math.ceil(filteredLocks.length / itemsPerPage));
    // Deleting the last row of a page, or narrowing the list, can strand
    // currentPage past the end. Clamp instead.
    const activePage = Math.min(currentPage, totalPages);
    const startIndex = (activePage - 1) * itemsPerPage;
    const paginatedLocks = filteredLocks.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => {
        if (currentPage !== activePage) setCurrentPage(activePage);
    }, [currentPage, activePage]);

    // Selection only ever points at locks that still exist and are on screen
    // — "select all" reaching past the search could bulk-delete locks the
    // merchant couldn't see.
    const visibleIds = useMemo(() => paginatedLocks.map((l) => l.id), [paginatedLocks]);
    const selectedResources = useMemo(
        () => selectedIds.filter((id) => visibleIds.includes(id)),
        [selectedIds, visibleIds],
    );
    const clearSelection = useCallback(() => setSelectedIds([]), []);

    // A new search, tab or sort reshuffles the list: back to page one and drop
    // selections, which would otherwise point at now-hidden locks.
    const filterKey = `${queryValue.trim()}|${tab}|${sortKey}`;
    const firstFilterRun = useRef(true);
    useEffect(() => {
        if (firstFilterRun.current) { firstFilterRun.current = false; return; }
        setCurrentPage(1);
        clearSelection();
    }, [filterKey, clearSelection]);

    const toggleOne = (id) =>
        setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    const allOnPage = visibleIds.length > 0 && selectedResources.length === visibleIds.length;
    const someOnPage = selectedResources.length > 0 && !allOnPage;
    const toggleAll = () => setSelectedIds(allOnPage ? [] : [...visibleIds]);

    const selectAllRef = useRef(null);
    useEffect(() => {
        if (selectAllRef.current) selectAllRef.current.indeterminate = someOnPage;
    }, [someOnPage]);

    // Every figure above the table is the table counted.
    const activeCount = locks.filter((l) => l.status === 'Active').length;
    const inactiveCount = locks.length - activeCount;
    const totalItems = locks.reduce((sum, l) => sum + l.itemCount, 0);
    const totalUnlocked = locks.reduce((sum, l) => sum + l.unlocked, 0);
    const totalSeen = locks.reduce((sum, l) => sum + l.seen, 0);

    const getBannerMessage = () => {
        if (!currentPlan) return '';
        if (currentPlan.limitReached) {
            return `You've used all ${currentPlan.maxLocks} locks on your ${currentPlan.name} plan. Upgrade to unlock more.`;
        }
        if (currentPlan.isTrial) {
            const usage = currentPlan.hasUnlimitedLocks
                ? `${currentPlan.currentLocks} lock${currentPlan.currentLocks !== 1 ? 's' : ''} created`
                : `${currentPlan.currentLocks} of ${currentPlan.maxLocks} locks used (${currentPlan.remainingLocks} remaining)`;
            return `${currentPlan.daysRemaining} day${currentPlan.daysRemaining !== 1 ? 's' : ''} left in your free trial. ${usage}.`;
        }
        const locksText = currentPlan.hasUnlimitedLocks ? 'unlimited' : currentPlan.maxLocks;
        return `You're on the ${currentPlan.name} plan with ${locksText} locks. Using ${currentPlan.currentLocks} lock${currentPlan.currentLocks !== 1 ? 's' : ''}.`;
    };

    const openDeleteModal = (lock) => { setLockToDelete(lock); setDeleteType('single'); setDeleteModalOpen(true); };
    const openBulkDeleteModal = () => { setDeleteType('bulk'); setDeleteModalOpen(true); };
    const closeDeleteModal = () => { setDeleteModalOpen(false); setDeleteType(null); setLockToDelete(null); setIsDeleting(false); };

    const confirmDelete = () => {
        setIsDeleting(true);
        if (deleteType === 'single' && lockToDelete) {
            router.delete(`/locks/${lockToDelete.id}`, {
                onSuccess: () => { showToast(`"${lockToDelete.name}" deleted.`); closeDeleteModal(); },
                onError: () => { showToast('Failed to delete lock. Please try again.', { isError: true }); setIsDeleting(false); },
            });
        } else if (deleteType === 'bulk') {
            router.post('/locks/bulk-delete', { lock_ids: selectedResources }, {
                onSuccess: () => { showToast(`${selectedResources.length} lock${selectedResources.length !== 1 ? 's' : ''} deleted.`); clearSelection(); closeDeleteModal(); },
                onError: () => { showToast('Some locks failed to delete. Please try again.', { isError: true }); setIsDeleting(false); },
            });
        }
    };

    const deleteModalContent = useMemo(() => {
        if (deleteType === 'single' && lockToDelete) {
            return { title: 'Delete lock?', message: `Are you sure you want to delete "${lockToDelete.name}"? This action cannot be undone.`, primaryAction: 'Delete lock' };
        }
        const count = selectedResources.length;
        return { title: `Delete ${count} lock${count !== 1 ? 's' : ''}?`, message: `Are you sure you want to delete ${count} lock${count !== 1 ? 's' : ''}? This action cannot be undone.`, primaryAction: `Delete ${count} lock${count !== 1 ? 's' : ''}` };
    }, [deleteType, lockToDelete, selectedResources]);

    // A lock's status can arrive as a bool, '1'/1, or 'Active' depending on the
    // serializer — normalize before comparing.
    const isLockActive = (l) =>
        l?.status === true || l?.status === '1' || l?.status === 1 || l?.status === 'Active';

    // Read ?save_error= once and strip it from the URL so a stale message
    // from an earlier refusal can't be replayed for an unrelated failure.
    const consumeSaveError = () => {
        const params = new URLSearchParams(window.location.search);
        const reason = params.get('save_error');
        if (reason !== null) {
            params.delete('save_error');
            params.delete('save_error_kind');
            const query = params.toString();
            window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
        }
        return reason;
    };

    const handleStatusToggle = (lock) => {
        if (togglingStatusIds.has(lock.id)) return;
        const newStatus = lock.status === 'Active' ? 'Inactive' : 'Active';
        const wantActive = newStatus === 'Active';
        const clearToggling = () =>
            setTogglingStatusIds((s) => { const n = new Set(s); n.delete(lock.id); return n; });

        setTogglingStatusIds((s) => new Set([...s, lock.id]));
        router.put(`/locks/${lock.id}/status`, { enabled: wantActive }, {
            preserveScroll: true,
            onSuccess: (page) => {
                // Inside the embedded-app iframe a REFUSAL can come back as a 200
                // redirect with the flash error stripped (partitioned cookies), so
                // onSuccess fires even when nothing changed. Trust the reloaded
                // props: only claim success if the lock's real status flipped.
                const fresh = (page?.props?.locks || []).find((l) => String(l.id) === String(lock.id));
                if (fresh && isLockActive(fresh) === wantActive) {
                    showToast(`"${lock.name}" set to ${newStatus}.`);
                } else if (fresh) {
                    const reason = consumeSaveError();
                    showToast(reason || `Couldn't set "${lock.name}" to ${newStatus}. Please try again.`, { isError: true });
                } else {
                    showToast(`"${lock.name}" set to ${newStatus}.`);
                }
                clearToggling();
            },
            onError: () => {
                showToast('Failed to update status.', { isError: true });
                clearToggling();
            },
        });
    };

    // Count how many of the targeted locks reached the intended state in the
    // reloaded props — the only trustworthy success signal inside the iframe.
    const countInState = (page, ids, wantActive) =>
        ids.filter((id) => {
            const l = (page?.props?.locks || []).find((x) => String(x.id) === String(id));
            return l && isLockActive(l) === wantActive;
        }).length;

    const handleBulkActivate = () => {
        const selected = locks.filter((l) => selectedResources.includes(l.id));
        if (selected.every((l) => l.status === 'Active')) { showToast('All selected locks are already active.'); return; }
        const targetIds = [...selectedResources];
        router.post('/locks/bulk-activate', { lock_ids: targetIds }, {
            preserveScroll: true,
            onSuccess: (page) => {
                const ok = countInState(page, targetIds, true);
                if (ok === targetIds.length) {
                    showToast(`${targetIds.length} lock${targetIds.length !== 1 ? 's' : ''} activated.`);
                } else {
                    const reason = consumeSaveError();
                    showToast(reason || `${ok} of ${targetIds.length} activated — the rest couldn't be activated.`, { isError: ok === 0 });
                }
                clearSelection();
            },
            onError: () => showToast('Some locks failed to activate.', { isError: true }),
        });
    };

    const handleBulkDeactivate = () => {
        const selected = locks.filter((l) => selectedResources.includes(l.id));
        if (selected.every((l) => l.status === 'Inactive')) { showToast('All selected locks are already inactive.'); return; }
        const targetIds = [...selectedResources];
        router.post('/locks/bulk-deactivate', { lock_ids: targetIds }, {
            preserveScroll: true,
            onSuccess: (page) => {
                const ok = countInState(page, targetIds, false);
                if (ok === targetIds.length) {
                    showToast(`${targetIds.length} lock${targetIds.length !== 1 ? 's' : ''} deactivated.`);
                } else {
                    const reason = consumeSaveError();
                    showToast(reason || `${ok} of ${targetIds.length} deactivated — the rest couldn't be deactivated.`, { isError: ok === 0 });
                }
                clearSelection();
            },
            onError: () => showToast('Some locks failed to deactivate.', { isError: true }),
        });
    };

    const clearFilters = () => { setQueryValue(''); setTab('all'); };

    // ---------------------------------------------------------------- plan --
    const showPlan = currentPlan && !planBannerDismissed;
    const limited = currentPlan && !currentPlan.hasUnlimitedLocks && currentPlan.maxLocks > 0;
    const usedPct = limited ? Math.min(100, Math.round((currentPlan.currentLocks / currentPlan.maxLocks) * 100)) : 0;
    const paidAndActive = currentPlan?.hasPaidPlan && !currentPlan?.isTrial && !currentPlan?.limitReached;
    const planTitle = !currentPlan ? '' : currentPlan.limitReached
        ? 'Lock limit reached'
        : currentPlan.isTrial
            ? `${currentPlan.name} plan · free trial`
            : paidAndActive ? `${currentPlan.name} plan active` : currentPlan.name;

    // ------------------------------------------------------------- rows ----
    const renderActivity = (lock) => {
        const notRunning = lock.status !== 'Active' || lock.scheduleState?.kind === 'scheduled';
        if (lock.seen === 0) {
            let note = 'No visitors yet';
            if (lock.scheduleState?.kind === 'scheduled') note = `Starts ${lock.scheduleState.date}`;
            else if (lock.scheduleState?.kind === 'expired') note = `Expired ${lock.scheduleState.date}`;
            else if (notRunning) note = 'Not running';
            return (
                <div className="stack" style={{ gap: 3, minWidth: 118 }}>
                    <span className="sm sub">&mdash;</span>
                    <span className="xs sub">{note}</span>
                </div>
            );
        }
        const pct = Math.round((lock.unlocked / lock.seen) * 100);
        return (
            <div className="stack" style={{ gap: 5, minWidth: 118 }}>
                <span className="sm"><strong>{lock.unlocked.toLocaleString()}</strong> unlocked</span>
                <span className="act-bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
                <span className="xs sub">of {lock.seen.toLocaleString()} visitor{lock.seen !== 1 ? 's' : ''} &middot; {pct}%</span>
            </div>
        );
    };

    const colCount = hasActivity ? 8 : 7;

    const rowMarkup = paginatedLocks.map((lock) => {
        const isToggling = togglingStatusIds.has(lock.id);
        const isActive = lock.status === 'Active';
        // Two pills fit the column; the rest collapse into "+N" with the full
        // list in its title.
        const shownTypes = lock.resourceTypes.slice(0, 2);
        const hiddenTypes = lock.resourceTypes.slice(2);
        const kindLabel = lockKindLabel(lock.type);
        const checked = selectedResources.includes(lock.id);

        return (
            <tr key={lock.id}>
                <td>
                    <input type="checkbox" checked={checked} onChange={() => toggleOne(lock.id)} aria-label={`Select ${lock.name}`} />
                </td>
                <td>
                    <div className="stack" style={{ gap: 3 }}>
                        <span className="row g8 wrap">
                            <button type="button" className="lock-name" onClick={() => router.visit(`/lock/${lock.id}/preview`)}>
                                {lock.name}
                            </button>
                            {lock.scheduleState?.kind === 'scheduled' && (
                                <span className="tag" title={`Scheduled for ${lock.scheduleState.full}`}>{`Scheduled ${lock.scheduleState.date}`}</span>
                            )}
                            {lock.scheduleState?.kind === 'expired' && (
                                <span className="tag" style={{ background: 'var(--p-critical-bg)', color: 'var(--p-critical-fg)' }}>{`Expired ${lock.scheduleState.date}`}</span>
                            )}
                            <span className="xs sub">#{lock.id}</span>
                        </span>
                        {lock.description && (
                            <span className="xs sub" title={lock.description}>
                                {lock.description.length > 60 ? lock.description.substring(0, 60) + '…' : lock.description}
                            </span>
                        )}
                    </div>
                </td>
                <td>
                    <div className="stack g4">
                        {shownTypes.length > 0 ? (
                            <div className="row g4">
                                {shownTypes.map(({ type, count }) => (
                                    <span key={type} className={`pill ${type}`}>{resourceTypeLabel(type, count)}</span>
                                ))}
                                {hiddenTypes.length > 0 && (
                                    <span
                                        className="pill neutral"
                                        title={hiddenTypes.map(({ type, count }) => resourceTypeLabel(type, count)).join(', ')}
                                    >
                                        {`+${hiddenTypes.length}`}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <span className="xs sub">No items</span>
                        )}
                        {kindLabel && <span className="xs sub">{kindLabel}</span>}
                    </div>
                </td>
                <td>
                    <span className="row g8">
                        <span className="count-chip">{lock.itemCount}</span>
                        <span className="xs sub">item{lock.itemCount !== 1 ? 's' : ''}</span>
                    </span>
                </td>
                {hasActivity && <td>{renderActivity(lock)}</td>}
                <td>
                    <div className="stack" style={{ gap: 2 }}>
                        <span className="sm">{lock.lastUpdated}</span>
                        <span className="xs sub">Updated &middot; created {lock.createdAt}</span>
                    </div>
                </td>
                <td>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={isActive}
                        aria-label={`${lock.name}: ${isActive ? 'Active' : 'Inactive'}`}
                        title={isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                        className={`knob${isActive ? '' : ' off'}`}
                        disabled={isToggling}
                        onClick={() => handleStatusToggle(lock)}
                    />
                </td>
                <td className="end">
                    <span className="row g8" style={{ justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            className="btn icon"
                            aria-label={`Edit ${lock.name}`}
                            title="Edit lock"
                            onClick={() => router.visit(`/lock/${lock.id}/configure`)}
                        >
                            <IcoEdit />
                        </button>
                        <button
                            type="button"
                            className="btn icon del"
                            aria-label={`Delete ${lock.name}`}
                            title="Delete lock"
                            onClick={() => openDeleteModal(lock)}
                        >
                            <IcoDelete />
                        </button>
                    </span>
                </td>
            </tr>
        );
    });

    const selCount = selectedResources.length;

    return (
        <div className="airo pg-locks">
            <main className="page full">
                <div className="between wrap g12" style={{ marginBottom: 16 }}>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 650 }}>Locks</h1>
                        <p className="sm sub mt4">
                            Secure products, collections, pages and blogs with custom access rules.
                            {storesCount ? ` Trusted by ${storesCount}+ stores.` : ''}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn primary"
                        onClick={goToCreateLock}
                        disabled={currentPlan?.limitReached}
                    >
                        &#43; Create new lock
                    </button>
                </div>

                {/* Plan and usage: what you are on, how much of it is spent,
                    and the way to change it. */}
                {showPlan && (
                    <div className={`plan${currentPlan.limitReached ? ' limit' : ''}`}>
                        <span className="plan-badge" title={currentPlan.name}>
                            {currentPlan.isTrial ? 'Trial' : currentPlan.name}
                        </span>
                        <div className="plan-who">
                            <span className="plan-name">{planTitle}</span>
                            <span className="plan-sub">{getBannerMessage()}</span>
                        </div>

                        <div className="plan-meter">
                            {limited ? (
                                <>
                                    <div className="between" style={{ marginBottom: 6 }}>
                                        <span className="sm"><strong>{currentPlan.currentLocks} of {currentPlan.maxLocks}</strong> locks used</span>
                                        <span className="xs sub">{currentPlan.remainingLocks ?? Math.max(0, currentPlan.maxLocks - currentPlan.currentLocks)} remaining</span>
                                    </div>
                                    <div className="plan-bar"><i style={{ width: `${usedPct}%` }} /></div>
                                </>
                            ) : (
                                <span className="sm"><strong>{plural(currentPlan.currentLocks ?? locks.length, 'lock')}</strong> &middot; unlimited on this plan</span>
                            )}
                        </div>

                        <div className="row g8">
                            <button type="button" className="btn go" onClick={() => router.visit('/pricing')}>
                                {paidAndActive || currentPlan.hasPaidPlan ? 'View plans' : 'Upgrade plan'}
                            </button>
                            <button
                                type="button"
                                className="btn plain icon plan-x"
                                aria-label="Dismiss plan summary"
                                onClick={() => setPlanBannerDismissed(true)}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                            </button>
                        </div>
                    </div>
                )}

                {/* One summary, divided — every figure is the table counted. */}
                <div className={`stat-row${hasActivity ? '' : ' three'}`}>
                    <div className="stat">
                        <span className="stat-ico good"><IcoActive /></span>
                        <div className="grow">
                            <span className="stat-v">{activeCount}</span>
                            <span className="stat-l">Active locks</span>
                            <span className="stat-note">Running on your storefront now</span>
                        </div>
                    </div>
                    <div className="stat">
                        <span className="stat-ico warn"><IcoInactive /></span>
                        <div className="grow">
                            <span className="stat-v">{inactiveCount}</span>
                            <span className="stat-l">Inactive locks</span>
                            <span className="stat-note">Saved, not enforcing anything</span>
                        </div>
                    </div>
                    {hasActivity && (
                        <div className="stat">
                            <span className="stat-ico info"><IcoUnlocked /></span>
                            <div className="grow">
                                <span className="stat-v">{totalUnlocked.toLocaleString()}</span>
                                <span className="stat-l">Unlocked</span>
                                <span className="stat-note">Of {totalSeen.toLocaleString()} visitors stopped &middot; 30 days</span>
                            </div>
                        </div>
                    )}
                    <div className="stat">
                        <span className="stat-ico brand"><IcoShield /></span>
                        <div className="grow">
                            <span className="stat-v">{totalItems}</span>
                            <span className="stat-l">Items secured</span>
                            <span className="stat-note">Products, pages and collections</span>
                        </div>
                    </div>
                </div>

                <div className="card mt16" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
                    {locks.length === 0 ? (
                        <div className="empty">
                            <img src="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png" alt="" />
                            <div className="h-md mt12">No locks yet</div>
                            <p className="sm sub mt4" style={{ maxWidth: 420, margin: '4px auto 0' }}>
                                {currentPlan?.limitReached
                                    ? `You've reached the ${currentPlan.maxLocks}-lock limit of the ${currentPlan.name} plan. Upgrade to create more locks.`
                                    : 'Get started by creating your first content lock to secure exclusive content.'}
                            </p>
                            {currentPlan?.limitReached ? (
                                <button type="button" className="btn primary mt12" style={{ marginTop: 12 }} onClick={() => router.visit('/pricing')}>Upgrade plan</button>
                            ) : (
                                <button type="button" className="btn primary mt12" style={{ marginTop: 12 }} onClick={goToCreateLock}>Create your first lock</button>
                            )}
                        </div>
                    ) : (
                        <>
                            {selCount > 0 ? (
                                <div className="bulk">
                                    <span className="strong">{selCount} selected</span>
                                    <div className="row g8 wrap" style={{ marginLeft: 'auto' }}>
                                        <button type="button" className="btn" onClick={handleBulkActivate}>Activate</button>
                                        <button type="button" className="btn" onClick={handleBulkDeactivate}>Deactivate</button>
                                        <button type="button" className="btn danger" onClick={openBulkDeleteModal}>Delete</button>
                                        <button type="button" className="btn plain" onClick={clearSelection}>Clear</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="filters">
                                    <div className="tabs" role="tablist">
                                        {TABS.map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                role="tab"
                                                aria-selected={tab === t.id}
                                                className={`tab${tab === t.id ? ' on' : ''}`}
                                                onClick={() => setTab(t.id)}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="searchbar">
                                        <IcoSearch />
                                        <input
                                            type="search"
                                            placeholder="Search locks…"
                                            aria-label="Search locks"
                                            value={queryValue}
                                            onChange={(e) => setQueryValue(e.target.value)}
                                        />
                                    </div>
                                    <select
                                        className="select"
                                        aria-label="Sort locks"
                                        value={sortKey}
                                        onChange={(e) => setSortKey(e.target.value)}
                                    >
                                        <option value="updated">Recently updated</option>
                                        <option value="name">Name A&ndash;Z</option>
                                        {hasActivity && <option value="activity">Most activity</option>}
                                        <option value="items">Most items</option>
                                    </select>
                                </div>
                            )}

                            <div className="t-scroll">
                                <table className="idx">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 26 }}>
                                                <input
                                                    ref={selectAllRef}
                                                    type="checkbox"
                                                    aria-label="Select all locks on this page"
                                                    checked={allOnPage}
                                                    disabled={visibleIds.length === 0}
                                                    onChange={toggleAll}
                                                />
                                            </th>
                                            <th>Lock name</th>
                                            <th>Type</th>
                                            <th>Items</th>
                                            {hasActivity && <th>Activity <span className="th-note">30 days</span></th>}
                                            <th>Dates</th>
                                            <th>Status</th>
                                            <th className="end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rowMarkup}
                                        {filteredLocks.length === 0 && (
                                            <tr className="t-none">
                                                <td colSpan={colCount}>
                                                    <span className="strong">No locks match that</span>
                                                    <p className="sm sub mt4">Try a different word, or show all locks.</p>
                                                    <button type="button" className="btn mt12" style={{ marginTop: 12 }} onClick={clearFilters}>Clear filters</button>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {filteredLocks.length > itemsPerPage && (
                                <div className="pager">
                                    <button
                                        type="button"
                                        className="btn icon"
                                        aria-label="Previous page"
                                        disabled={activePage <= 1}
                                        onClick={() => { clearSelection(); setCurrentPage(activePage - 1); }}
                                    >
                                        &lsaquo;
                                    </button>
                                    <span className="sm sub">{activePage} of {totalPages}</span>
                                    <button
                                        type="button"
                                        className="btn icon"
                                        aria-label="Next page"
                                        disabled={activePage >= totalPages}
                                        onClick={() => { clearSelection(); setCurrentPage(activePage + 1); }}
                                    >
                                        &rsaquo;
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* Delete confirmation */}
            <Modal
                open={deleteModalOpen}
                onClose={closeDeleteModal}
                title={deleteModalContent.title}
                primaryAction={{ content: deleteModalContent.primaryAction, destructive: true, onAction: confirmDelete, loading: isDeleting }}
                secondaryActions={[{ content: 'Cancel', onAction: closeDeleteModal, disabled: isDeleting }]}
            >
                <Modal.Section>
                    <Text>{deleteModalContent.message}</Text>
                </Modal.Section>
            </Modal>
        </div>
    );
}
