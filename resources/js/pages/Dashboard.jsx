import { router, usePage } from '@inertiajs/react';
import { useAppBridge } from '@shopify/app-bridge-react';
import {
    Badge,
    BlockStack,
    Box,
    Button,
    Card,
    ChoiceList,
    EmptyState,
    IndexFilters,
    IndexTable,
    InlineStack,
    Modal,
    Page,
    Pagination,
    Text,
    Tooltip,
    useIndexResourceState,
    useSetIndexFiltersMode,
} from '@shopify/polaris';
import { DeleteIcon, EditIcon, PlusIcon, ViewIcon, DuplicateIcon } from '@shopify/polaris-icons';
import { Lock, CheckCircle, EyeOff, ShieldCheck, Sparkles, ArrowUpRight, Crown } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    SORT_COLUMN_BY_FIELD,
    SORT_FIELD_BY_COLUMN,
    filterAndSortLocks,
} from '../lib/lockList';
import {
    NEUTRAL_COLOR,
    lockKindLabel,
    resourceTypeLabel,
    resourceTypePillStyle,
} from '../lib/resourceTypes';

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
// Knob Toggle
// ---------------------------------------------------------------------------
function KnobToggle({ checked, onChange, disabled = false }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
            }}
        >
            <span
                style={{
                    position: 'relative',
                    width: '40px',
                    height: '22px',
                    borderRadius: '11px',
                    background: checked ? '#22c55e' : '#d1d5db',
                    transition: 'background 0.2s ease',
                    flexShrink: 0,
                    boxShadow: checked ? '0 0 0 2px rgba(34,197,94,0.2)' : 'none',
                }}
            >
                <span
                    style={{
                        position: 'absolute',
                        top: '3px',
                        left: checked ? '21px' : '3px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                        transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                />
            </span>
            <span
                style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: checked ? '#16a34a' : '#6b7280',
                    minWidth: '52px',
                }}
            >
                {checked ? 'Active' : 'Inactive'}
            </span>
        </button>
    );
}

