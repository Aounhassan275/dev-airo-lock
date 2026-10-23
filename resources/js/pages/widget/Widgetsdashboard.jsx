import { router, usePage } from '@inertiajs/react';
import { Modal, TitleBar, useAppBridge } from '@shopify/app-bridge-react';
import { Banner, BlockStack, Box, Button, ChoiceList, InlineStack, Popover, Text } from '@shopify/polaris';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../../css/pages/widgets.css';
import { COLOUR_KEYS, COLOUR_LABELS, countLabel, widgetColours } from '../../components/widget/widgetDesign';
import FormPreviewModal from './FormPreviewModal';

/* ---------------------------------------------------------------------------
   /widgetdashboard — the widget list.

   A list of designs that shows them: every row carries its colours, in the
   order the editor applies them (text, card, button, button text). Creating
   and editing a widget happen on their own page (/widgets, /widgets?id=).
--------------------------------------------------------------------------- */

const ITEMS_PER_PAGE = 10;

const SORTS = [
    { value: 'name asc', label: 'Name A–Z' },
    { value: 'name desc', label: 'Name Z–A' },
    { value: 'created desc', label: 'Newest first' },
    { value: 'created asc', label: 'Oldest first' },
    { value: 'used desc', label: 'Most used' },
    { value: 'type asc', label: 'Type' },
    { value: 'status asc', label: 'Status' },
];

const DATE_LABELS = { today: 'Today', week: 'Last 7 days', month: 'Last 30 days', quarter: 'Last 90 days' };

function useShopifyToast() {
    const app = useAppBridge();
    return useCallback(
        (message, { isError = false, duration = 3000 } = {}) => {
            try {
                const Toast = app?.toast ?? window?.shopify?.toast;
                if (Toast?.show) Toast.show(message, { duration, isError });
            } catch {
                /* a toast is never worth failing over */
            }
        },
        [app],
    );
}

const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const kindOf = (w) => (w.type === 'text' ? 'text' : 'form');
const usedCount = (w) => (Array.isArray(w.usedBy) ? w.usedBy.length : 0);

/** A checkbox that can say "some". */
function Checkbox({ checked, indeterminate = false, onChange, label }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate;
    }, [indeterminate]);
    return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} aria-label={label} />;
}

const Ico = {
    form: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <path d="M7 9h10M7 13h6" />
        </svg>
    ),
    text: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 11h16M4 16h9" />
        </svg>
    ),
    idle: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 12h6" />
        </svg>
    ),
    edit: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M14 6l4 4L8 20H4v-4z" />
        </svg>
    ),
    duplicate: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 012-2h8" />
        </svg>
    ),
    delete: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
        </svg>
    ),
    search: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
        </svg>
    ),
    back: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
        </svg>
    ),
};

