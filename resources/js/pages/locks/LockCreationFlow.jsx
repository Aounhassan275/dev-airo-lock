import { router } from '@inertiajs/react';
import { SaveBar, useAppBridge } from '@shopify/app-bridge-react';
import {
    ActionList,
    Badge,
    BlockStack,
    Button,
    Checkbox,
    Icon,
    InlineStack,
    Modal,
    Popover,
    Tag,
    Text,
} from '@shopify/polaris';
import { ChevronDownIcon, ChevronUpIcon, FilterIcon } from '@shopify/polaris-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlanGate } from '../../components/locks/planGate';
import { itemListsByType, storeItem } from '../../lib/lockItems';
import { CONDITION_TYPES, getRequiredWidgetTypes } from '../../components/locks/conditionTypes';
import { useEmbedStatus } from '../../components/locks/EmbedStatus';
import ItemPickerModal from '../../components/locks/ItemPickerModal';
import LockBuilderForm from '../../components/locks/LockBuilderForm';
import '../../../css/pages/lock-builder.css';

// The condition types, their inputs and the widget-kind rule live in
// components/locks/conditionTypes.jsx, shared with LockCreationEdit.jsx.

// ===== INITIAL STATE VALUES =====
const getInitialLockConfig = (existingLock = null) => ({
    name: existingLock?.name || '',
    description: existingLock?.description || '',
    // Per-lock popup wording; blank fields fall back to the widget.
    popupText: existingLock?.popup_text || {},
    // How long a visitor stays unlocked: remember | session | always.
    reprompt: existingLock?.reprompt || 'remember',
    status: existingLock?.status || 'Active',
    lockType: 'standard',
    applyToHomepage: false,
    selectedItems: [],
    selectedContentType: '',
    hidePrice: false,
    hideAddToCart: false,
    hideCompletely: false,
    protectProducts: false,
    // Unified "When locked" behavior, filtered by content type (maps to the flags
    // above). Values: gate | hide_cart | hide_completely | hide_all |
    // hide_collection_only | hide_cart_products
    lockAction: 'gate',
    priceMessage: 'Sign in to see price',
    hideOnAllPages: true,
    hideOnCheckout: true,
    widget_id: existingLock?.widget_id || '',
    text_widget_id: existingLock?.text_widget_id || '',
    seoBlock: existingLock?.seo_block ?? true,
    // Variant-level locking (5.4): keyed-by-selId variant_ids map and
    // global display behaviors. Per-product variant picker UI is a
    // follow-up; today these are settable but only via the metafield
    // editor in Shopify Admin or via direct API call.
    variantSelections: {},
    lockedVariantDisplay: 'hide',
    allVariantsLockedBehavior: 'hide_product',
});

const getInitialGroups = () => [{ operator: 'AND', conditions: [{ type: 'singlePasscode', value: '', invert: false }] }];