// ---------------------------------------------------------------------------
// Main Dashboard
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

    // NOTE: the storefront "app embed disabled" warning is now rendered app-wide
    // by <GlobalExtensionNotice> (app.jsx), so it shows on every page and the
    // status check is async — no per-page wiring here anymore.

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

    const locks = useMemo(() => {
        const now = Date.now();
        const computeScheduleState = (startsAt, expiresAt) => {
            const startsMs = startsAt ? Date.parse(startsAt) : NaN;
            const expiresMs = expiresAt ? Date.parse(expiresAt) : NaN;
            if (!Number.isNaN(expiresMs) && now >= expiresMs) {
                return { kind: 'expired', date: new Date(expiresMs).toLocaleDateString() };
            }
            if (!Number.isNaN(startsMs) && now < startsMs) {
                return { kind: 'scheduled', date: new Date(startsMs).toLocaleString() };
            }
            return null;
        };
        return (fetchedLocks || []).map((lock) => ({
            id: lock.id.toString(),
            name: lock.name,
            description: lock.description || '',
            status: lock.status === true || lock.status === '1' || lock.status === 1 || lock.status === 'Active' ? 'Active' : 'Inactive',
            createdAt: new Date(lock.created_at).toLocaleDateString(),
            // A lock with no rules protects nothing — say 0 rather than the
            // flattering 1 this used to report (which also inflated the
            // "Items Secured" stat).
            itemCount: lock.access_rules_count ?? 0,
            type: lock.type,
            resourceTypes: Array.isArray(lock.resource_types) ? lock.resource_types : [],
            lastUpdated: new Date(lock.updated_at).toLocaleDateString(),
            scheduleState: computeScheduleState(lock.starts_at, lock.expires_at),
            original: lock,
        }));
    }, [fetchedLocks]);

    const [queryValue, setQueryValue] = useState('');
    const [statusFilter, setStatusFilter] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [planBannerDismissed, setPlanBannerDismissed] = useState(false);
    const [sortState, setSortState] = useState({ field: 'name', direction: 'ascending' });
    const [sortSelected, setSortSelected] = useState(['name asc']);
    const itemsPerPage = 10;

    const { mode, setMode } = useSetIndexFiltersMode();

    const filteredLocks = useMemo(
        () => filterAndSortLocks(locks, { query: queryValue, statuses: statusFilter, sort: sortState }),
        [locks, queryValue, statusFilter, sortState],
    );

    // Selection tracks what's actually on screen. Handing the hook every lock
    // made "select all" reach past the search — a merchant filtering to one
    // lock and hitting the header checkbox selected (and could bulk-delete)
    // locks they couldn't even see.
    const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
        useIndexResourceState(filteredLocks);

    const totalPages = Math.max(1, Math.ceil(filteredLocks.length / itemsPerPage));
    // Deleting the last row of a page, or narrowing the list with a filter, can
    // strand currentPage past the end — that showed an empty table with no
    // pagination to click back with. Clamp instead.
    const activePage = Math.min(currentPage, totalPages);
    const startIndex = (activePage - 1) * itemsPerPage;
    const paginatedLocks = filteredLocks.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => {
        if (currentPage !== activePage) setCurrentPage(activePage);
    }, [currentPage, activePage]);

    // A new search or status filter reshuffles the list: go back to page one and
    // drop selections, which would otherwise still point at now-hidden locks.
    const filterKey = `${queryValue.trim()}|${[...statusFilter].sort().join(',')}`;
    useEffect(() => {
        setCurrentPage(1);
        clearSelection();
        // clearSelection is not referentially stable across renders; keying off
        // the filter alone is what we want here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey]);

    const activeCount = locks.filter((l) => l.status === 'Active').length;
    const inactiveCount = locks.filter((l) => l.status === 'Inactive').length;
    const totalItems = locks.reduce((sum, l) => sum + l.itemCount, 0);

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
                // props, not the callback: only claim success if the lock's real
                // status actually flipped. (Backend also carries the reason in a
                // ?save_error= param — see DashboardController::refuseBack.)
                const fresh = (page?.props?.locks || []).find((l) => String(l.id) === String(lock.id));
                if (fresh && isLockActive(fresh) === wantActive) {
                    showToast(`"${lock.name}" set to ${newStatus}.`);
                } else if (fresh) {
                    const reason = consumeSaveError();
                    showToast(reason || `Couldn't set "${lock.name}" to ${newStatus}. Please try again.`, { isError: true });
                } else {
                    // Lock missing from fresh props (shouldn't happen) — optimistic fallback.
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

    const handleBulkActivate = useCallback(() => {
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
    }, [selectedResources, locks, clearSelection, showToast]);

    const handleBulkDeactivate = useCallback(() => {
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
    }, [selectedResources, locks, clearSelection, showToast]);

    const promotedBulkActions = [
        { content: 'Activate', onAction: handleBulkActivate },
        { content: 'Deactivate', onAction: handleBulkDeactivate },
    ];
    const bulkActions = [{ content: 'Delete selected', destructive: true, onAction: openBulkDeleteModal }];

    const sortOptions = [
        { label: 'Lock name', value: 'name asc', directionLabel: 'A–Z' },
        { label: 'Lock name', value: 'name desc', directionLabel: 'Z–A' },
        { label: 'Items', value: 'items asc', directionLabel: 'Low to high' },
        { label: 'Items', value: 'items desc', directionLabel: 'High to low' },
        { label: 'Status', value: 'status asc', directionLabel: 'A–Z' },
        { label: 'Status', value: 'status desc', directionLabel: 'Z–A' },
    ];

    const handleSortChange = useCallback((value) => {
        setSortSelected(value);
        const [field, dir] = value[0].split(' ');
        setSortState({ field, direction: dir === 'desc' ? 'descending' : 'ascending' });
        setCurrentPage(1);
    }, []);

    // Header clicks must also drive the sort dropdown, or it keeps advertising a
    // sort the table is no longer using.
    const handleSort = useCallback((columnIndex, direction) => {
        const field = SORT_FIELD_BY_COLUMN[columnIndex];
        if (!field) return;
        setSortState({ field, direction });
        setSortSelected([`${field} ${direction === 'descending' ? 'desc' : 'asc'}`]);
        setCurrentPage(1);
    }, []);

    const filters = [{
        key: 'status', label: 'Status',
        filter: <ChoiceList title="Status" titleHidden choices={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]} selected={statusFilter} onChange={setStatusFilter} allowMultiple />,
        shortcut: true,
    }];

    const tabs = [
        { id: 'all', content: 'All', accessibilityLabel: 'All locks', panelID: 'all-locks' },
        { id: 'Active', content: 'Active', accessibilityLabel: 'Active locks', panelID: 'active-locks' },
        { id: 'Inactive', content: 'Inactive', accessibilityLabel: 'Inactive locks', panelID: 'inactive-locks' },
    ];

    // The tab is a view of the status filter, not a second source of truth for
    // it. As separate state they drifted: clearing the "Status: Active" chip
    // left the Active tab highlighted over a list showing everything, and
    // choosing a status in the filter popover left the tab on All.
    const selectedTabIndex = statusFilter.length === 1
        ? Math.max(0, tabs.findIndex((t) => t.id === statusFilter[0]))
        : 0;

    const handleTabChange = useCallback((i) => {
        setStatusFilter(tabs[i].id === 'all' ? [] : [tabs[i].id]);
    }, []);

    const appliedFilters = statusFilter.length > 0
        ? [{ key: 'status', label: `Status: ${statusFilter.join(', ')}`, onRemove: () => setStatusFilter([]) }]
        : [];

    const rowMarkup = paginatedLocks.map((lock, index) => {
        const actualIndex = (activePage - 1) * itemsPerPage + index;
        const isToggling = togglingStatusIds.has(lock.id);
        // Two badges fit the column; the rest collapse into a "+N" with the
        // full list in its tooltip.
        const shownTypes = lock.resourceTypes.slice(0, 2);
        const hiddenTypes = lock.resourceTypes.slice(2);
        const kindLabel = lockKindLabel(lock.type);

        return (
            <IndexTable.Row id={lock.id} key={lock.id} selected={selectedResources.includes(lock.id)} position={actualIndex}>
                {/* Lock Name + description */}
                <IndexTable.Cell>
                    <BlockStack gap="050">
                        <InlineStack gap="200" blockAlign="center">
                            <Button variant="plain" textAlign="left" onClick={() => router.visit(`/lock/${lock.id}/configure`)}>
                                <Text variant="bodyMd" fontWeight="semibold" as="span">{lock.name}</Text>
                            </Button>
                            {lock.scheduleState?.kind === 'scheduled' && (
                                <Badge tone="info">{`Scheduled for ${lock.scheduleState.date}`}</Badge>
                            )}
                            {lock.scheduleState?.kind === 'expired' && (
                                <Badge tone="critical">{`Expired on ${lock.scheduleState.date}`}</Badge>
                            )}
                        </InlineStack>
                        {lock.description && (
                            <Text variant="bodySm" tone="subdued" as="span">
                                {lock.description.length > 60 ? lock.description.substring(0, 60) + '…' : lock.description}
                            </Text>
                        )}
                        <Text variant="bodySm" tone="subdued" as="span">ID: {lock.id}</Text>
                    </BlockStack>
                </IndexTable.Cell>

                {/* What the lock protects */}
                <IndexTable.Cell>
                    <BlockStack gap="100">
                        {shownTypes.length > 0 ? (
                            <InlineStack gap="100" blockAlign="center">
                                {shownTypes.map(({ type, count }) => (
                                    <span key={type} style={resourceTypePillStyle(type)}>
                                        {resourceTypeLabel(type, count)}
                                    </span>
                                ))}
                                {hiddenTypes.length > 0 && (
                                    <Tooltip
                                        content={hiddenTypes
                                            .map(({ type, count }) => resourceTypeLabel(type, count))
                                            .join(', ')}
                                    >
                                        <span
                                            style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: '20px',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                background: NEUTRAL_COLOR.bg,
                                                color: NEUTRAL_COLOR.fg,
                                            }}
                                        >
                                            {`+${hiddenTypes.length}`}
                                        </span>
                                    </Tooltip>
                                )}
                            </InlineStack>
                        ) : (
                            <Text variant="bodySm" tone="subdued" as="span">No items</Text>
                        )}
                        {kindLabel && (
                            <Text variant="bodySm" tone="subdued" as="span">{kindLabel}</Text>
                        )}
                    </BlockStack>
                </IndexTable.Cell>

                {/* Items */}
                <IndexTable.Cell>
                    <InlineStack gap="100" blockAlign="center">
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: '#ede9fe', color: '#6d28d9', fontSize: 11, fontWeight: 700 }}>
                            {lock.itemCount}
                        </span>
                        <Text variant="bodySm" tone="subdued">item{lock.itemCount !== 1 ? 's' : ''}</Text>
                    </InlineStack>
                </IndexTable.Cell>

                {/* Created */}
                <IndexTable.Cell>
                    <BlockStack gap="0">
                        <Text variant="bodySm" as="span">{lock.createdAt}</Text>
                        <Text variant="bodySm" tone="subdued" as="span">Created</Text>
                    </BlockStack>
                </IndexTable.Cell>

                {/* Last updated */}
                <IndexTable.Cell>
                    <BlockStack gap="0">
                        <Text variant="bodySm" as="span">{lock.lastUpdated}</Text>
                        <Text variant="bodySm" tone="subdued" as="span">Updated</Text>
                    </BlockStack>
                </IndexTable.Cell>

                {/* Status knob */}
                <IndexTable.Cell>
                    <KnobToggle
                        checked={lock.status === 'Active'}
                        onChange={() => handleStatusToggle(lock)}
                        disabled={isToggling}
                    />
                </IndexTable.Cell>

                {/* Actions */}
                <IndexTable.Cell>
                    <InlineStack gap="150" align="end" blockAlign="center">
                        <Tooltip content="Edit lock">
                            <Button
                                size="slim"
                                icon={EditIcon}
                                onClick={() => router.visit(`/lock/${lock.id}/configure`)}
                                accessibilityLabel={`Edit ${lock.name}`}
                            >
                                Edit
                            </Button>
                        </Tooltip>
                        <Tooltip content="Preview lock">
                            <Button
                                size="slim"
                                icon={ViewIcon}
                                variant="secondary"
                                onClick={() => router.visit(`/lock/${lock.id}/preview`)}
                                accessibilityLabel={`Preview ${lock.name}`}
                            />
                        </Tooltip>
                        <Tooltip content="Delete lock">
                            <Button
                                size="slim"
                                tone="critical"
                                variant="secondary"
                                icon={DeleteIcon}
                                onClick={() => openDeleteModal(lock)}
                                accessibilityLabel={`Delete ${lock.name}`}
                            />
                        </Tooltip>
                    </InlineStack>
                </IndexTable.Cell>
            </IndexTable.Row>
        );
    });

    return (
        <Page
            title="Access Locks"
            subtitle={`Secure products, collections, pages, and blogs with custom access rules. Trusted by ${storesCount}+ stores`}
            primaryAction={{ content: 'Create New Lock', icon: PlusIcon, onAction: goToCreateLock, disabled: currentPlan?.limitReached }}
        >
            <style>{`
                .dash-stat-card:hover {
                    border-color: #c4b5fd !important;
                    box-shadow: 0 8px 30px rgba(139,92,246,0.1) !important;
                    transform: translateY(-2px);
                }
                .dash-banner-btn {
                    position: relative; overflow: hidden;
                    transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
                }
                .dash-banner-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(139,92,246,0.4); }
                .dash-banner-btn:active { transform: translateY(0); }
            `}</style>

            <BlockStack gap="500">
                {/* Storefront app embed disabled — locks won't run until it's enabled.
                    Shown as a sleek fixed corner notice (rendered below, outside the stack). */}

                {/* Plan banner — trial countdown, limit warnings and active-plan status. */}
                {currentPlan && !planBannerDismissed && (currentPlan.isTrial || currentPlan.limitReached || currentPlan.hasPaidPlan) && (
                    <div style={{ borderRadius: 12, background: 'linear-gradient(135deg,#a78bfa,#8b5cf6,#7c3aed)', padding: '20px 24px', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 20px rgba(139,92,246,0.2)' }}>
                        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                        <div style={{ position: 'absolute', bottom: -20, right: 80, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {currentPlan.limitReached ? <Lock size={20} color="#8b5cf6" /> : <Crown size={20} color="#8b5cf6" />}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>
                                            {currentPlan.limitReached ? 'Lock Limit Reached' : currentPlan.hasPaidPlan && !currentPlan.isTrial ? `${currentPlan.name} Plan Active` : `${currentPlan.name} Plan`}
                                        </span>
                                        {currentPlan.hasPaidPlan && !currentPlan.isTrial && !currentPlan.limitReached && (
                                            <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <Sparkles size={9} /> Active
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: '18px', maxWidth: 500, display: 'block' }}>{getBannerMessage()}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                {!(currentPlan.hasPaidPlan && !currentPlan.isTrial && !currentPlan.limitReached) && (
                                    <button className="dash-banner-btn" onClick={() => router.visit('/pricing')} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#fff', color: '#8b5cf6', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {currentPlan.hasPaidPlan ? 'View Plans' : 'Upgrade Plan'}
                                        <ArrowUpRight size={13} />
                                    </button>
                                )}
                                <button onClick={() => setPlanBannerDismissed(true)} onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }} onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontFamily: 'inherit', transition: 'all 0.2s ease' }}>✕</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    {[
                        { icon: Lock, label: 'Total Locks', value: locks.length, subtitle: !currentPlan ? `${locks.length} content lock${locks.length !== 1 ? 's' : ''}` : currentPlan.limitReached ? `Limit reached (${currentPlan.maxLocks} max)` : currentPlan.hasUnlimitedLocks ? 'Unlimited locks' : `${currentPlan.remainingLocks} remaining` },
                        { icon: CheckCircle, label: 'Active Locks', value: activeCount, subtitle: activeCount === 0 ? 'No active locks' : locks.length > 0 ? `${((activeCount / locks.length) * 100).toFixed(0)}% of total` : '0% of total' },
                        { icon: EyeOff, label: 'Inactive Locks', value: inactiveCount, subtitle: inactiveCount === 0 ? 'All locks active' : 'Ready to activate' },
                        { icon: ShieldCheck, label: 'Items Secured', value: totalItems, subtitle: totalItems === 0 ? 'No items protected' : `Across ${locks.length} lock${locks.length !== 1 ? 's' : ''}` },
                    ].map((card, i) => (
                        <div key={i} className="dash-stat-card" style={{ borderRadius: 12, background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.25s ease' }}>
                            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f3f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <card.icon size={20} color="#8b5cf6" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>{card.label}</span>
                                <span style={{ fontSize: 24, fontWeight: 700, color: '#111827', display: 'block', lineHeight: '28px' }}>{card.value}</span>
                                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.subtitle}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Table */}
                <div style={{ marginBottom: 15 }}>
                    <Card padding="0">
                        <IndexFilters
                            sortOptions={sortOptions}
                            sortSelected={sortSelected}
                            queryValue={queryValue}
                            queryPlaceholder="Search locks…"
                            onQueryChange={setQueryValue}
                            onQueryClear={() => setQueryValue('')}
                            onSort={handleSortChange}
                            cancelAction={{ onAction: () => setMode('default'), disabled: false, loading: false }}
                            tabs={tabs}
                            selected={selectedTabIndex}
                            onSelect={handleTabChange}
                            canCreateNewView={false}
                            filters={filters}
                            appliedFilters={appliedFilters}
                            onClearAll={() => { setQueryValue(''); setStatusFilter([]); setMode('default'); }}
                            mode={mode}
                            setMode={setMode}
                        />

                        {filteredLocks.length > 0 ? (
                            <>
                                <IndexTable
                                    resourceName={{ singular: 'content lock', plural: 'content locks' }}
                                    itemCount={filteredLocks.length}
                                    selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                                    onSelectionChange={handleSelectionChange}
                                    headings={[
                                        { title: 'Lock Name' },
                                        { title: 'Type' },
                                        { title: 'Items' },
                                        { title: 'Created' },
                                        { title: 'Last Updated' },
                                        { title: 'Status' },
                                        { title: 'Actions', alignment: 'end' },
                                    ]}
                                    promotedBulkActions={promotedBulkActions}
                                    bulkActions={bulkActions}
                                    sortable={[true, false, true, false, false, true, false]}
                                    sortDirection={sortState.direction}
                                    sortColumnIndex={SORT_COLUMN_BY_FIELD[sortState.field]}
                                    onSort={handleSort}
                                >
                                    {rowMarkup}
                                </IndexTable>

                                {filteredLocks.length > itemsPerPage && (
                                    <Box padding="400">
                                        <InlineStack align="center">
                                            <Pagination
                                                hasPrevious={activePage > 1}
                                                hasNext={activePage < totalPages}
                                                onPrevious={() => setCurrentPage(activePage - 1)}
                                                onNext={() => setCurrentPage(activePage + 1)}
                                                label={`${activePage} of ${totalPages}`}
                                            />
                                        </InlineStack>
                                    </Box>
                                )}
                            </>
                        ) : (
                            <EmptyState
                                heading="No locks found"
                                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                                action={
                                    currentPlan?.limitReached
                                        ? { content: 'Upgrade plan', onAction: () => router.visit('/pricing') }
                                        : { content: 'Create your first lock', onAction: goToCreateLock }
                                }
                            >
                                <Text tone="subdued">
                                    {currentPlan?.limitReached
                                        ? `You've reached the ${currentPlan.maxLocks}-lock limit of the ${currentPlan.name} plan. Upgrade to create more locks.`
                                        : queryValue || statusFilter.length > 0
                                          ? "Try adjusting your search or filter to find what you're looking for."
                                          : 'Get started by creating your first content lock to secure exclusive content.'}
                                </Text>
                            </EmptyState>
                        )}
                    </Card>
                </div>
            </BlockStack>

            {/* Delete modal */}
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
        </Page>
    );
}