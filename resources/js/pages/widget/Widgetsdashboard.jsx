import { router, usePage } from '@inertiajs/react';
import { Modal, TitleBar, useAppBridge } from '@shopify/app-bridge-react';
import {
    ActionList,
    Badge,
    Banner,
    BlockStack,
    Box,
    Button,
    Card,
    ChoiceList,
    EmptyState,
    Icon,
    IndexFilters,
    IndexTable,
    InlineStack,
    Page,
    Pagination,
    Popover,
    Text,
    TextField,
    Tooltip,
    useIndexResourceState,
    useSetIndexFiltersMode,
} from '@shopify/polaris';
import {
    ChevronRightIcon,
    DeleteIcon,
    EditIcon,
    NoteIcon,
    PlusCircleIcon,
    TextIcon,
    ViewIcon,
} from '@shopify/polaris-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, CheckCircle, EyeOff } from 'lucide-react';
import FormPreviewModal from './FormPreviewModal';
import TextWidget from './TextWidget';
import DynamicFormWidget from './Widgets';

const ITEMS_PER_PAGE_DEFAULT = '10';

// ---------------------------------------------------------------------------
// Shopify Toast helper
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
            }
        },
        [app],
    );
}

// ---------------------------------------------------------------------------
// Knob Toggle — same as Dashboard
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
                    minWidth: '56px',
                }}
            >
                {checked ? 'Active' : 'Inactive'}
            </span>
        </button>
    );
}

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------
function StepIndicator({ currentStep, steps }) {
    return (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', marginBottom: '24px' }}>
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isActive = stepNumber === currentStep;
                const isCompleted = stepNumber < currentStep;
                return (
                    <div key={step.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div
                            style={{
                                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, fontWeight: 600,
                                background: isActive ? '#8b5cf6' : isCompleted ? '#22c55e' : '#e5e7eb',
                                color: isActive || isCompleted ? '#fff' : '#6b7280',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {isCompleted ? '✓' : stepNumber}
                        </div>
                        <Text variant="bodySm" fontWeight={isActive ? 'semibold' : 'regular'} tone={isActive ? undefined : 'subdued'}>
                            {step.label}
                        </Text>
                        {index < steps.length - 1 && (
                            <div style={{ marginLeft: 4, marginRight: 4 }}>
                                <Icon source={ChevronRightIcon} tone="subdued" />
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Widget Type Card
// ---------------------------------------------------------------------------
function WidgetTypeCard({ icon, title, description, onClick, isSelected }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                width: '100%',
                cursor: 'pointer',
                borderRadius: 12,
                border: isSelected ? '2px solid #8b5cf6' : '2px solid #e5e7eb',
                background: isSelected ? '#f5f3ff' : '#fff',
                padding: '20px',
                textAlign: 'left',
                transition: 'all 0.2s ease',
            }}
        >
            <BlockStack gap="400">
                <div
                    style={{
                        width: 48, height: 48, borderRadius: 10,
                        background: isSelected ? '#ede9fe' : '#f3f4f6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <Icon source={icon} tone={isSelected ? 'info' : 'base'} />
                </div>
                <BlockStack gap="100">
                    <Text variant="headingMd" as="h3">{title}</Text>
                    <Text variant="bodySm" tone="subdued">{description}</Text>
                </BlockStack>
            </BlockStack>
        </button>
    );
}

// ---------------------------------------------------------------------------
// Main FormsDashboard
// ---------------------------------------------------------------------------
export default function FormsDashboard() {
    const { widgets: initialWidgets = [], storeLocales = [], primaryLocale = '' } = usePage().props;
    const showToast = useShopifyToast();
    const [forms, setForms] = useState(initialWidgets);
    const [refreshingLocales, setRefreshingLocales] = useState(false);

    // Re-pull the shop's published languages from Shopify. Inertia refreshes
    // the page props, so the editor's language list updates in place.
    const handleRefreshStoreLocales = useCallback(() => {
        setRefreshingLocales(true);
        router.post(
            '/widgets/refresh-locales',
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => setRefreshingLocales(false),
            },
        );
    }, []);

    // Props every widget editor needs for its Language panel.
    const languageProps = {
        storeLocales,
        primaryLocale,
        onRefreshStoreLocales: handleRefreshStoreLocales,
        refreshingLocales,
    };

    useEffect(() => {
        setForms(initialWidgets);
    }, [initialWidgets]);

    const [queryValue, setQueryValue] = useState('');
    const [statusFilter, setStatusFilter] = useState([]);
    const [typeFilter, setTypeFilter] = useState([]);
    const [dateFilter, setDateFilter] = useState([]);
    const [sortState, setSortState] = useState({ columnIndex: 0, direction: 'ascending' });
    const [activePopoverId, setActivePopoverId] = useState(null);
    const [deleteModalActive, setDeleteModalActive] = useState(false);
    const [formToDelete, setFormToDelete] = useState(null);
    const [bulkDeleteModalActive, setBulkDeleteModalActive] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(ITEMS_PER_PAGE_DEFAULT);
    const [togglingStatusIds, setTogglingStatusIds] = useState(new Set());

    // Multi-step create modal
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createStep, setCreateStep] = useState(1);
    const [newWidgetName, setNewWidgetName] = useState('');
    const [selectedWidgetType, setSelectedWidgetType] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

    // Edit modal
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [formToEdit, setFormToEdit] = useState(null);

    // Preview modal
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [formToPreview, setFormToPreview] = useState(null);

    const { mode, setMode } = useSetIndexFiltersMode();

    const steps = [
        { id: 'name', label: 'Name' },
        { id: 'type', label: 'Type' },
        { id: 'configure', label: 'Configure' },
    ];

    // -------------------------------------------------------------------------
    // Filtering & sorting
    // -------------------------------------------------------------------------
    const filteredForms = useMemo(() => {
        let result = [...forms];
        if (queryValue) {
            result = result.filter((f) => f.name.toLowerCase().includes(queryValue.toLowerCase()));
        }
        if (statusFilter.length > 0) {
            result = result.filter((f) => statusFilter.includes(f.status));
        }
        if (typeFilter.length > 0) {
            result = result.filter((f) => typeFilter.includes(f.type || 'form'));
        }
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
        const { columnIndex, direction } = sortState;
        result.sort((a, b) => {
            let cmp = 0;
            if (columnIndex === 0) cmp = a.name.localeCompare(b.name);
            else if (columnIndex === 1) cmp = (a.type || 'form').localeCompare(b.type || 'form');
            else if (columnIndex === 2) cmp = a.status.localeCompare(b.status);
            return direction === 'ascending' ? cmp : -cmp;
        });
        return result;
    }, [forms, queryValue, statusFilter, typeFilter, dateFilter, sortState]);

    const totalPages = Math.max(1, Math.ceil(filteredForms.length / Number(itemsPerPage)));
    const paginatedForms = useMemo(() => {
        const start = (currentPage - 1) * Number(itemsPerPage);
        return filteredForms.slice(start, start + Number(itemsPerPage));
    }, [filteredForms, currentPage, itemsPerPage]);

    useMemo(() => { setCurrentPage(1); }, [queryValue, statusFilter, typeFilter, dateFilter, sortState]);

    const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } = useIndexResourceState(filteredForms);

    // -------------------------------------------------------------------------
    // Filter handlers
    // -------------------------------------------------------------------------
    const handleQueryChange = useCallback((v) => { setQueryValue(v); setCurrentPage(1); }, []);
    const handleQueryClear = useCallback(() => { setQueryValue(''); setCurrentPage(1); }, []);
    const handleStatusFilterChange = useCallback((v) => { setStatusFilter(v); setCurrentPage(1); }, []);
    const handleTypeFilterChange = useCallback((v) => { setTypeFilter(v); setCurrentPage(1); }, []);
    const handleDateFilterChange = useCallback((v) => { setDateFilter(v); setCurrentPage(1); }, []);
    const handleStatusFilterRemove = useCallback(() => { setStatusFilter([]); setCurrentPage(1); }, []);
    const handleTypeFilterRemove = useCallback(() => { setTypeFilter([]); setCurrentPage(1); }, []);
    const handleDateFilterRemove = useCallback(() => { setDateFilter([]); setCurrentPage(1); }, []);
    const handleFiltersClearAll = useCallback(() => { setQueryValue(''); setStatusFilter([]); setTypeFilter([]); setDateFilter([]); setCurrentPage(1); }, []);
    const handleSort = useCallback((idx, dir) => { setSortState({ columnIndex: idx, direction: dir }); setCurrentPage(1); }, []);

    const togglePopover = useCallback((id) => {
        setActivePopoverId((current) => {
            if (current === id) return null;
            setTimeout(() => setActivePopoverId(id), 1);
            return null;
        });
    }, []);
    const closePopover = useCallback(() => setActivePopoverId(null), []);

    // -------------------------------------------------------------------------
    // Status toggle (knob)
    // -------------------------------------------------------------------------
    const handleStatusToggle = useCallback((form) => {
        if (togglingStatusIds.has(form.id)) return;
        const newActive = form.status !== 'active';
        setTogglingStatusIds((s) => new Set([...s, form.id]));
        router.post('/widgets/bulk-status', { ids: [form.id], is_active: newActive }, {
            onSuccess: () => {
                showToast(`"${form.name}" ${newActive ? 'activated' : 'deactivated'}.`);
                setTogglingStatusIds((s) => { const n = new Set(s); n.delete(form.id); return n; });
            },
            onError: () => {
                showToast('Failed to update status.', { isError: true });
                setTogglingStatusIds((s) => { const n = new Set(s); n.delete(form.id); return n; });
            },
        });
    }, [togglingStatusIds, showToast]);

    // -------------------------------------------------------------------------
    // CRUD handlers
    // -------------------------------------------------------------------------
    const handleCreateNew = useCallback(() => {
        setNewWidgetName('');
        setSelectedWidgetType(null);
        setCreateStep(1);
        setCreateModalOpen(false);
        setTimeout(() => setCreateModalOpen(true), 1);
    }, []);

    const handleNextStep = useCallback(() => {
        if (createStep === 1 && newWidgetName.trim()) setCreateStep(2);
        else if (createStep === 2 && selectedWidgetType) setCreateStep(3);
    }, [createStep, newWidgetName, selectedWidgetType]);

    const handlePreviousStep = useCallback(() => {
        if (createStep === 2) setCreateStep(1);
        else if (createStep === 3) { setSelectedWidgetType(null); setCreateStep(2); }
    }, [createStep]);

    const handleCloseCreateModal = useCallback(() => {
        setCreateModalOpen(false);
        setCreateStep(1);
        setNewWidgetName('');
        setSelectedWidgetType(null);
        setIsCreating(false);
    }, []);

    const handleView = useCallback((form) => {
        closePopover();
        setPreviewModalOpen(false);
        setFormToPreview(null);
        setTimeout(() => { setFormToPreview(form); setPreviewModalOpen(true); }, 50);
    }, [closePopover]);

    const handleClosePreview = useCallback(() => { setPreviewModalOpen(false); setFormToPreview(null); }, []);

    const handleEdit = useCallback((form) => {
        closePopover();
        if (previewModalOpen) { setPreviewModalOpen(false); setFormToPreview(null); }
        setFormToEdit(null);
        setEditModalOpen(false);
        setTimeout(() => { setFormToEdit(form); setEditModalOpen(true); }, 1);
    }, [closePopover, previewModalOpen]);

    const handleDuplicate = useCallback((form) => {
        closePopover();
        const newForm = { ...form, id: String(Date.now()), name: `${form.name} (Copy)`, status: 'deactive', createdAt: new Date().toISOString(), submissions: 0 };
        setForms((prev) => [newForm, ...prev]);
        showToast(`"${form.name}" duplicated successfully.`);
    }, [closePopover, showToast]);

    const handleDeleteClick = useCallback((form) => {
        closePopover();
        setFormToDelete(null);
        setDeleteModalActive(false);
        setTimeout(() => { setFormToDelete(form); setDeleteModalActive(true); }, 1);
    }, [closePopover]);

    const handleDeleteConfirm = useCallback(() => {
        if (formToDelete) {
            router.delete(`/widgets/${formToDelete.id}`, {
                onSuccess: () => { showToast(`"${formToDelete.name}" deleted successfully.`); setFormToDelete(null); setDeleteModalActive(false); },
                onError: () => showToast('Failed to delete widget.', { isError: true }),
            });
        }
    }, [formToDelete, showToast]);

    const handleBulkActivate = useCallback(() => {
        router.post('/widgets/bulk-status', { ids: selectedResources, is_active: true }, {
            onSuccess: () => { showToast(`${selectedResources.length} widget(s) activated.`); clearSelection(); },
            onError: () => showToast('Failed to activate widgets.', { isError: true }),
        });
    }, [selectedResources, showToast, clearSelection]);

    const handleBulkDeactivate = useCallback(() => {
        router.post('/widgets/bulk-status', { ids: selectedResources, is_active: false }, {
            onSuccess: () => { showToast(`${selectedResources.length} widget(s) deactivated.`); clearSelection(); },
            onError: () => showToast('Failed to deactivate widgets.', { isError: true }),
        });
    }, [selectedResources, showToast, clearSelection]);

    const handleBulkDeleteConfirm = useCallback(() => {
        router.post('/widgets/bulk-delete', { ids: selectedResources }, {
            onSuccess: () => { showToast(`${selectedResources.length} widget(s) deleted.`); clearSelection(); setBulkDeleteModalActive(false); },
            onError: () => showToast('Failed to delete widgets.', { isError: true }),
        });
    }, [selectedResources, showToast, clearSelection]);

    // Form widget create / edit submit
    const handleFormSubmit = useCallback((formData) => {
        setIsCreating(true);
        router.post('/widgets/store', { name: newWidgetName || 'Untitled Form', type: 'form', configuration: formData }, {
            preserveScroll: true,
            onSuccess: () => { handleCloseCreateModal(); showToast(`"${newWidgetName}" created successfully!`); },
            onError: (errors) => { setIsCreating(false); showToast(Object.values(errors).flat().join(', ') || 'Failed to create widget.', { isError: true }); },
            onFinish: () => setIsCreating(false),
        });
    }, [newWidgetName, showToast, handleCloseCreateModal]);

    const handleTextWidgetSubmit = useCallback((textData) => {
        setIsCreating(true);
        router.post('/widgets/store', { name: newWidgetName || 'Untitled Text Widget', type: 'text', configuration: textData }, {
            preserveScroll: true,
            onSuccess: () => { handleCloseCreateModal(); showToast(`"${newWidgetName}" created successfully!`); },
            onError: (errors) => { setIsCreating(false); showToast(Object.values(errors).flat().join(', ') || 'Failed to create widget.', { isError: true }); },
            onFinish: () => setIsCreating(false),
        });
    }, [newWidgetName, showToast, handleCloseCreateModal]);

    const handleFormUpdate = useCallback((formData) => {
        if (!formToEdit) return;
        setIsCreating(true);
        router.put(`/widgets/${formToEdit.id}`, { configuration: formData }, {
            onSuccess: () => { setEditModalOpen(false); setFormToEdit(null); showToast(`"${formToEdit.name}" updated successfully!`); },
            onError: () => { showToast('Failed to update widget.', { isError: true }); setIsCreating(false); },
            onFinish: () => setIsCreating(false),
        });
    }, [formToEdit, showToast]);

    const handleTextWidgetUpdate = useCallback((textData) => {
        if (!formToEdit) return;
        setIsCreating(true);
        router.put(`/widgets/${formToEdit.id}`, { configuration: textData }, {
            onSuccess: () => { setEditModalOpen(false); setFormToEdit(null); showToast(`"${formToEdit.name}" updated successfully!`); },
            onError: () => { showToast('Failed to update widget.', { isError: true }); setIsCreating(false); },
            onFinish: () => setIsCreating(false),
        });
    }, [formToEdit, showToast]);

    // -------------------------------------------------------------------------
    // Tabs / filters config
    // -------------------------------------------------------------------------
    const [selectedTab, setSelectedTab] = useState(0);
    const tabs = [
        { id: 'all', content: 'All', accessibilityLabel: 'All widgets', panelID: 'all-widgets' },
        { id: 'active', content: 'Active', accessibilityLabel: 'Active widgets', panelID: 'active-widgets' },
        { id: 'deactive', content: 'Inactive', accessibilityLabel: 'Inactive widgets', panelID: 'deactive-widgets' },
    ];

    const handleTabChange = useCallback((i) => {
        setSelectedTab(i);
        setStatusFilter(tabs[i].id === 'all' ? [] : [tabs[i].id]);
        setCurrentPage(1);
    }, []);

    const [sortSelected, setSortSelected] = useState(['name asc']);
    const handleSortChange = useCallback((value) => {
        setSortSelected(value);
        const [field, direction] = value[0].split(' ');
        setSortState({ columnIndex: { name: 0, type: 1, status: 2 }[field] ?? 0, direction });
        setCurrentPage(1);
    }, []);

    const sortOptions = [
        { label: 'Widget name', value: 'name asc', directionLabel: 'A–Z' },
        { label: 'Widget name', value: 'name desc', directionLabel: 'Z–A' },
        { label: 'Type', value: 'type asc', directionLabel: 'A–Z' },
        { label: 'Type', value: 'type desc', directionLabel: 'Z–A' },
    ];

    const filters = [
        {
            key: 'status', label: 'Status',
            filter: <ChoiceList title="Status" titleHidden choices={[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'deactive' }]} selected={statusFilter} onChange={handleStatusFilterChange} allowMultiple />,
            shortcut: true,
        },
        {
            key: 'type', label: 'Type',
            filter: <ChoiceList title="Type" titleHidden choices={[{ label: 'Form Widget', value: 'form' }, { label: 'Text Widget', value: 'text' }]} selected={typeFilter} onChange={handleTypeFilterChange} allowMultiple />,
            shortcut: true,
        },
        {
            key: 'date', label: 'Created date',
            filter: <ChoiceList title="Created date" titleHidden choices={[{ label: 'Today', value: 'today' }, { label: 'Last 7 days', value: 'week' }, { label: 'Last 30 days', value: 'month' }, { label: 'Last 90 days', value: 'quarter' }]} selected={dateFilter} onChange={handleDateFilterChange} allowMultiple />,
            shortcut: true,
        },
    ];

    const appliedFilters = [];
    if (statusFilter.length > 0) {
        appliedFilters.push({ key: 'status', label: `Status: ${statusFilter.map((s) => s === 'deactive' ? 'Inactive' : 'Active').join(', ')}`, onRemove: handleStatusFilterRemove });
    }
    if (typeFilter.length > 0) {
        appliedFilters.push({ key: 'type', label: `Type: ${typeFilter.map((t) => t === 'form' ? 'Form' : 'Text').join(', ')}`, onRemove: handleTypeFilterRemove });
    }
    if (dateFilter.length > 0) {
        const dl = { today: 'Today', week: 'Last 7 days', month: 'Last 30 days', quarter: 'Last 90 days' };
        appliedFilters.push({ key: 'date', label: `Created: ${dateFilter.map((d) => dl[d]).join(', ')}`, onRemove: handleDateFilterRemove });
    }

    const promotedBulkActions = [
        { content: 'Activate', onAction: handleBulkActivate },
        { content: 'Deactivate', onAction: handleBulkDeactivate },
    ];
    const bulkActions = [{ content: 'Delete selected', destructive: true, onAction: () => setBulkDeleteModalActive(true) }];

    // -------------------------------------------------------------------------
    // Type badge pill (same style as Dashboard)
    // -------------------------------------------------------------------------
    const typeBadge = (type) => {
        if (type === 'form') return { label: 'Form', color: '#ede9fe', text: '#5b21b6' };
        if (type === 'text') return { label: 'Text', color: '#fef3c7', text: '#92400e' };
        return { label: 'Form', color: '#ede9fe', text: '#5b21b6' };
    };

    // -------------------------------------------------------------------------
    // Row markup
    // -------------------------------------------------------------------------
    const rowMarkup = paginatedForms.map((form, index) => {
        const actualIndex = (currentPage - 1) * Number(itemsPerPage) + index;
        const tb = typeBadge(form.type);
        const isToggling = togglingStatusIds.has(form.id);
        const createdAt = form.createdAt ? new Date(form.createdAt).toLocaleDateString() : '—';
        const updatedAt = form.updatedAt ? new Date(form.updatedAt).toLocaleDateString() : '—';

        return (
            <IndexTable.Row id={form.id} key={form.id} selected={selectedResources.includes(form.id)} position={actualIndex}>

                {/* Widget Name + ID */}
                <IndexTable.Cell>
                    <BlockStack gap="050">
                        <Button variant="plain" textAlign="left" onClick={() => handleEdit(form)}>
                            <Text variant="bodyMd" fontWeight="semibold" as="span">{form.name}</Text>
                        </Button>
                        <Text variant="bodySm" tone="subdued" as="span">ID: {form.id}</Text>
                    </BlockStack>
                </IndexTable.Cell>

                {/* Type pill */}
                <IndexTable.Cell>
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, background: tb.color, color: tb.text }}>
                        {tb.label}
                    </span>
                </IndexTable.Cell>

                {/* Created */}
                <IndexTable.Cell>
                    <BlockStack gap="0">
                        <Text variant="bodySm" as="span">{createdAt}</Text>
                        <Text variant="bodySm" tone="subdued" as="span">Created</Text>
                    </BlockStack>
                </IndexTable.Cell>

                {/* Status knob */}
                <IndexTable.Cell>
                    <KnobToggle
                        checked={form.status === 'active'}
                        onChange={() => handleStatusToggle(form)}
                        disabled={isToggling}
                    />
                </IndexTable.Cell>

                {/* Actions */}
                <IndexTable.Cell>
                    <InlineStack gap="150" align="end" blockAlign="center">
                        <Tooltip content="Preview widget">
                            <Button
                                size="slim"
                                icon={ViewIcon}
                                variant="secondary"
                                onClick={() => handleView(form)}
                                accessibilityLabel={`Preview ${form.name}`}
                            />
                        </Tooltip>
                        <Tooltip content="Edit widget">
                            <Button
                                size="slim"
                                icon={EditIcon}
                                onClick={() => handleEdit(form)}
                                accessibilityLabel={`Edit ${form.name}`}
                            >
                                Edit
                            </Button>
                        </Tooltip>
                        <Tooltip content="Delete widget">
                            <Button
                                size="slim"
                                tone="critical"
                                variant="secondary"
                                icon={DeleteIcon}
                                onClick={() => handleDeleteClick(form)}
                                accessibilityLabel={`Delete ${form.name}`}
                            />
                        </Tooltip>
                    </InlineStack>
                </IndexTable.Cell>
            </IndexTable.Row>
        );
    });

    // -------------------------------------------------------------------------
    // Stats
    // -------------------------------------------------------------------------
    const totalFormsCount = forms.length;
    const activeFormsCount = forms.filter((f) => f.status === 'active').length;
    const deactiveFormsCount = forms.filter((f) => f.status === 'deactive').length;
    const formWidgetsCount = forms.filter((f) => f.type === 'form' || !f.type).length;
    const textWidgetsCount = forms.filter((f) => f.type === 'text').length;

    // -------------------------------------------------------------------------
    // Create modal content
    // -------------------------------------------------------------------------
    const renderModalFooter = (children) => (
        <Box
            padding="400"
            borderBlockStartWidth="025"
            borderColor="border"
            background="bg-surface-secondary"
        >
            <InlineStack align="end" gap="200">
                {children}
            </InlineStack>
        </Box>
    );

    const renderCreateModalContent = () => {
        switch (createStep) {
            case 1:
                return (
                    <BlockStack gap="0">
                        <Box padding="600">
                            <BlockStack gap="600">
                                <StepIndicator currentStep={1} steps={steps} />
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">Name your widget</Text>
                                    <Text variant="bodyMd" tone="subdued">Give your widget a descriptive name to help you identify it later.</Text>
                                </BlockStack>
                                <TextField
                                    label="Widget name"
                                    value={newWidgetName}
                                    onChange={setNewWidgetName}
                                    placeholder="e.g., Lock Form"
                                    autoComplete="off"
                                    autoFocus
                                />
                            </BlockStack>
                        </Box>
                        {renderModalFooter(
                            <>
                                <Button onClick={handleCloseCreateModal} disabled={isCreating}>Cancel</Button>
                                <Button variant="primary" onClick={handleNextStep} disabled={!newWidgetName.trim() || isCreating}>
                                    Next
                                </Button>
                            </>,
                        )}
                    </BlockStack>
                );
            case 2:
                return (
                    <BlockStack gap="0">
                        <Box padding="600">
                            <BlockStack gap="600">
                                <StepIndicator currentStep={2} steps={steps} />
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">Choose widget type</Text>
                                    <Text variant="bodyMd" tone="subdued">Select the type of widget you want to create for "{newWidgetName}".</Text>
                                </BlockStack>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <WidgetTypeCard icon={NoteIcon} title="Form Widget" description="Create custom forms shown to the users." onClick={() => setSelectedWidgetType('form')} isSelected={selectedWidgetType === 'form'} />
                                    <WidgetTypeCard icon={TextIcon} title="Text Widget" description="Add custom text content with rich formatting, banners." onClick={() => setSelectedWidgetType('text')} isSelected={selectedWidgetType === 'text'} />
                                </div>
                            </BlockStack>
                        </Box>
                        {renderModalFooter(
                            <>
                                <Button onClick={handlePreviousStep} disabled={isCreating}>Back</Button>
                                <Button variant="primary" onClick={handleNextStep} disabled={!selectedWidgetType || isCreating}>
                                    Continue
                                </Button>
                            </>,
                        )}
                    </BlockStack>
                );
            case 3:
                if (selectedWidgetType === 'form') return <DynamicFormWidget onSubmit={handleFormSubmit} onCancel={handleCloseCreateModal} formTitle={`Create: ${newWidgetName}`} isCreating={isCreating} {...languageProps} />;
                if (selectedWidgetType === 'text') return <TextWidget widgetName={newWidgetName} onSubmit={handleTextWidgetSubmit} onCancel={handleCloseCreateModal} isCreating={isCreating} {...languageProps} />;
                return null;
            default:
                return null;
        }
    };

    // -------------------------------------------------------------------------
    // Edit modal content
    // -------------------------------------------------------------------------
    const renderEditModalContent = () => {
        if (!formToEdit) return null;
        if (formToEdit.type === 'text') {
            return <TextWidget widgetName={formToEdit.name} onSubmit={handleTextWidgetUpdate} onCancel={() => { setEditModalOpen(false); setFormToEdit(null); }} initialData={formToEdit.textData} isCreating={isCreating} {...languageProps} />;
        }
        return <DynamicFormWidget onSubmit={handleFormUpdate} onCancel={() => { setEditModalOpen(false); setFormToEdit(null); }} initialFormData={formToEdit?.formData} formTitle={`Edit: ${formToEdit?.name || 'Widget'}`} isCreating={isCreating} {...languageProps} />;
    };

    // -------------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------------
    return (
        <>
            <Page
                title="Widgets Dashboard"
                backAction={{ content: 'Back', onAction: () => router.visit('/') }}
                primaryAction={{ content: 'Create new widget', icon: PlusCircleIcon, onAction: handleCreateNew, accessibilityLabel: 'Create a new widget' }}
            >
                <style>{`
                    .widget-stat-card { transition: all 0.25s ease; }
                    .widget-stat-card:hover {
                        border-color: #c4b5fd !important;
                        box-shadow: 0 8px 30px rgba(139,92,246,0.1) !important;
                        transform: translateY(-2px);
                    }
                `}</style>

                <BlockStack gap="500">
                    {/* Stat cards — same design as Dashboard */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        {[
                            { icon: FileText, label: 'Total Widgets', value: totalFormsCount, subtitle: `${formWidgetsCount} forms, ${textWidgetsCount} text` },
                            { icon: CheckCircle, label: 'Active Widgets', value: activeFormsCount, subtitle: activeFormsCount === 0 ? 'None active' : `${((activeFormsCount / totalFormsCount) * 100).toFixed(0)}% of total` },
                            { icon: EyeOff, label: 'Inactive Widgets', value: deactiveFormsCount, subtitle: deactiveFormsCount === 0 ? 'All active' : 'Not visible' },
                        ].map((card, i) => (
                            <div key={i} className="widget-stat-card" style={{ borderRadius: 12, background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.25s ease' }}>
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
                        {forms.length === 0 ? (
                            <Card>
                                <EmptyState
                                    heading="Create your first widget"
                                    action={{ content: 'Create widget', onAction: handleCreateNew }}
                                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                                >
                                    <Text as="p" variant="bodyMd">Build custom forms and text widgets to enhance your store.</Text>
                                </EmptyState>
                            </Card>
                        ) : (
                            <Card padding="0">
                                <IndexFilters
                                    sortOptions={sortOptions}
                                    sortSelected={sortSelected}
                                    queryValue={queryValue}
                                    queryPlaceholder="Search widgets…"
                                    onQueryChange={handleQueryChange}
                                    onQueryClear={handleQueryClear}
                                    onSort={handleSortChange}
                                    filters={filters}
                                    appliedFilters={appliedFilters}
                                    onClearAll={handleFiltersClearAll}
                                    mode={mode}
                                    setMode={setMode}
                                    tabs={tabs}
                                    selected={selectedTab}
                                    onSelect={handleTabChange}
                                    canCreateNewView={false}
                                    cancelAction={{ onAction: () => setMode('default'), disabled: false, loading: false }}
                                />

                                {filteredForms.length > 0 ? (
                                    <>
                                        <IndexTable
                                            resourceName={{ singular: 'widget', plural: 'widgets' }}
                                            itemCount={filteredForms.length}
                                            selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                                            onSelectionChange={handleSelectionChange}
                                            headings={[
                                                { title: 'Widget Name' },
                                                { title: 'Type' },
                                                { title: 'Created' },
                                                { title: 'Status' },
                                                { title: 'Actions', alignment: 'end' },
                                            ]}
                                            promotedBulkActions={promotedBulkActions}
                                            bulkActions={bulkActions}
                                            sortable={[true, true, false, false, false]}
                                            sortDirection={sortState.direction}
                                            sortColumnIndex={sortState.columnIndex}
                                            onSort={handleSort}
                                        >
                                            {rowMarkup}
                                        </IndexTable>

                                        {filteredForms.length > Number(itemsPerPage) && (
                                            <Box padding="400">
                                                <InlineStack align="center">
                                                    <Pagination
                                                        hasPrevious={currentPage > 1}
                                                        hasNext={currentPage < totalPages}
                                                        onPrevious={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                                                        onNext={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                                                        label={`${currentPage} of ${totalPages}`}
                                                    />
                                                </InlineStack>
                                            </Box>
                                        )}
                                    </>
                                ) : (
                                    <Box padding="400">
                                        <BlockStack gap="200" align="center">
                                            <Text as="p" variant="bodyMd" tone="subdued">No widgets found matching your criteria.</Text>
                                            <Button onClick={handleFiltersClearAll}>Clear filters</Button>
                                        </BlockStack>
                                    </Box>
                                )}
                            </Card>
                        )}
                    </div>
                </BlockStack>
            </Page>

            {/* Delete single widget modal */}
            <Modal id="delete-form-modal" open={deleteModalActive}>
                <BlockStack gap="0">
                    <Box padding="400">
                        <BlockStack gap="400">
                            <Text as="p" variant="bodyMd">Are you sure you want to delete "{formToDelete?.name}"?</Text>
                            <Banner tone="warning">This action cannot be undone. All data will be permanently deleted.</Banner>
                        </BlockStack>
                    </Box>
                    {renderModalFooter(
                        <>
                            <Button onClick={() => { setDeleteModalActive(false); setFormToDelete(null); }} disabled={isCreating}>Cancel</Button>
                            <Button variant="primary" tone="critical" onClick={handleDeleteConfirm} disabled={isCreating} loading={isCreating}>
                                Delete
                            </Button>
                        </>,
                    )}
                </BlockStack>
                <TitleBar title="Delete widget" />
            </Modal>

            {/* Bulk delete modal */}
            <Modal id="bulk-delete-modal" open={bulkDeleteModalActive}>
                <BlockStack gap="0">
                    <Box padding="400">
                        <BlockStack gap="400">
                            <Text as="p" variant="bodyMd">
                                Are you sure you want to delete {selectedResources.length} selected widget{selectedResources.length > 1 ? 's' : ''}?
                            </Text>
                            <Banner tone="warning">This action cannot be undone. All data will be permanently deleted.</Banner>
                        </BlockStack>
                    </Box>
                    {renderModalFooter(
                        <>
                            <Button onClick={() => setBulkDeleteModalActive(false)} disabled={isCreating}>Cancel</Button>
                            <Button variant="primary" tone="critical" onClick={handleBulkDeleteConfirm} disabled={isCreating} loading={isCreating}>
                                Delete {selectedResources.length} widget{selectedResources.length > 1 ? 's' : ''}
                            </Button>
                        </>,
                    )}
                </BlockStack>
                <TitleBar title="Delete selected widgets" />
            </Modal>

            {/* Multi-step create modal */}
            <Modal id="create-widget-modal" open={createModalOpen} variant="max">
                {renderCreateModalContent()}
                <TitleBar title={createStep === 3 ? `Create: ${newWidgetName}` : 'Create New Widget'} />
            </Modal>

            {/* Edit widget modal */}
            <Modal id="edit-widget-modal" open={editModalOpen} variant="max">
                {renderEditModalContent()}
                <TitleBar title={`Edit: ${formToEdit?.name || 'Widget'}`}>
                    <button onClick={() => { setEditModalOpen(false); setFormToEdit(null); }} disabled={isCreating}>Cancel</button>
                </TitleBar>
            </Modal>

            {/* Preview modal */}
            {previewModalOpen && (
                <Modal id="preview-form-modal" open={previewModalOpen} onClose={handleClosePreview} key={formToPreview?.id || 'preview-modal'} variant="max">
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
                        <button onClick={handleClosePreview}>Close</button>
                    </TitleBar>
                </Modal>
            )}
        </>
    );
}