// ===== MAIN COMPONENT =====
const LockCreationFlow = ({
    products = [],
    collections = [],
    pages = [],
    blogs = [],
    themes = [],
    store = null,
    existingLock = null,
    lock_id = null,
    variants = [],
    formWidgets = [],
    storeLocales = [],
    primaryLocale = '',
    textWidgets = [],
    lockedItems = [],
}) => {
    const shopify = useAppBridge();

    // Track if save was successful to prevent SaveBar from showing during navigation
    const saveSuccessRef = useRef(false);

    // ===== STATE =====
    const [lockConfig, setLockConfig] = useState(() => getInitialLockConfig(existingLock));

    // Access rules state
    const [groups, setGroups] = useState(getInitialGroups);
    const [enabled, setEnabled] = useState(true);
    const [redirectUrl, setRedirectUrl] = useState('');

    // NEW: User request by email checkbox state
    const [userRequestByEmail, setUserRequestByEmail] = useState(false);

    // Split Date/Time State
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');

    // UI State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectionModalActive, setSelectionModalActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchBy, setSearchBy] = useState('title');
    const [activeFilters, setActiveFilters] = useState([]);
    const [filterPopoverActive, setFilterPopoverActive] = useState(false);
    const [filterDropdownActive, setFilterDropdownActive] = useState({});
    const [expandedVariantProduct, setExpandedVariantProduct] = useState(null);
    const [filterSearchQueries, setFilterSearchQueries] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // ===== NEW: Leave Confirmation Modal State =====
    const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
    const [pendingNavigationUrl, setPendingNavigationUrl] = useState(null);

    const itemsPerPage = 50;

    // ===== CONTENT TYPE CONFIG =====
    // Plan badges ("Pro"/"Unlimited") on gated picker options — display only,
    // enforcement is server-side.
    const { contentTypeTier, schedulingTier } = usePlanGate();

    // The content-type tiles (labels, icons) are drawn by components/locks/LockBuilderForm.jsx.

    // ── Content-type-aware "When locked" action ────────────────────────────
    // One dropdown choice → underlying flags, with only the behaviors that make
    // sense for the selected content type (no cart/price options for pages).
    const LOCK_ACTION_FLAGS = {
        gate: { hideAddToCart: false, hideCompletely: false, protectProducts: false },
        hide_cart: { hideAddToCart: true, hideCompletely: false, protectProducts: false },
        hide_completely: { hideAddToCart: false, hideCompletely: true, protectProducts: false },
        hide_all: { hideAddToCart: false, hideCompletely: true, protectProducts: true },
        hide_collection_only: { hideAddToCart: false, hideCompletely: true, protectProducts: false },
        hide_cart_products: { hideAddToCart: true, hideCompletely: false, protectProducts: true },
    };
    const lockActionOptions = (() => {
        switch (lockConfig.selectedContentType) {
            case 'products':
                return [
                    { label: 'Require password / access', value: 'gate' },
                    { label: 'Hide the Add to Cart button', value: 'hide_cart' },
                    { label: 'Hide the product completely', value: 'hide_completely' },
                ];
            case 'collections':
                return [
                    { label: 'Require password / access (collection page)', value: 'gate' },
                    { label: 'Hide entire collection + its products', value: 'hide_all' },
                    { label: 'Hide collection page only (keep products)', value: 'hide_collection_only' },
                    { label: 'Hide Add to Cart on its products', value: 'hide_cart_products' },
                ];
            case 'pages':
            case 'blogs':
                return [
                    { label: 'Require password / access', value: 'gate' },
                    { label: "Hide completely (page won't load)", value: 'hide_completely' },
                ];
            default:
                return [{ label: 'Require password / access', value: 'gate' }];
        }
    })();
    const LOCK_ACTION_HELP = {
        gate: 'Visitors must pass your access conditions to view this.',
        hide_cart: 'Product stays visible, but the buy button is hidden until access is granted.',
        hide_completely: 'Removed from storefront grids, search and menus; the direct URL redirects home — unless the visitor passes your conditions.',
        hide_all: 'The collection and every product in it disappear everywhere until access is granted.',
        hide_collection_only: 'The collection page is hidden, but its products stay reachable on their own.',
        hide_cart_products: 'Every product in the collection stays visible, but its Add to Cart button is hidden.',
    };
    const applyLockAction = (action) => {
        const flags = LOCK_ACTION_FLAGS[action] || LOCK_ACTION_FLAGS.gate;
        updateLockConfig({ lockAction: action, ...flags });
    };

    const searchOptions = [
        { label: 'Title', value: 'title' },
        { label: 'Vendor', value: 'vendor' },
    ];

    // ===== COMPUTED VALUES =====
    const variantGroups = useMemo(() => {
        const groupsMap = {};
        products.forEach((product) => {
            let pVariants = [];
            try {
                pVariants = Array.isArray(product.variants) ? product.variants : JSON.parse(product.variants || '[]');
            } catch (e) {
                pVariants = [];
            }
            pVariants.forEach((variant) => {
                ['option1', 'option2', 'option3'].forEach((optKey, index) => {
                    const val = variant[optKey];
                    if (val && val !== 'Default Title') {
                        const groupKey = `opt-${index + 1}-${val}`;
                        if (!groupsMap[groupKey]) {
                            groupsMap[groupKey] = {
                                id: groupKey,
                                title: `All variants where "Option ${index + 1}" equals "${val}"`,
                                variants: [],
                                handle: groupKey,
                                resource_type: 'variant',
                                count: 0,
                                image_url: product.image_url,
                            };
                        }
                        groupsMap[groupKey].variants.push({
                            ...variant,
                            product_title: product.title,
                            product_id: product.id,
                            shopify_product_id: product.shopify_product_id,
                        });
                        groupsMap[groupKey].count++;
                    }
                });
            });
        });
        return Object.values(groupsMap);
    }, [products]);

    const availableFilters = useMemo(() => {
        const selectedContentType = lockConfig.selectedContentType;
        if (selectedContentType === 'products') {
            const allTags = [
                ...new Set(
                    products
                        .flatMap((p) => {
                            try {
                                return Array.isArray(p.tags) ? p.tags : JSON.parse(p.tags || '[]');
                            } catch {
                                return [];
                            }
                        })
                        .filter(Boolean),
                ),
            ];
            const vendors = [...new Set(products.map((p) => p.vendor).filter(Boolean))];
            const productTypes = [...new Set(products.map((p) => p.product_type).filter(Boolean))];
            return [
                { key: 'vendor', label: 'Vendor', type: 'multiselect', options: vendors },
                { key: 'tags', label: 'Tags', type: 'multiselect', options: allTags },
                { key: 'product_type', label: 'Type', type: 'multiselect', options: productTypes },
            ];
        } else if (selectedContentType === 'collections') {
            const collectionTypes = [...new Set(collections.map((c) => c.collection_type).filter(Boolean))];
            return [
                { key: 'collection_type', label: 'Collection Type', type: 'multiselect', options: collectionTypes },
                { key: 'products_count', label: 'Product Count', type: 'multiselect', options: ['0-10', '11-50', '51-100', '100+'] },
            ];
        }
        return [];
    }, [lockConfig.selectedContentType, products, collections]);

    // ===== DATA FUNCTIONS =====
    const getCurrentData = useCallback(() => {
        switch (lockConfig.selectedContentType) {
            case 'products':
                return products;
            case 'collections':
                return collections;
            case 'pages':
                return pages;
            case 'blogs':
                return blogs;
            case 'themes':
                return themes;
            case 'store':
                // Synthesized row, not a database one — same id everywhere (see lib/lockItems).
                return [storeItem(store)];
            case 'variants':
                return variants;
            default:
                return [];
        }
    }, [lockConfig.selectedContentType, products, collections, pages, blogs, themes, store, variants]);

    const getFilteredData = useCallback(() => {
        let data = getCurrentData();
        if (searchQuery) {
            data = data.filter((item) => {
                if (searchBy === 'title') return (item.title || '').toLowerCase().includes(searchQuery.toLowerCase());
                if (searchBy === 'vendor') return (item.vendor || '').toLowerCase().includes(searchQuery.toLowerCase());
                return true;
            });
        }
        activeFilters.forEach((filter) => {
            if (filter.selectedOptions?.length > 0) {
                data = data.filter((item) => {
                    if (filter.key === 'tags') {
                        try {
                            const itemTags = Array.isArray(item.tags) ? item.tags : JSON.parse(item.tags || '[]');
                            return filter.selectedOptions.some((option) => itemTags.includes(option));
                        } catch {
                            return false;
                        }
                    } else if (filter.key === 'products_count') {
                        const count = item.products_count || 0;
                        return filter.selectedOptions.some((option) => {
                            if (option === '0-10') return count >= 0 && count <= 10;
                            if (option === '11-50') return count >= 11 && count <= 50;
                            if (option === '51-100') return count >= 51 && count <= 100;
                            if (option === '100+') return count > 100;
                            return false;
                        });
                    }
                    return filter.selectedOptions.includes(item[filter.key]);
                });
            }
        });

        return data;
    }, [getCurrentData, searchQuery, searchBy, activeFilters]);

    const filteredData = useMemo(() => getFilteredData(), [getFilteredData]);

    // Which ACTIVE lock (if any) already covers an item — drives the picker
    // badge and the "only one lock is enforced per item" warning banner.
    const otherLockNameFor = useCallback(
        (contentType, handle) => {
            const resourceTypeMap = {
                products: 'product',
                collections: 'collection',
                pages: 'page',
                blogs: 'blog',
                themes: 'theme',
                store: 'shop',
                variants: 'variant',
                checkout: 'checkout',
            };
            const rt = resourceTypeMap[contentType];
            if (!rt || !handle) return null;
            const hit = (lockedItems || []).find(
                (l) =>
                    (l.lock_active === true || l.lock_active === 1 || l.lock_active === '1') &&
                    l.resource_type === rt &&
                    String(l.handle) === String(handle),
            );
            return hit ? hit.lock_name : null;
        },
        [lockedItems],
    );

    const activeShopLockName = useMemo(() => {
        const hit = (lockedItems || []).find(
            (l) => l.resource_type === 'shop' && (l.lock_active === true || l.lock_active === 1 || l.lock_active === '1'),
        );
        return hit ? hit.lock_name : null;
    }, [lockedItems]);

    const selectedOverlaps = useMemo(() => {
        const listByType = itemListsByType({ products, collections, pages, blogs, themes, variants, store });
        const idFieldMap = {
            products: 'shopify_product_id',
            collections: 'shopify_collection_id',
            pages: 'shopify_page_id',
            blogs: 'shopify_blog_id',
            themes: 'shopify_theme_id',
        };
        const hits = [];
        (lockConfig.selectedItems || []).forEach((selId) => {
            const sep = selId.indexOf('-');
            const type = selId.slice(0, sep);
            if (type === 'store') {
                if (activeShopLockName) hits.push({ title: 'Entire store', lockName: activeShopLockName });
                return;
            }
            const list = listByType[type] || [];
            const idField = idFieldMap[type] || 'id';
            const item = list.find((it) => `${type}-${it[idField] || it.id}` === selId);
            const lockName = item ? otherLockNameFor(type, item.handle) : null;
            if (lockName) hits.push({ title: item.title || item.name || item.handle, lockName });
        });
        return hits;
    }, [lockConfig.selectedItems, otherLockNameFor, activeShopLockName, products, collections, pages, blogs, themes, store]);
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredData, currentPage, itemsPerPage]);
    const totalPages = useMemo(() => Math.ceil(filteredData.length / itemsPerPage), [filteredData.length, itemsPerPage]);

    // Determine which widget types the lock's conditions need
    const requiredWidgetTypes = useMemo(() => getRequiredWidgetTypes(groups), [groups]);

    // ===== HANDLERS =====
    const updateLockConfig = useCallback((updates) => {
        setLockConfig((prev) => ({ ...prev, ...updates }));
    }, []);

    const showToast = useCallback(
        (message, { isError = false, duration = 3000 } = {}) => {
            try {
                const Toast = shopify?.toast ?? window?.shopify?.toast;
                if (Toast?.show) {
                    Toast.show(message, { duration, isError });
                }
            } catch {
            }
        },
        [shopify],
    );

    const handleContentTypeSelect = useCallback(
        (value) => {
            if (value === 'price_hide') {
                updateLockConfig({ lockType: 'price_hide', selectedContentType: 'products' });
                setSelectionModalActive(true);
            } else if (value === 'checkout') {
                // Checkout is shop-wide — there is no per-item picker. Auto-select
                // the single virtual checkout item and skip the picker modal.
                updateLockConfig({
                    lockType: 'standard',
                    selectedContentType: 'checkout',
                    selectedItems: ['checkout-shop'],
                });
            } else {
                updateLockConfig({ lockType: 'standard', selectedContentType: value });
                setSelectionModalActive(true);
            }
        },
        [updateLockConfig],
    );

    const handleItemToggle = useCallback(
        (selId) => {
            const currentSelected = lockConfig.selectedItems;
            const newSelected = currentSelected.includes(selId) ? currentSelected.filter((s) => s !== selId) : [...currentSelected, selId];
            updateLockConfig({ selectedItems: newSelected });
        },
        [lockConfig.selectedItems, updateLockConfig],
    );

    const handleSelectAllOnPage = useCallback(() => {
        const selectedContentType = lockConfig.selectedContentType;
        const idFieldMap = {
            products: 'shopify_product_id',
            collections: 'shopify_collection_id',
            pages: 'shopify_page_id',
            blogs: 'shopify_blog_id',
            themes: 'shopify_theme_id',
        };
        const allSelIds = filteredData.map((item) => {
            const idField = idFieldMap[selectedContentType] || 'id';
            // Fallback to the local row id when the Shopify GID is missing
            // (sync lag) — must match how row checkboxes build their ids.
            return `${selectedContentType}-${item[idField] || item.id}`;
        });
        const allSelected = allSelIds.length > 0 && allSelIds.every((selId) => lockConfig.selectedItems.includes(selId));
        if (allSelected) {
            updateLockConfig({ selectedItems: lockConfig.selectedItems.filter((selId) => !allSelIds.includes(selId)) });
        } else {
            updateLockConfig({ selectedItems: [...new Set([...lockConfig.selectedItems, ...allSelIds])] });
        }
    }, [filteredData, lockConfig.selectedItems, lockConfig.selectedContentType, updateLockConfig]);

    // Access rule handlers
    const addGroup = useCallback(() => {
        setGroups((prev) => [...prev, { operator: 'OR', conditions: [{ type: 'tag', value: '', invert: false }] }]);
    }, []);

    const removeGroup = useCallback((index) => {
        setGroups((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const updateGroup = useCallback((index, updated) => {
        setGroups((prev) => {
            const next = [...prev];
            next[index] = updated;
            return next;
        });
    }, []);

    const addConditionToGroup = useCallback((groupIndex) => {
        setGroups((prev) => {
            const next = [...prev];
            next[groupIndex] = {
                ...next[groupIndex],
                conditions: [...next[groupIndex].conditions, { type: '', value: '', invert: false }],
            };
            return next;
        });
    }, []);

    // Filter handlers
    const handleAddFilter = useCallback(
        (filterKey) => {
            const filter = availableFilters.find((f) => f.key === filterKey);
            if (filter && !activeFilters.some((f) => f.key === filterKey)) {
                setActiveFilters((prev) => [...prev, { ...filter, selectedOptions: [] }]);
                setFilterDropdownActive((prev) => ({ ...prev, [filterKey]: true }));
            }
            setFilterPopoverActive(false);
        },
        [availableFilters, activeFilters],
    );

    const toggleFilterOption = useCallback((filterKey, option) => {
        setActiveFilters((prev) =>
            prev.map((filter) => {
                if (filter.key === filterKey) {
                    const currentOptions = filter.selectedOptions || [];
                    const newSelectedOptions = currentOptions.includes(option)
                        ? currentOptions.filter((o) => o !== option)
                        : [...currentOptions, option];
                    return { ...filter, selectedOptions: newSelectedOptions };
                }
                return filter;
            }),
        );
    }, []);

    const handleRemoveFilter = useCallback((filterKey) => {
        setActiveFilters((prev) => prev.filter((f) => f.key !== filterKey));
        setFilterDropdownActive((prev) => ({ ...prev, [filterKey]: false }));
    }, []);

    const handleClearAllFilters = useCallback(() => {
        setActiveFilters([]);
        setFilterDropdownActive({});
        setSearchQuery('');
    }, []);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, searchBy, activeFilters, lockConfig.selectedContentType]);

    useEffect(() => {
        setActiveFilters([]);
        setSearchQuery('');
        setFilterSearchQueries({});
    }, [lockConfig.selectedContentType]);

    // Auto-select the first form widget if none is selected
    useEffect(() => {
        if (!lockConfig.widget_id && formWidgets.length > 0) {
            updateLockConfig({ widget_id: String(formWidgets[0].id) });
        }
    }, [formWidgets]);

    // Auto-select the first text widget if none is selected
    useEffect(() => {
        if (!lockConfig.text_widget_id && textWidgets.length > 0) {
            updateLockConfig({ text_widget_id: String(textWidgets[0].id) });
        }
    }, [textWidgets]);

    // Hydrate schedule fields from existingLock when editing
    useEffect(() => {
        const splitDateTime = (raw) => {
            if (!raw) return { date: '', time: '' };
            const d = new Date(raw);
            if (Number.isNaN(d.getTime())) return { date: '', time: '' };
            const pad = (n) => String(n).padStart(2, '0');
            return {
                date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
                time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
            };
        };
        if (existingLock?.starts_at) {
            const { date, time } = splitDateTime(existingLock.starts_at);
            setStartDate(date);
            setStartTime(time);
        }
        if (existingLock?.expires_at) {
            const { date, time } = splitDateTime(existingLock.expires_at);
            setEndDate(date);
            setEndTime(time);
        }
    }, [existingLock]);

    // ===== RESET FORM FUNCTION =====
    const resetForm = useCallback(() => {
        setLockConfig(getInitialLockConfig(existingLock));
        setGroups(getInitialGroups());
        setEnabled(true);
        setRedirectUrl('');
        setUserRequestByEmail(false);
        setStartDate('');
        setStartTime('');
        setEndDate('');
        setEndTime('');
    }, [existingLock]);

    // The pickers read local mirror tables. Products and collections are kept
    // current by webhooks; pages, blogs and themes are not, so anything added
    // in Shopify after install stays invisible until this re-reads it.
    const [refreshingCatalog, setRefreshingCatalog] = useState(false);
    const refreshCatalog = useCallback(() => {
        const type = lockConfig.selectedContentType;
        if (!type || refreshingCatalog) return;
        setRefreshingCatalog(true);
        router.post(
            '/lock/refresh-catalog',
            { type },
            {
                // The half-built lock, and this open modal, must survive it.
                preserveState: true,
                preserveScroll: true,
                onFinish: () => setRefreshingCatalog(false),
            },
        );
    }, [lockConfig.selectedContentType, refreshingCatalog]);

    // ===== SUBMIT HANDLER =====
    const handleSave = useCallback(
        async (navigateAfterSave = null) => {
            if (!lockConfig.name.trim()) {
                showToast('Lock name is required', { isError: true });
                return false;
            }
            if (lockConfig.selectedItems.length === 0) {
                showToast('Please select at least one item to lock', { isError: true });
                return false;
            }

            // Validate condition values for standard locks
            if (lockConfig.lockType !== 'price_hide') {
                const requiresValue = [
                    'singlePasscode', 'multiplePasscodes', 'passcodeFromList',
                    'tag', 'singleSecretLink', 'specificEmail', 'emailContains',
                    'emailFromList', 'pairedCredentials', 'ip',
                ];
                for (let gi = 0; gi < groups.length; gi++) {
                    const group = groups[gi];
                    const typesInGroup = [];
                    for (let ci = 0; ci < group.conditions.length; ci++) {
                        const cond = group.conditions[ci];
                        if (!cond.type) {
                            showToast(`Please select a condition type (Group ${gi + 1}, Condition ${ci + 1})`, { isError: true });
                            return false;
                        }
                        if (typesInGroup.includes(cond.type)) {
                            const typeLabel = CONDITION_TYPES.find(t => t.value === cond.type)?.label || cond.type;
                            showToast(`Duplicate condition "${typeLabel}" in Group ${gi + 1}. Each condition type can only be used once per group.`, { isError: true });
                            return false;
                        }
                        typesInGroup.push(cond.type);

                        // Special validation for location - check value field
                        if (cond.type === 'location') {
                            if (!cond.value || !cond.value.trim()) {
                                const typeLabel = CONDITION_TYPES.find(t => t.value === cond.type)?.label || cond.type;
                                showToast(`Please select a country for "${typeLabel}" (Group ${gi + 1}, Condition ${ci + 1})`, { isError: true });
                                return false;
                            }
                            // If custom is selected, validate custom field
                            if (cond.value === 'custom' && (!cond.custom || !cond.custom.trim())) {
                                showToast(`Please enter a custom location value (Group ${gi + 1}, Condition ${ci + 1})`, { isError: true });
                                return false;
                            }
                        } else if (requiresValue.includes(cond.type) && (!cond.value || !cond.value.trim())) {
                            const typeLabel = CONDITION_TYPES.find(t => t.value === cond.type)?.label || cond.type;
                            showToast(`Please enter a value for "${typeLabel}" (Group ${gi + 1}, Condition ${ci + 1})`, { isError: true });
                            return false;
                        }
                    }
                }
            }

            setIsSubmitting(true);

            try {
                // Prepare selected items data
                const dataMap = itemListsByType({ products, collections, pages, blogs, themes, variants, store });
                const payloadItems = lockConfig.selectedItems
                    .map((selId) => {
                        const [type, id] = selId.split('-');
                        const list = dataMap[type] || [];
                        const idFieldMap = {
                            products: 'shopify_product_id',
                            collections: 'shopify_collection_id',
                            pages: 'shopify_page_id',
                            blogs: 'shopify_blog_id',
                            themes: 'shopify_theme_id',
                            store: 'id',
                            variants: 'id',
                            checkout: 'id',
                        };
                        const item = list.find((item) => {
                            const itemId = item[idFieldMap[type]] || item.id;
                            return `${type}-${itemId}` === selId;
                        });
                        if (!item) return null;
                        const resourceTypeMap = {
                            products: 'product',
                            collections: 'collection',
                            pages: 'page',
                            blogs: 'blog',
                            themes: 'theme',
                            store: 'shop',
                            variants: 'variant',
                            checkout: 'checkout',
                        };
                        return {
                            handle: item.handle || (type === 'themes' ? item.shopify_theme_id : ''),
                            resource_type: resourceTypeMap[type] || type,
                            title: item.title || item.name || '',
                            original_id: item.id,
                            variant_ids: (lockConfig.variantSelections && lockConfig.variantSelections[selId]) || [],
                        };
                    })
                    .filter(Boolean);

                const combineDateTime = (date, time) => {
                    if (!date) return null;
                    const timeStr = time || '00:00';
                    // Merchant enters wall-clock time in their own (browser) timezone.
                    // Parse as local, send an absolute UTC instant so it round-trips with
                    // hydration (splitDateTime) and the storefront expires it correctly.
                    const d = new Date(`${date}T${timeStr}`);
                    if (Number.isNaN(d.getTime())) return null;
                    return d.toISOString();
                };

                const finalStartsAt = combineDateTime(startDate, startTime);
                const finalExpiresAt = combineDateTime(endDate, endTime);

                if (finalStartsAt && finalExpiresAt && new Date(finalExpiresAt) <= new Date(finalStartsAt)) {
                    showToast('Expire date must be after activate date', { isError: true });
                    setIsSubmitting(false);
                    return false;
                }

                const navigationUrl = navigateAfterSave || '/locks';

                if (lockConfig.lockType === 'price_hide') {
                    router.post(
                        '/lock/store-price-rule',
                        {
                            name: lockConfig.name,
                            selectedItems: payloadItems,
                            price_message: lockConfig.priceMessage,
                            hide_on_all_pages: lockConfig.hideOnAllPages,
                            hide_on_checkout: lockConfig.hideOnCheckout,
                            status: 'Active',
                            type: 'price_hide',
                        },
                        {
                            onBefore: () => {
                                // Hide SaveBar BEFORE the request starts
                                saveSuccessRef.current = true;
                                shopify?.saveBar?.hide('my-save-bar').catch(() => { });
                            },
                            onSuccess: (page) => {
                                shopify?.saveBar?.hide('my-save-bar').catch(() => { });
                                // Success always redirects to the lock list; landing back on the
                                // form means the backend refused (e.g. plan gate) —
                                // the error flash can get lost in the embedded iframe,
                                // so never trust an empty error bag alone.
                                const path = (page.url || '').split('?')[0];
                                if (path !== '/locks') {
                                    const params = new URLSearchParams((page.url || '').split('?')[1] || '');
                                    const pageErrors = page.props?.errors || {};
                                    const message = params.get('save_error')
                                        || (Object.keys(pageErrors).length
                                            ? Object.values(pageErrors).flat().join(', ')
                                            : 'Save failed — please try again.');
                                    showToast(message, { isError: true });
                                    saveSuccessRef.current = false;
                                    setIsSubmitting(false);
                                    return;
                                }
                                showToast('Price rule created successfully');
                            },
                            onError: (errors) => {
                                saveSuccessRef.current = false;
                                showToast(Object.values(errors).flat().join(', '), { isError: true });
                                setIsSubmitting(false);
                            },
                            onFinish: () => {
                                setIsSubmitting(false);
                            },
                        },
                    );
                } else {
                    // Build payload and filter out null/undefined to prevent Inertia FormData issues
                    const normalizedGroups = (groups || []).map((group) => ({
                        ...group,
                        conditions: (group.conditions || []).map((cond) => {
                            // Polaris Select for signedIn can show defaults without actually writing value,
                            // so normalize here to ensure storefront validator can evaluate correctly.
                            if (cond.type === 'signedIn' && (!cond.value || !String(cond.value).trim())) {
                                return { ...cond, value: 'loggedIn' };
                            }
                            return cond;
                        }),
                    }));

                    const payload = {
                        name: lockConfig.name,
                        selectedItems: payloadItems,
                        rules: normalizedGroups,
                        status: enabled ? 'Active' : 'Draft',
                        user_request_by_email: userRequestByEmail,
                        hide_add_to_cart: lockConfig.hideAddToCart,
                        hide_completely: lockConfig.hideCompletely,
                        protect_products: lockConfig.protectProducts,
                        seo_block: lockConfig.seoBlock,
                        locked_variant_display: lockConfig.lockedVariantDisplay,
                        all_variants_locked_behavior: lockConfig.allVariantsLockedBehavior,
                    };

                    // Only include optional fields if they have values
                    if (lock_id) payload.lock_id = lock_id;
                    if (lockConfig.description) payload.description = lockConfig.description;
                    if (lockConfig.popupText && Object.keys(lockConfig.popupText).length) {
                        payload.popup_text = lockConfig.popupText;
                    }
                    if (lockConfig.reprompt) payload.reprompt = lockConfig.reprompt;
                    if (finalStartsAt) payload.starts_at = finalStartsAt;
                    if (finalExpiresAt) payload.expires_at = finalExpiresAt;
                    if (redirectUrl) payload.redirect_url = redirectUrl;
                    if (lockConfig.widget_id) payload.widget_id = lockConfig.widget_id;
                    if (lockConfig.text_widget_id) payload.text_widget_id = lockConfig.text_widget_id;
                    router.post(
                        '/locks',
                        payload,
                        {
                            onBefore: () => {
                                // Hide SaveBar BEFORE the request starts
                                saveSuccessRef.current = true;
                                shopify?.saveBar?.hide('my-save-bar').catch(() => { });
                            },
                            onSuccess: (page) => {
                                shopify?.saveBar?.hide('my-save-bar').catch(() => { });
                                // Success always redirects to the lock list; landing back on the
                                // form page (URL keeps its ?shop=…&host=… query, so
                                // compare pathnames) means the backend refused. The
                                // error flash can get lost in the embedded iframe, so
                                // never trust an empty error bag alone.
                                const path = (page.url || '').split('?')[0];
                                if (path !== '/locks') {
                                    const params = new URLSearchParams((page.url || '').split('?')[1] || '');
                                    const pageErrors = page.props?.errors || {};
                                    const message = params.get('save_error')
                                        || (Object.keys(pageErrors).length
                                            ? Object.values(pageErrors).flat().join(', ')
                                            : 'Save failed — please try again.');
                                    showToast(message, { isError: true });
                                    saveSuccessRef.current = false;
                                    setIsSubmitting(false);
                                    return;
                                }
                                showToast('Lock created successfully');
                            },
                            onError: (errors) => {
                                saveSuccessRef.current = false;
                                showToast(Object.values(errors).flat().join(', '), { isError: true });
                                setIsSubmitting(false);
                            },
                            onCancel: () => {
                                saveSuccessRef.current = false;
                                setIsSubmitting(false);
                            },
                            onFinish: (visit) => {
                                setIsSubmitting(false);
                            },
                        },
                    );
                }
                return true;
            } catch (err) {
                saveSuccessRef.current = false;
                showToast(err.message || 'An error occurred while saving', { isError: true });
                setIsSubmitting(false);
                return false;
            }
        },
        [
            lockConfig,
            groups,
            enabled,
            startDate,
            startTime,
            endDate,
            endTime,
            redirectUrl,
            userRequestByEmail,
            lock_id,
            products,
            collections,
            pages,
            blogs,
            themes,
            store,
            variants,
            showToast,
            shopify,
            resetForm,
        ],
    );

    // Check if form has unsaved changes (dirty state)
    const dirty = useMemo(() => {
        if (saveSuccessRef.current) return false;

        return (
            lockConfig.name.trim() !== '' ||
            lockConfig.selectedItems.length > 0 ||
            groups.length > 1 ||
            (groups.length === 1 && groups[0].conditions.some((c) => c.value)) ||
            redirectUrl !== '' ||
            userRequestByEmail !== false ||
            startDate !== '' ||
            startTime !== '' ||
            endDate !== '' ||
            endTime !== '' ||
            !enabled
        );
    }, [lockConfig.name, lockConfig.selectedItems, groups, redirectUrl, userRequestByEmail, startDate, startTime, endDate, endTime, enabled]);

    const handleDiscard = useCallback(() => {
        saveSuccessRef.current = false;
        resetForm();
        shopify?.saveBar?.hide('my-save-bar').catch(() => { });
    }, [resetForm, shopify]);

    // ===== NEW: Navigation Handlers with Confirmation =====
    const handleBackAction = useCallback(() => {
        if (dirty) {
            // Show confirmation modal instead of navigating directly
            setPendingNavigationUrl('/locks');
            setShowLeaveConfirmation(true);
        } else {
            // No unsaved changes, navigate directly
            router.visit('/locks');
        }
    }, [dirty]);

    const handleConfirmSaveAndLeave = useCallback(async () => {
        setShowLeaveConfirmation(false);
        const url = pendingNavigationUrl;
        setPendingNavigationUrl(null);

        // Attempt to save - if successful, it will navigate
        await handleSave(url);
    }, [handleSave, pendingNavigationUrl]);

    const handleConfirmDiscardAndLeave = useCallback(() => {
        setShowLeaveConfirmation(false);
        const url = pendingNavigationUrl;
        setPendingNavigationUrl(null);

        // Discard changes and navigate
        handleDiscard();
        router.visit(url);
    }, [handleDiscard, pendingNavigationUrl]);

    const handleCancelLeave = useCallback(() => {
        setShowLeaveConfirmation(false);
        setPendingNavigationUrl(null);
    }, []);

    // Show/hide SaveBar based on 'dirty' state
    useEffect(() => {
        if (!shopify?.saveBar) {
            return;
        }

        if (saveSuccessRef.current) {
            shopify.saveBar.hide('my-save-bar').catch(() => { });
            return;
        }

        if (dirty) {
            shopify.saveBar.show('my-save-bar');
        } else {
            shopify.saveBar.hide('my-save-bar').catch(() => { });
        }

        // Cleanup: hide SaveBar when component unmounts
        return () => {
            shopify.saveBar.hide('my-save-bar').catch(() => { });
        };
    }, [dirty, shopify]);

    // ===== RENDER HELPERS =====
    const renderFilterTypeDropdown = () => {
        const availableFilterKeys = availableFilters
            .filter((filter) => !activeFilters.some((f) => f.key === filter.key))
            .map((filter) => ({
                content: filter.label,
                onAction: () => handleAddFilter(filter.key),
            }));

        return (
            <Popover
                active={filterPopoverActive}
                activator={
                    <Button
                        onClick={() => setFilterPopoverActive(!filterPopoverActive)}
                        icon={FilterIcon}
                        size="slim"
                        disabled={availableFilters.length === 0}
                    >
                        Add filter
                    </Button>
                }
                onClose={() => setFilterPopoverActive(false)}
                preferredAlignment="left"
            >
                <div className="min-w-[200px]">
                    {availableFilterKeys.length > 0 ? (
                        <ActionList items={availableFilterKeys} actionRole="menuitem" />
                    ) : (
                        <div className="p-4 text-center">
                            <Text variant="bodySm" tone="subdued">
                                No filters available
                            </Text>
                        </div>
                    )}
                </div>
            </Popover>
        );
    };

    const renderFilterTag = (filter) => {
        const isDropdownActive = filterDropdownActive[filter.key] || false;
        const selectedCount = filter.selectedOptions?.length || 0;

        return (
            <Popover
                key={filter.key}
                active={isDropdownActive}
                activator={
                    <div
                        className="inline-block cursor-pointer"
                        onClick={() => setFilterDropdownActive((prev) => ({ ...prev, [filter.key]: !prev[filter.key] }))}
                    >
                        <Tag onRemove={() => handleRemoveFilter(filter.key)}>
                            <InlineStack gap="200" align="center">
                                <Text variant="bodySm" fontWeight="medium">
                                    {filter.label}
                                </Text>
                                {selectedCount > 0 && <Badge tone="info">{selectedCount}</Badge>}
                                <Icon source={isDropdownActive ? ChevronUpIcon : ChevronDownIcon} />
                            </InlineStack>
                        </Tag>
                    </div>
                }
                onClose={() => setFilterDropdownActive((prev) => ({ ...prev, [filter.key]: false }))}
            >
                <div className="max-h-[300px] max-w-[300px] min-w-[200px] overflow-y-auto p-3">
                    <BlockStack gap="200">
                        {(filter.options || []).map((option) => {
                            const isSelected = filter.selectedOptions?.includes(option);
                            return (
                                <div
                                    key={option}
                                    className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-gray-50"
                                    onClick={() => toggleFilterOption(filter.key, option)}
                                >
                                    <span className="pointer-events-none"><Checkbox checked={isSelected} onChange={() => { }} label="" /></span>
                                    <Text variant="bodyMd">{option}</Text>
                                </div>
                            );
                        })}
                    </BlockStack>
                </div>
            </Popover>
        );
    };
    // Variant ids are stored as Shopify GIDs; the storefront matches the
    // numeric id, so persist the trailing numeric portion.
    const variantNumericId = (variant) => String(variant.variant_id || '').split('/').pop();

    const toggleVariant = (selId, variantId, checked) => {
        const current = { ...(lockConfig.variantSelections || {}) };
        const set = new Set(current[selId] || []);
        if (checked) set.add(variantId);
        else set.delete(variantId);
        current[selId] = Array.from(set);
        updateLockConfig({ variantSelections: current });
    };

    // The selected row behind a selection id, for the selection bar and chips.
    const resolveSelected = useCallback(
        (selId) => {
            const dataMap = itemListsByType({ products, collections, pages, blogs, themes, variants, store });
            const [type] = selId.split('-');
            const data = dataMap[type] || [];
            const idFieldMap = {
                products: 'shopify_product_id',
                collections: 'shopify_collection_id',
                pages: 'shopify_page_id',
                blogs: 'shopify_blog_id',
                themes: 'shopify_theme_id',
                checkout: 'id',
            };
            return data.find((item) => `${type}-${item[idFieldMap[type]] || item.id}` === selId) || null;
        },
        [products, collections, pages, blogs, themes, variants, store],
    );

    const embedStatus = useEmbedStatus();
    const saveable = lockConfig.name.trim() !== '' && lockConfig.selectedItems.length > 0;

    // ===== MAIN RENDER =====
    return (
        <>
            {/* ===== APP BRIDGE SAVE BAR ===== */}
            <SaveBar id="my-save-bar">
                <button variant="primary" onClick={() => handleSave()} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save'}
                </button>
                <button variant="secondary" onClick={handleDiscard} disabled={isSubmitting}>
                    Discard
                </button>
            </SaveBar>

            {/* ===== LEAVE CONFIRMATION MODAL ===== */}
            <Modal
                open={showLeaveConfirmation}
                onClose={handleCancelLeave}
                title="You have unsaved changes"
                primaryAction={{
                    content: 'Save',
                    onAction: handleConfirmSaveAndLeave,
                    loading: isSubmitting,
                }}
                secondaryActions={[
                    {
                        content: 'Discard',
                        destructive: true,
                        onAction: handleConfirmDiscardAndLeave,
                    },
                ]}
            >
                <Modal.Section>
                    <BlockStack gap="400">
                        <Text>If you leave this page, all unsaved changes will be lost.</Text>
                        <Text tone="subdued">Would you like to save your changes before leaving?</Text>
                    </BlockStack>
                </Modal.Section>
            </Modal>

            <LockBuilderForm
                title="Create a lock"
                saveLabel={isSubmitting ? 'Creating...' : 'Create lock'}
                saveDisabled={isSubmitting || !saveable}
                saveable={saveable}
                onSave={() => handleSave()}
                onBack={handleBackAction}
                onCancel={handleBackAction}
                lockConfig={lockConfig}
                updateLockConfig={updateLockConfig}
                contentTypeTier={contentTypeTier}
                onSelectContentType={handleContentTypeSelect}
                resolveSelected={resolveSelected}
                onOpenPicker={() => setSelectionModalActive(true)}
                onClearItems={() => updateLockConfig({ selectedItems: [] })}
                onRemoveItem={handleItemToggle}
                selectedOverlaps={selectedOverlaps}
                products={products}
                variants={variants}
                expandedVariantProduct={expandedVariantProduct}
                onExpandVariant={setExpandedVariantProduct}
                onToggleVariant={toggleVariant}
                variantNumericId={variantNumericId}
                lockActionOptions={lockActionOptions}
                lockActionHelp={LOCK_ACTION_HELP}
                onLockAction={applyLockAction}
                groups={groups}
                onGroupChange={updateGroup}
                onAddCondition={addConditionToGroup}
                requiredWidgetTypes={requiredWidgetTypes}
                formWidgets={formWidgets}
                textWidgets={textWidgets}
                storeLocales={storeLocales}
                primaryLocale={primaryLocale}
                enabled={enabled}
                onEnabledChange={setEnabled}
                redirectUrl={redirectUrl}
                onRedirectUrlChange={setRedirectUrl}
                onSeoBlockChange={(checked) => updateLockConfig({ seoBlock: checked })}
                onLockedVariantDisplayChange={(value) => updateLockConfig({ lockedVariantDisplay: value })}
                onAllVariantsLockedChange={(value) => updateLockConfig({ allVariantsLockedBehavior: value })}
                schedulingTier={schedulingTier}
                startDate={startDate}
                startTime={startTime}
                endDate={endDate}
                endTime={endTime}
                onStartDate={setStartDate}
                onStartTime={setStartTime}
                onEndDate={setEndDate}
                onEndTime={setEndTime}
                embedStatus={embedStatus}
            />

            {/* ===== CONTENT SELECTION MODAL ===== */}
            <ItemPickerModal
                open={selectionModalActive}
                onClose={() => setSelectionModalActive(false)}
                contentType={lockConfig.selectedContentType}
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
                searchBy={searchBy}
                onSearchBy={setSearchBy}
                searchOptions={searchOptions}
                filterButton={renderFilterTypeDropdown()}
                activeFilterTags={
                    activeFilters.length > 0 ? (
                        <div className="lb-filter-tags">
                            {activeFilters.map((filter) => renderFilterTag(filter))}
                            <button type="button" className="btn plain xs" onClick={handleClearAllFilters}>
                                Clear all
                            </button>
                        </div>
                    ) : null
                }
                filteredData={filteredData}
                paginatedData={paginatedData}
                isLoading={isLoading}
                selectedItems={lockConfig.selectedItems}
                onToggle={handleItemToggle}
                onSelectAll={handleSelectAllOnPage}
                refreshing={refreshingCatalog}
                onRefresh={refreshCatalog}
                otherLockNameFor={otherLockNameFor}
                currentPage={currentPage}
                totalPages={totalPages}
                onNextPage={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                onPrevPage={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                selectedOverlaps={selectedOverlaps}
            />
        </>
    );
};

export default LockCreationFlow;