export default function FormsDashboard() {
    const { widgets: initialWidgets = [], storeLocales = [], primaryLocale = '' } = usePage().props;
    const showToast = useShopifyToast();
    const [forms, setForms] = useState(initialWidgets);

    useEffect(() => {
        setForms(initialWidgets);
    }, [initialWidgets]);

    // ------------------------------------------------------------ filters --
    const [kindTab, setKindTab] = useState('all');
    const [queryValue, setQueryValue] = useState('');
    const [statusFilter, setStatusFilter] = useState([]);
    const [dateFilter, setDateFilter] = useState([]);
    const [sort, setSort] = useState('name asc');
    const [filterOpen, setFilterOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const [selected, setSelected] = useState([]);
    const [togglingStatusIds, setTogglingStatusIds] = useState(new Set());
    const [busy, setBusy] = useState(false);

    const [deleteModalActive, setDeleteModalActive] = useState(false);
    const [formToDelete, setFormToDelete] = useState(null);
    const [bulkDeleteModalActive, setBulkDeleteModalActive] = useState(false);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [formToPreview, setFormToPreview] = useState(null);

    const filteredForms = useMemo(() => {
        let result = [...forms];
        if (kindTab !== 'all') result = result.filter((f) => kindOf(f) === kindTab);
        if (queryValue.trim()) {
            const q = queryValue.trim().toLowerCase();
            result = result.filter((f) => (f.name || '').toLowerCase().includes(q) || String(f.id) === q.replace(/^#/, ''));
        }
        if (statusFilter.length > 0) result = result.filter((f) => statusFilter.includes(f.status));
        if (dateFilter.length > 0) {
            const now = new Date();
            result = result.filter((f) => {
                const diff = Math.floor((now - new Date(f.createdAt)) / (1000 * 60 * 60 * 24));
                return dateFilter.some((filter) => {
                    if (filter === 'today') return diff === 0;
                    if (filter === 'week') return diff <= 7;
                    if (filter === 'month') return diff <= 30;
                    if (filter === 'quarter') return diff <= 90;
                    return true;
                });
            });
        }
        const [field, direction] = sort.split(' ');
        const dir = direction === 'desc' ? -1 : 1;
        result.sort((a, b) => {
            let cmp = 0;
            if (field === 'name') cmp = (a.name || '').localeCompare(b.name || '');
            else if (field === 'type') cmp = kindOf(a).localeCompare(kindOf(b));
            else if (field === 'status') cmp = (a.status || '').localeCompare(b.status || '');
            else if (field === 'created') cmp = new Date(a.createdAt) - new Date(b.createdAt);
            else if (field === 'used') cmp = usedCount(a) - usedCount(b);
            if (cmp === 0 && field !== 'name') cmp = dir * (a.name || '').localeCompare(b.name || '');
            return dir * cmp;
        });
        return result;
    }, [forms, kindTab, queryValue, statusFilter, dateFilter, sort]);

    useEffect(() => {
        setCurrentPage(1);
    }, [kindTab, queryValue, statusFilter, dateFilter, sort]);

    // A selection only ever holds rows that still exist.
    useEffect(() => {
        const ids = new Set(forms.map((f) => f.id));
        setSelected((s) => (s.every((id) => ids.has(id)) ? s : s.filter((id) => ids.has(id))));
    }, [forms]);

    const totalPages = Math.max(1, Math.ceil(filteredForms.length / ITEMS_PER_PAGE));
    const page = Math.min(currentPage, totalPages);
    const paginatedForms = filteredForms.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const filtersActive = queryValue.trim() !== '' || statusFilter.length > 0 || dateFilter.length > 0 || kindTab !== 'all';
    const handleFiltersClearAll = useCallback(() => {
        setQueryValue('');
        setStatusFilter([]);
        setDateFilter([]);
        setKindTab('all');
    }, []);

    // ----------------------------------------------------------- selection --
    const visibleIds = filteredForms.map((f) => f.id);
    const selectedVisible = visibleIds.filter((id) => selected.includes(id));
    const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
    const someSelected = selectedVisible.length > 0 && !allSelected;
    const clearSelection = useCallback(() => setSelected([]), []);
    const toggleAll = () => setSelected(allSelected ? [] : visibleIds);
    const toggleOne = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

    // -------------------------------------------------------------- status --
    const handleStatusToggle = useCallback(
        (form) => {
            if (togglingStatusIds.has(form.id)) return;
            const newActive = form.status !== 'active';
            const done = () =>
                setTogglingStatusIds((s) => {
                    const n = new Set(s);
                    n.delete(form.id);
                    return n;
                });
            setTogglingStatusIds((s) => new Set([...s, form.id]));
            router.post(
                '/widgets/bulk-status',
                { ids: [form.id], is_active: newActive },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        showToast(`"${form.name}" ${newActive ? 'activated' : 'deactivated'}.`);
                        done();
                    },
                    onError: () => {
                        showToast('Failed to update status.', { isError: true });
                        done();
                    },
                },
            );
        },
        [togglingStatusIds, showToast],
    );

    // ---------------------------------------------------------------- CRUD --
    const handleCreateNew = useCallback(() => router.visit('/widgets'), []);
    const handleEdit = useCallback((form) => router.visit(`/widgets?id=${encodeURIComponent(form.id)}`), []);

    const handleView = useCallback((form) => {
        setPreviewModalOpen(false);
        setFormToPreview(null);
        setTimeout(() => {
            setFormToPreview(form);
            setPreviewModalOpen(true);
        }, 50);
    }, []);
    const handleClosePreview = useCallback(() => {
        setPreviewModalOpen(false);
        setFormToPreview(null);
    }, []);

    // A copy is a new widget with the same design, saved like any other.
    const handleDuplicate = useCallback(
        (form) => {
            const configuration = kindOf(form) === 'text' ? form.textData : form.formData;
            if (!configuration || typeof configuration !== 'object') {
                showToast('This widget has no saved design to copy.', { isError: true });
                return;
            }
            setBusy(true);
            router.post(
                '/widgets/store',
                { name: `${form.name} (Copy)`, type: kindOf(form), configuration },
                {
                    preserveScroll: true,
                    onSuccess: () => showToast(`"${form.name}" duplicated successfully.`),
                    onError: (errors) =>
                        showToast(Object.values(errors || {}).flat().join(', ') || 'Failed to duplicate widget.', { isError: true }),
                    onFinish: () => setBusy(false),
                },
            );
        },
        [showToast],
    );

    const handleDeleteClick = useCallback((form) => {
        setFormToDelete(null);
        setDeleteModalActive(false);
        setTimeout(() => {
            setFormToDelete(form);
            setDeleteModalActive(true);
        }, 1);
    }, []);

    const handleDeleteConfirm = useCallback(() => {
        if (!formToDelete) return;
        setBusy(true);
        router.delete(`/widgets/${formToDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                showToast(`"${formToDelete.name}" deleted successfully.`);
                setFormToDelete(null);
                setDeleteModalActive(false);
            },
            onError: () => showToast('Failed to delete widget.', { isError: true }),
            onFinish: () => setBusy(false),
        });
    }, [formToDelete, showToast]);

    const handleBulkActivate = useCallback(() => {
        const ids = [...selected];
        router.post(
            '/widgets/bulk-status',
            { ids, is_active: true },
            {
                preserveScroll: true,
                onSuccess: () => {
                    showToast(`${ids.length} widget(s) activated.`);
                    clearSelection();
                },
                onError: () => showToast('Failed to activate widgets.', { isError: true }),
            },
        );
    }, [selected, showToast, clearSelection]);

    const handleBulkDeactivate = useCallback(() => {
        const ids = [...selected];
        router.post(
            '/widgets/bulk-status',
            { ids, is_active: false },
            {
                preserveScroll: true,
                onSuccess: () => {
                    showToast(`${ids.length} widget(s) deactivated.`);
                    clearSelection();
                },
                onError: () => showToast('Failed to deactivate widgets.', { isError: true }),
            },
        );
    }, [selected, showToast, clearSelection]);

    const handleBulkDeleteConfirm = useCallback(() => {
        const ids = [...selected];
        setBusy(true);
        router.post(
            '/widgets/bulk-delete',
            { ids },
            {
                preserveScroll: true,
                onSuccess: () => {
                    showToast(`${ids.length} widget(s) deleted.`);
                    clearSelection();
                    setBulkDeleteModalActive(false);
                },
                onError: () => showToast('Failed to delete widgets.', { isError: true }),
                onFinish: () => setBusy(false),
            },
        );
    }, [selected, showToast, clearSelection]);

    // --------------------------------------------------------------- stats --
    // Every figure is the list counted, so none can go stale behind it.
    const formWidgetsCount = forms.filter((f) => kindOf(f) === 'form').length;
    const textWidgetsCount = forms.filter((f) => kindOf(f) === 'text').length;
    const unusedCount = forms.filter((f) => usedCount(f) === 0).length;

    const selectedUsedBy = forms.filter((f) => selected.includes(f.id)).reduce((n, f) => n + usedCount(f), 0);
    const filterCount = statusFilter.length + dateFilter.length;

    const renderModalFooter = (children) => (
        <Box padding="400" borderBlockStartWidth="025" borderColor="border" background="bg-surface-secondary">
            <InlineStack align="end" gap="200">
                {children}
            </InlineStack>
        </Box>
    );

    // ---------------------------------------------------------------- rows --
    const rows = paginatedForms.map((form) => {
        const kind = kindOf(form);
        const colours = widgetColours(form);
        const used = usedCount(form);
        const isToggling = togglingStatusIds.has(form.id);
        const active = form.status === 'active';
        const isSel = selected.includes(form.id);

        return (
            <tr key={form.id} className={isSel ? 'sel' : undefined}>
                <td>
                    <Checkbox checked={isSel} onChange={() => toggleOne(form.id)} label={`Select ${form.name}`} />
                </td>
                <td>
                    <span className="row g8 wd-name">
                        <a
                            className="strong"
                            href={`/widgets?id=${form.id}`}
                            onClick={(e) => {
                                e.preventDefault();
                                handleEdit(form);
                            }}
                        >
                            {form.name}
                        </a>
                        <span className={`tag ${kind}`}>{kind === 'form' ? 'Form' : 'Text'}</span>
                        <span className="xs sub wd-id">#{form.id}</span>
                    </span>
                </td>
                <td>
                    <button
                        type="button"
                        className="sw-row"
                        onClick={() => handleView(form)}
                        title="Preview this design"
                        aria-label={`Preview ${form.name}`}
                    >
                        {COLOUR_KEYS.form.map((k) =>
                            colours[k] ? (
                                <i key={k} style={{ background: colours[k] }} title={`${COLOUR_LABELS[k]}: ${colours[k].toUpperCase()}`} />
                            ) : (
                                <i key={k} className="none" title={`${COLOUR_LABELS[k]}: a text widget has no button`} />
                            ),
                        )}
                    </button>
                </td>
                <td className="sm sub" title={used ? form.usedBy.map((l) => l.name).join(', ') : undefined}>
                    {used ? countLabel(used, 'locks') : <span className="sub">Not used</span>}
                </td>
                <td className="sm sub">{formatDate(form.createdAt)}</td>
                <td>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={active}
                        aria-label={active ? 'Active' : 'Inactive'}
                        title={active ? 'Active' : 'Inactive'}
                        className={`knob${active ? '' : ' off'}`}
                        disabled={isToggling}
                        onClick={() => handleStatusToggle(form)}
                    />
                </td>
                <td className="end">
                    <span className="row g8" style={{ justifyContent: 'flex-end' }}>
                        <a
                            className="btn icon"
                            href={`/widgets?id=${form.id}`}
                            aria-label={`Edit ${form.name}`}
                            title="Edit"
                            onClick={(e) => {
                                e.preventDefault();
                                handleEdit(form);
                            }}
                        >
                            {Ico.edit}
                        </a>
                        <button type="button" className="btn icon" aria-label={`Duplicate ${form.name}`} title="Duplicate" onClick={() => handleDuplicate(form)} disabled={busy}>
                            {Ico.duplicate}
                        </button>
                        <button type="button" className="btn icon" aria-label={`Delete ${form.name}`} title="Delete" onClick={() => handleDeleteClick(form)} disabled={busy}>
                            {Ico.delete}
                        </button>
                    </span>
                </td>
            </tr>
        );
    });

    const deleteUsed = formToDelete ? usedCount(formToDelete) : 0;

    return (
        <div className="airo pg-widgets">
            <main className="page full">
                <div className="between wrap g12" style={{ marginBottom: 16 }}>
                    <div style={{ minWidth: 0 }}>
                        <a
                            className="back-l"
                            href="/"
                            onClick={(e) => {
                                e.preventDefault();
                                router.visit('/');
                            }}
                        >
                            {Ico.back}
                            Dashboard
                        </a>
                        <h1 style={{ fontSize: 20, fontWeight: 650, marginTop: 2 }}>Widgets</h1>
                        <p className="sm sub mt4">
                            A widget holds the colours, radius and padding a lock is shown with. One design can be shared by every lock.
                        </p>
                    </div>
                    <button type="button" className="btn primary" onClick={handleCreateNew}>
                        &#43; Create new widget
                    </button>
                </div>

                {/* What the library holds, which is the question the page opens with. */}
                <div className="stat-row">
                    <div className="stat">
                        <span className="stat-ico form" aria-hidden="true">
                            {Ico.form}
                        </span>
                        <div className="grow">
                            <span className="stat-v">{formWidgetsCount}</span>
                            <span className="stat-l">Form widgets</span>
                            <span className="stat-note">Ask the visitor for something</span>
                        </div>
                    </div>
                    <div className="stat">
                        <span className="stat-ico text" aria-hidden="true">
                            {Ico.text}
                        </span>
                        <div className="grow">
                            <span className="stat-v">{textWidgetsCount}</span>
                            <span className="stat-l">Text widgets</span>
                            <span className="stat-note">Show a message only</span>
                        </div>
                    </div>
                    <div className="stat">
                        <span className="stat-ico idle" aria-hidden="true">
                            {Ico.idle}
                        </span>
                        <div className="grow">
                            <span className="stat-v">{unusedCount}</span>
                            <span className="stat-l">Not in use</span>
                            <span className="stat-note">Saved, no lock uses it</span>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    {forms.length === 0 ? (
                        <div className="empty">
                            <img src="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png" alt="" />
                            <h2 className="h-md mt12">Create your first widget</h2>
                            <p className="sm sub mt4">Build custom forms and text widgets to enhance your store.</p>
                            <button type="button" className="btn primary mt16" onClick={handleCreateNew}>
                                Create widget
                            </button>
                        </div>
                    ) : (
                        <>
                            {selected.length > 0 ? (
                                <div className="bulk">
                                    <span className="sm strong">{selected.length} selected</span>
                                    <button type="button" className="btn" onClick={handleBulkActivate}>
                                        Activate
                                    </button>
                                    <button type="button" className="btn" onClick={handleBulkDeactivate}>
                                        Deactivate
                                    </button>
                                    <button type="button" className="btn wd-danger" onClick={() => setBulkDeleteModalActive(true)}>
                                        Delete
                                    </button>
                                    <button type="button" className="btn plain" onClick={clearSelection} style={{ marginLeft: 'auto' }}>
                                        Clear
                                    </button>
                                </div>
                            ) : (
                                <div className="filters">
                                    <div className="tabs" role="tablist">
                                        {[
                                            ['all', 'All'],
                                            ['form', 'Form'],
                                            ['text', 'Text'],
                                        ].map(([value, label]) => (
                                            <button
                                                type="button"
                                                key={value}
                                                role="tab"
                                                aria-selected={kindTab === value}
                                                className={`tab${kindTab === value ? ' on' : ''}`}
                                                onClick={() => setKindTab(value)}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                    <label className="searchbar">
                                        {Ico.search}
                                        <input
                                            type="search"
                                            value={queryValue}
                                            onChange={(e) => setQueryValue(e.target.value)}
                                            placeholder="Search widgets…"
                                            aria-label="Search widgets"
                                        />
                                    </label>
                                    <Popover
                                        active={filterOpen}
                                        onClose={() => setFilterOpen(false)}
                                        preferredAlignment="right"
                                        activator={
                                            <button type="button" className="btn" onClick={() => setFilterOpen((o) => !o)} aria-expanded={filterOpen}>
                                                Filter{filterCount > 0 ? ` (${filterCount})` : ''}
                                            </button>
                                        }
                                    >
                                        <Box padding="300" minWidth="220px">
                                            <BlockStack gap="300">
                                                <ChoiceList
                                                    title="Status"
                                                    choices={[
                                                        { label: 'Active', value: 'active' },
                                                        { label: 'Inactive', value: 'deactive' },
                                                    ]}
                                                    selected={statusFilter}
                                                    onChange={setStatusFilter}
                                                    allowMultiple
                                                />
                                                <ChoiceList
                                                    title="Created date"
                                                    choices={Object.entries(DATE_LABELS).map(([value, label]) => ({ value, label }))}
                                                    selected={dateFilter}
                                                    onChange={setDateFilter}
                                                    allowMultiple
                                                />
                                                {filterCount > 0 && (
                                                    <Button
                                                        variant="plain"
                                                        onClick={() => {
                                                            setStatusFilter([]);
                                                            setDateFilter([]);
                                                        }}
                                                    >
                                                        Clear filters
                                                    </Button>
                                                )}
                                            </BlockStack>
                                        </Box>
                                    </Popover>
                                    <select className="select wd-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort widgets">
                                        {SORTS.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                Sort: {s.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="t-scroll">
                                <table className="idx">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 26 }}>
                                                <Checkbox
                                                    checked={allSelected}
                                                    indeterminate={someSelected}
                                                    onChange={toggleAll}
                                                    label="Select all widgets"
                                                />
                                            </th>
                                            <th>Widget name</th>
                                            <th>Design</th>
                                            <th>Used by</th>
                                            <th>Created</th>
                                            <th>Status</th>
                                            <th className="end">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.length > 0 ? (
                                            rows
                                        ) : (
                                            <tr className="t-none">
                                                <td colSpan={7}>
                                                    <p className="sm sub">No widgets found matching your criteria.</p>
                                                    {filtersActive && (
                                                        <button type="button" className="btn mt8" onClick={handleFiltersClearAll}>
                                                            Clear filters
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {filteredForms.length > ITEMS_PER_PAGE && (
                                <div className="pager">
                                    <button
                                        type="button"
                                        className="btn icon"
                                        aria-label="Previous page"
                                        disabled={page <= 1}
                                        onClick={() => setCurrentPage(Math.max(page - 1, 1))}
                                    >
                                        &lsaquo;
                                    </button>
                                    <span className="sm sub">
                                        {page} of {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn icon"
                                        aria-label="Next page"
                                        disabled={page >= totalPages}
                                        onClick={() => setCurrentPage(Math.min(page + 1, totalPages))}
                                    >
                                        &rsaquo;
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* Delete one widget */}
            <Modal id="delete-form-modal" open={deleteModalActive} onHide={() => setDeleteModalActive(false)}>
                <BlockStack gap="0">
                    <Box padding="400">
                        <BlockStack gap="400">
                            <Text as="p" variant="bodyMd">
                                Are you sure you want to delete &ldquo;{formToDelete?.name}&rdquo;?
                            </Text>
                            <Text as="p" variant="bodyMd" tone="subdued">
                                {deleteUsed
                                    ? `${countLabel(deleteUsed, 'locks')} use${deleteUsed === 1 ? 's' : ''} it. They fall back to the default look, and keep working.`
                                    : 'Nothing is using it, so nothing changes on your storefront.'}
                            </Text>
                            <Banner tone="warning">This action cannot be undone.</Banner>
                        </BlockStack>
                    </Box>
                    {renderModalFooter(
                        <>
                            <Button
                                onClick={() => {
                                    setDeleteModalActive(false);
                                    setFormToDelete(null);
                                }}
                                disabled={busy}
                            >
                                Cancel
                            </Button>
                            <Button variant="primary" tone="critical" onClick={handleDeleteConfirm} disabled={busy} loading={busy}>
                                Delete widget
                            </Button>
                        </>,
                    )}
                </BlockStack>
                <TitleBar title="Delete this widget?" />
            </Modal>

            {/* Delete the selection */}
            <Modal id="bulk-delete-modal" open={bulkDeleteModalActive} onHide={() => setBulkDeleteModalActive(false)}>
                <BlockStack gap="0">
                    <Box padding="400">
                        <BlockStack gap="400">
                            <Text as="p" variant="bodyMd">
                                Are you sure you want to delete {selected.length} selected widget{selected.length === 1 ? '' : 's'}?
                            </Text>
                            {selectedUsedBy > 0 && (
                                <Text as="p" variant="bodyMd" tone="subdued">
                                    Locks using them fall back to the default look, and keep working.
                                </Text>
                            )}
                            <Banner tone="warning">This action cannot be undone.</Banner>
                        </BlockStack>
                    </Box>
                    {renderModalFooter(
                        <>
                            <Button onClick={() => setBulkDeleteModalActive(false)} disabled={busy}>
                                Cancel
                            </Button>
                            <Button variant="primary" tone="critical" onClick={handleBulkDeleteConfirm} disabled={busy} loading={busy}>
                                Delete {selected.length} widget{selected.length === 1 ? '' : 's'}
                            </Button>
                        </>,
                    )}
                </BlockStack>
                <TitleBar title="Delete selected widgets" />
            </Modal>

            {/* Preview — opened from a row's colours */}
            {previewModalOpen && (
                <Modal id="preview-form-modal" open={previewModalOpen} onHide={handleClosePreview} key={formToPreview?.id || 'preview-modal'} variant="max">
                    <FormPreviewModal
                        formData={formToPreview?.formData}
                        textData={formToPreview?.textData}
                        formName={formToPreview?.name}
                        widgetType={formToPreview?.type}
                        onClose={handleClosePreview}
                        storeLocales={storeLocales}
                        primaryLocale={primaryLocale}
                    />
                    <TitleBar title={`Preview: ${formToPreview?.name || 'Widget'}`}>
                        <button
                            onClick={() => {
                                const form = formToPreview;
                                handleClosePreview();
                                if (form) handleEdit(form);
                            }}
                        >
                            Edit
                        </button>
                        <button onClick={handleClosePreview}>Close</button>
                    </TitleBar>
                </Modal>
            )}
        </div>
    );
}
