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
import {
    CONTENT_TYPE_BY_RESOURCE,
    RESOURCE_TYPE_BY_CONTENT,
    findBySelectionId,
    itemListsByType,
    selectionId,
    storeItem,
} from '../../lib/lockItems';
import { CONDITION_TYPES, getRequiredWidgetTypes } from '../../components/locks/conditionTypes';
import { useEmbedStatus } from '../../components/locks/EmbedStatus';
import ItemPickerModal from '../../components/locks/ItemPickerModal';
import LockBuilderForm from '../../components/locks/LockBuilderForm';
import '../../../css/pages/lock-builder.css';

// The condition types, their inputs and the widget-kind rule live in
// components/locks/conditionTypes.jsx, shared with LockCreationFlow.jsx.

// ===== INITIAL STATE VALUES =====
const getInitialLockConfig = (existingLock = null) => ({
    name: existingLock?.name || '',
    description: existingLock?.description || '',
    // Per-lock popup wording; blank fields fall back to the widget.
    popupText: existingLock?.popup_text || {},
    // How long a visitor stays unlocked: remember | session | always.
    reprompt: existingLock?.reprompt || 'remember',
    status: existingLock?.status || 'Active',
    lockType: existingLock?.type === 'price_hide' ? 'price_hide' : 'standard',
    applyToHomepage: false,
    selectedItems: [],
    selectedContentType: '',
    hidePrice: false,
    hideAddToCart: false,
    hideCompletely: false,
    protectProducts: false,
    // Unified "When locked" behavior, filtered by content type. Maps to the flags
    // above. Values: gate | hide_cart | hide_completely | hide_all |
    // hide_collection_only | hide_cart_products
    lockAction: 'gate',
    priceMessage: 'Sign in to see price',
    hideOnAllPages: true,
    hideOnCheckout: true,
    widget_id: existingLock?.widget_id || '',
    text_widget_id: existingLock?.text_widget_id || '',
    seoBlock: existingLock?.seo_block ?? true,
    variantSelections: {},
    lockedVariantDisplay: 'hide',
    allVariantsLockedBehavior: 'hide_product',
});

const getInitialGroups = () => [{ operator: 'AND', conditions: [{ type: 'singlePasscode', value: '', invert: false }] }];

// ===== MAIN COMPONENT =====
const LockCreationEdit = ({
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

    // ===== STATE =====
    const [lockConfig, setLockConfig] = useState(() => getInitialLockConfig(existingLock));

    const getInitialEnabled = useCallback((lock) => {
        if (!lock) return true;
        return lock.status === 'Active' || lock.status === 1 || lock.status === '1' || lock.status === true;
    }, []);

    // Access rules state
    const [groups, setGroups] = useState(getInitialGroups);
    const [enabled, setEnabled] = useState(() => getInitialEnabled(existingLock));
    const [redirectUrl, setRedirectUrl] = useState('');
    const [userRequestByEmail, setUserRequestByEmail] = useState(false);

    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectionModalActive, setSelectionModalActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchBy, setSearchBy] = useState('title');
    const [activeFilters, setActiveFilters] = useState([]);
    const [filterPopoverActive, setFilterPopoverActive] = useState(false);
    const [filterDropdownActive, setFilterDropdownActive] = useState({});
    const [expandedVariantProduct, setExpandedVariantProduct] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Track if form is dirty (has unsaved changes)
    const [isDirty, setIsDirty] = useState(false);

    // Rules this lock holds whose resource isn't in the picker lists (not synced
    // yet, or renamed in Shopify). Surfaced in a banner and preserved on save.
    const [unmatchedRules, setUnmatchedRules] = useState([]);

    // The store is a synthesized picker row, not a database one — build it once
    // so the picker, hydration, summary and save payload all agree on its id.
    const storeRow = useMemo(() => storeItem(store), [store]);

    // Track if initial hydration is complete
    const isHydratedRef = useRef(false);

    // Track if save was successful to prevent SaveBar from showing during navigation
    const saveSuccessRef = useRef(false);

    // Store initial state for discard functionality
    const initialStateRef = useRef(null);

    // Hydrate state from existingLock
    useEffect(() => {
        if (existingLock) {
            // Initialize variables to store hydrated values
            let hydratedEnabled = getInitialEnabled(existingLock);
            let hydratedStartDate = '';
            let hydratedStartTime = '';
            let hydratedEndDate = '';
            let hydratedEndTime = '';
            let hydratedRedirectUrl = '';
            let hydratedGroups = getInitialGroups();
            let hydratedLockConfig = getInitialLockConfig(existingLock);
            let hydratedUserRequestByEmail = false;

            // Hydrate simple fields
            setEnabled(hydratedEnabled);

            // Hydrate dates. Stored as an absolute UTC instant; show it back in the
            // merchant's (browser) local timezone so date and time stay consistent.
            const pad = (n) => String(n).padStart(2, '0');
            const toLocalDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const toLocalTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            if (existingLock.starts_at) {
                const d = new Date(existingLock.starts_at);
                if (!isNaN(d.getTime())) {
                    hydratedStartDate = toLocalDate(d);
                    hydratedStartTime = toLocalTime(d);
                    setStartDate(hydratedStartDate);
                    setStartTime(hydratedStartTime);
                }
            }
            if (existingLock.expires_at) {
                const d = new Date(existingLock.expires_at);
                if (!isNaN(d.getTime())) {
                    hydratedEndDate = toLocalDate(d);
                    hydratedEndTime = toLocalTime(d);
                    setEndDate(hydratedEndDate);
                    setEndTime(hydratedEndTime);
                }
            }

            // Hydrate rules / settings
            if (existingLock.access_rules && existingLock.access_rules.length > 0) {
                const rules = existingLock.access_rules;
                const firstRule = rules[0];

                // Redirect URL
                if (firstRule.redirect_url) {
                    hydratedRedirectUrl = firstRule.redirect_url;
                    setRedirectUrl(hydratedRedirectUrl);
                }

                // User request by email
                if (existingLock.allow_email_request !== undefined) {
                    hydratedUserRequestByEmail = existingLock.allow_email_request;
                    setUserRequestByEmail(hydratedUserRequestByEmail);
                }

                // Groups / Conditions
                if (firstRule.conditions) {
                    let conds = firstRule.conditions;
                    if (typeof conds === 'string') {
                        try {
                            conds = JSON.parse(conds);
                        } catch (e) { }
                    }
                    if (Array.isArray(conds)) {
                        hydratedGroups = conds;
                        setGroups(hydratedGroups);
                    }
                }

                // Hydrate Selected Items and Content Type
                const hydratedContentType = CONTENT_TYPE_BY_RESOURCE[firstRule.resource_type] || 'products';

                const hydratedSelectedItems = [];
                const lists = itemListsByType({ products, collections, pages, blogs, themes, variants, store });

                const hydratedVariantSelections = {};
                // Rules whose resource isn't in the picker lists — a product that
                // hasn't synced yet, or one renamed in Shopify since the rule was
                // written. They used to be dropped here, which showed the lock as
                // protecting nothing and then DELETED the rule on the next save.
                // Carry them so the save can put them back untouched.
                const unmatched = [];

                rules.forEach((rule) => {
                    const rType = rule.resource_type;
                    const contentType = CONTENT_TYPE_BY_RESOURCE[rType];
                    const list = contentType ? lists[contentType] : null;

                    let item = null;
                    if (list) {
                        if (rType === 'theme') {
                            item = list.find((d) => String(d.shopify_theme_id) === rule.handle || d.name === rule.handle);
                        } else if (rType === 'store' || rType === 'shop' || rType === 'checkout') {
                            // Synthetic single-row targets — the rule's handle doesn't
                            // identify them, the list's only entry does.
                            item = list[0];
                        } else {
                            item = list.find((d) => d.handle === rule.handle);
                        }
                    }

                    if (!item) {
                        unmatched.push({ resource_type: rType, handle: rule.handle });
                        return;
                    }

                    const selId = selectionId(contentType, item);
                    hydratedSelectedItems.push(selId);

                    // Restore per-product variant selections (normalized to numeric ids).
                    const ruleVariantIds = rule.settings?.variant_ids || [];
                    if (Array.isArray(ruleVariantIds) && ruleVariantIds.length > 0) {
                        hydratedVariantSelections[selId] = ruleVariantIds.map((v) => String(v).split('/').pop());
                    }
                });

                setUnmatchedRules(unmatched);

                const priceMessage = firstRule.price_message || existingLock.priceMessage || 'Sign in to see price';
                const hAll = firstRule.settings?.hide_on_all_pages ?? true;
                const hCheckout = firstRule.settings?.hide_on_checkout ?? true;

                const hAddToCart = firstRule.settings?.hide_add_to_cart ?? false;
                const hCompletely = firstRule.settings?.hide_completely ?? false;
                const pProducts = firstRule.settings?.protect_products ?? false;

                // Reverse-map the saved flags back to the unified action choice.
                let hydratedAction = 'gate';
                if (hCompletely && pProducts) hydratedAction = 'hide_all';
                else if (hCompletely && hydratedContentType === 'collections') hydratedAction = 'hide_collection_only';
                else if (hCompletely) hydratedAction = 'hide_completely';
                else if (hAddToCart && pProducts) hydratedAction = 'hide_cart_products';
                else if (hAddToCart) hydratedAction = 'hide_cart';

                hydratedLockConfig = {
                    ...hydratedLockConfig,
                    selectedContentType: hydratedContentType,
                    selectedItems: hydratedSelectedItems,
                    priceMessage: priceMessage,
                    hideOnAllPages: hAll,
                    hideOnCheckout: hCheckout,
                    hideAddToCart: hAddToCart,
                    hideCompletely: hCompletely,
                    protectProducts: pProducts,
                    lockAction: hydratedAction,
                    variantSelections: hydratedVariantSelections,
                    lockedVariantDisplay: firstRule.settings?.locked_variant_display ?? hydratedLockConfig.lockedVariantDisplay ?? 'hide',
                    allVariantsLockedBehavior: firstRule.settings?.all_variants_locked_behavior ?? hydratedLockConfig.allVariantsLockedBehavior ?? 'hide_product',
                };

                setLockConfig(hydratedLockConfig);
            }

            // Store initial state for discard
            initialStateRef.current = {
                lockConfig: hydratedLockConfig,
                groups: hydratedGroups,
                enabled: hydratedEnabled,
                redirectUrl: hydratedRedirectUrl,
                userRequestByEmail: hydratedUserRequestByEmail,
                startDate: hydratedStartDate,
                startTime: hydratedStartTime,
                endDate: hydratedEndDate,
                endTime: hydratedEndTime,
            };

            // Mark hydration complete after a short delay
            setTimeout(() => {
                isHydratedRef.current = true;
            }, 100);
        } else {
            // For new lock creation, store initial empty state
            initialStateRef.current = {
                lockConfig: getInitialLockConfig(null),
                groups: getInitialGroups(),
                enabled: true,
                redirectUrl: '',
                userRequestByEmail: false,
                startDate: '',
                startTime: '',
                endDate: '',
                endTime: '',
            };
            isHydratedRef.current = true;
        }
    }, [existingLock, products, collections, pages, blogs, themes, variants, store, getInitialEnabled]);

    // Control SaveBar visibility
    useEffect(() => {
        if (!shopify?.saveBar) return;

        // If save was successful, always hide
        if (saveSuccessRef.current) {
            shopify.saveBar.hide('lock-save-bar').catch(() => { });
            return;
        }

        if (isDirty) {
            shopify.saveBar.show('lock-save-bar');
        } else {
            shopify.saveBar.hide('lock-save-bar').catch(() => { });
        }
    }, [isDirty, shopify]);

    const itemsPerPage = 50;

    // The content-type tiles (labels, icons) are drawn by components/locks/LockBuilderForm.jsx.

    // Plan badges ("Pro"/"Unlimited") on gated options — display only,
    // enforcement is server-side.
    const { contentTypeTier, schedulingTier } = usePlanGate();

    // ── Content-type-aware "When locked" action ────────────────────────────
    // Maps a single dropdown choice to the underlying flags, and only offers
    // behaviors that make sense for the selected content type (e.g. no
    // cart/price options for pages — that was the illogical case).
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
        markDirty();
    };

    const searchOptions = [
        { label: 'Title', value: 'title' },
        { label: 'Vendor', value: 'vendor' },
    ];

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
                return [storeRow];
            case 'variants':
                return variants;
            default:
                return [];
        }
    }, [lockConfig.selectedContentType, products, collections, pages, blogs, themes, storeRow, variants]);

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

        // Items locked by another lock stay VISIBLE (they used to be silently
        // hidden here, which read as "my product disappeared"); the picker
        // badges them and a banner warns that only one lock is enforced.
        return data;
    }, [getCurrentData, searchQuery, searchBy, activeFilters, lockConfig.selectedContentType]);

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
        const lists = itemListsByType({ products, collections, pages, blogs, themes, variants, store });
        const hits = [];
        (lockConfig.selectedItems || []).forEach((selId) => {
            const type = selId.slice(0, selId.indexOf('-'));
            if (type === 'store') {
                if (activeShopLockName) hits.push({ title: 'Entire store', lockName: activeShopLockName });
                return;
            }
            const item = findBySelectionId(lists[type], type, selId);
            const lockName = item ? otherLockNameFor(type, item.handle) : null;
            if (lockName) hits.push({ title: item.title || item.name || item.handle, lockName });
        });
        return hits;
    }, [lockConfig.selectedItems, otherLockNameFor, activeShopLockName, products, collections, pages, blogs, themes, variants, store]);

    const filteredData = useMemo(() => getFilteredData(), [getFilteredData]);
    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredData, currentPage, itemsPerPage]);
    const totalPages = useMemo(() => Math.ceil(filteredData.length / itemsPerPage), [filteredData.length, itemsPerPage]);

    // Determine which widget types the lock's conditions need
    const requiredWidgetTypes = useMemo(() => getRequiredWidgetTypes(groups), [groups]);

    // Helper to mark form as dirty (only after hydration)
    const markDirty = useCallback(() => {
        if (isHydratedRef.current && !saveSuccessRef.current) {
            setIsDirty(true);
        }
    }, []);

    const updateLockConfig = useCallback(
        (updates) => {
            setLockConfig((prev) => ({ ...prev, ...updates }));
            markDirty();
        },
        [markDirty],
    );

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

    const addGroup = useCallback(() => {
        setGroups((prev) => [...prev, { operator: 'OR', conditions: [{ type: 'tag', value: '', invert: false }] }]);
        markDirty();
    }, [markDirty]);

    const removeGroup = useCallback(
        (index) => {
            setGroups((prev) => prev.filter((_, i) => i !== index));
            markDirty();
        },
        [markDirty],
    );

    const updateGroup = useCallback(
        (index, updated) => {
            setGroups((prev) => {
                const next = [...prev];
                next[index] = updated;
                return next;
            });
            markDirty();
        },
        [markDirty],
    );

    const addConditionToGroup = useCallback(
        (groupIndex) => {
            setGroups((prev) => {
                const next = [...prev];
                next[groupIndex] = {
                    ...next[groupIndex],
                    conditions: [...next[groupIndex].conditions, { type: '', value: '', invert: false }],
                };
                return next;
            });
            markDirty();
        },
        [markDirty],
    );

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

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, searchBy, activeFilters, lockConfig.selectedContentType]);

    useEffect(() => {
        setActiveFilters([]);
        setSearchQuery('');
    }, [lockConfig.selectedContentType]);

    const resetForm = useCallback(() => {
        if (initialStateRef.current) {
            // Restore to initial hydrated state
            setLockConfig(initialStateRef.current.lockConfig);
            setGroups(initialStateRef.current.groups);
            setEnabled(initialStateRef.current.enabled);
            setRedirectUrl(initialStateRef.current.redirectUrl);
            setUserRequestByEmail(initialStateRef.current.userRequestByEmail);
            setStartDate(initialStateRef.current.startDate);
            setStartTime(initialStateRef.current.startTime);
            setEndDate(initialStateRef.current.endDate);
            setEndTime(initialStateRef.current.endTime);
        } else {
            // Fallback to default values (shouldn't normally happen)
            setLockConfig(getInitialLockConfig(existingLock));
            setGroups(getInitialGroups());
            setEnabled(getInitialEnabled(existingLock));
            setRedirectUrl('');
            setUserRequestByEmail(false);
            setStartDate('');
            setStartTime('');
            setEndDate('');
            setEndTime('');
        }
        setIsDirty(false);
    }, [existingLock, getInitialEnabled]);

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
                // The lock being edited, and this open modal, must survive it.
                preserveState: true,
                preserveScroll: true,
                onFinish: () => setRefreshingCatalog(false),
            },
        );
    }, [lockConfig.selectedContentType, refreshingCatalog]);

    const handleSave = useCallback(async () => {
        if (!lockConfig.name.trim()) {
            showToast('Lock name is required', { isError: true });
            return;
        }
        if (lockConfig.selectedItems.length === 0) {
            showToast('Please select at least one item to lock', { isError: true });
            return;
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
                        return;
                    }
                    if (typesInGroup.includes(cond.type)) {
                        const typeLabel = CONDITION_TYPES.find(t => t.value === cond.type)?.label || cond.type;
                        showToast(`Duplicate condition "${typeLabel}" in Group ${gi + 1}. Each condition type can only be used once per group.`, { isError: true });
                        return;
                    }
                    typesInGroup.push(cond.type);

                    // Special validation for location - check value field
                    if (cond.type === 'location') {
                        if (!cond.value || !cond.value.trim()) {
                            const typeLabel = CONDITION_TYPES.find(t => t.value === cond.type)?.label || cond.type;
                            showToast(`Please select a country for "${typeLabel}" (Group ${gi + 1}, Condition ${ci + 1})`, { isError: true });
                            return;
                        }
                        // If custom is selected, validate custom field
                        if (cond.value === 'custom' && (!cond.custom || !cond.custom.trim())) {
                            showToast(`Please enter a custom location value (Group ${gi + 1}, Condition ${ci + 1})`, { isError: true });
                            return;
                        }
                    } else if (requiresValue.includes(cond.type) && (!cond.value || !cond.value.trim())) {
                        const typeLabel = CONDITION_TYPES.find(t => t.value === cond.type)?.label || cond.type;
                        showToast(`Please enter a value for "${typeLabel}" (Group ${gi + 1}, Condition ${ci + 1})`, { isError: true });
                        return;
                    }
                }
            }
        }

        setIsSubmitting(true);

        try {
            const lists = itemListsByType({ products, collections, pages, blogs, themes, variants, store });
            const unresolved = [];
            const payloadItems = lockConfig.selectedItems
                .map((selId) => {
                    const type = selId.slice(0, selId.indexOf('-'));
                    const item = findBySelectionId(lists[type], type, selId);
                    if (!item) {
                        unresolved.push(selId);
                        return null;
                    }
                    return {
                        handle: item.handle || (type === 'themes' ? item.shopify_theme_id : ''),
                        resource_type: RESOURCE_TYPE_BY_CONTENT[type] || type,
                        title: item.title || item.name || '',
                        original_id: item.id,
                        variant_ids: (lockConfig.variantSelections && lockConfig.variantSelections[selId]) || [],
                    };
                })
                .filter(Boolean);

            // Rules whose resource the picker couldn't show (see hydration) are
            // sent back exactly as they are. The backend syncs rules to match
            // this payload, so leaving them out would delete them — losing
            // protection the merchant never asked to remove.
            unmatchedRules.forEach((rule) => {
                payloadItems.push({
                    handle: rule.handle || '',
                    resource_type: rule.resource_type,
                    title: '',
                    original_id: null,
                    variant_ids: [],
                });
            });

            // A selection that resolves to nothing would send an empty list, which
            // the backend treats as "no change" — the save would silently not
            // apply. Fail loudly instead of lying about having saved.
            if (payloadItems.length === 0) {
                showToast('Could not resolve the selected items. Please reselect them and try again.', { isError: true });
                setIsSubmitting(false);
                return false;
            }
            const combineDateTime = (date, time) => {
                if (!date) return null;
                const timeStr = time || '00:00';
                // The merchant enters wall-clock time in their own (browser) timezone.
                // Parse it as local, then send an absolute UTC instant so the value
                // round-trips correctly and the storefront expires it at the right moment.
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

            // Mark save as successful BEFORE the request to prevent SaveBar from showing
            saveSuccessRef.current = true;

            const payload = {
                ...lockConfig,
                lock_id: existingLock?.id || lock_id,
                selectedItems: payloadItems,
                rules: (groups || []).map((group) => ({
                    ...group,
                    conditions: (group.conditions || []).map((cond) => {
                        // signedIn Select can visually default to loggedIn without persisting cond.value.
                        // Ensure validator gets a real value.
                        if (cond.type === 'signedIn' && (!cond.value || !String(cond.value).trim())) {
                            return { ...cond, value: 'loggedIn' };
                        }
                        return cond;
                    }),
                })),
                status: enabled ? 'Active' : 'Draft',
                description: lockConfig.description,
                popup_text: lockConfig.popupText || {},
                reprompt: lockConfig.reprompt || 'remember',
                starts_at: finalStartsAt,
                expires_at: finalExpiresAt,
                redirect_url: redirectUrl,
                widget_id: lockConfig.widget_id,
                text_widget_id: lockConfig.text_widget_id,
                user_request_by_email: userRequestByEmail,
                hide_add_to_cart: lockConfig.hideAddToCart,
                hide_completely: lockConfig.hideCompletely,
                protect_products: lockConfig.protectProducts,
                seo_block: lockConfig.seoBlock,
                locked_variant_display: lockConfig.lockedVariantDisplay,
                all_variants_locked_behavior: lockConfig.allVariantsLockedBehavior,
            };

            if (lockConfig.lockType === 'price_hide') {
                router.post(
                    '/lock/store-price-rule',
                    { ...payload, type: 'price_hide', price_message: lockConfig.priceMessage },
                    {
                        preserveState: false,
                        preserveScroll: false,
                        onBefore: () => {
                            // Hide SaveBar before navigation starts
                            shopify?.saveBar?.hide('lock-save-bar').catch(() => { });
                        },
                        onSuccess: (page) => {
                            // Landing back on the form page means the backend refused.
                            // The real reason arrives in the redirect URL (?save_error=…)
                            // because session flash is unreliable in the embedded iframe.
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
                            setIsDirty(false);
                            showToast('Price rule updated successfully');
                            setTimeout(() => router.visit('/locks'), 100);
                        },
                        onError: (errors) => {
                            // Reset on error so SaveBar can show again
                            saveSuccessRef.current = false;
                            showToast(Object.values(errors).flat().join(', '), { isError: true });
                        },
                        onFinish: () => {
                            // Only reset submitting if save failed
                            if (!saveSuccessRef.current) {
                                setIsSubmitting(false);
                            }
                        },
                    },
                );
            } else {
                const lockId = existingLock?.id || lock_id;
                const url = lockId ? `/locks/${lockId}` : '/locks';
                const method = lockId ? 'put' : 'post';

                // Remap payload fields to match what updateLock expects
                const updatePayload = lockId ? {
                    name: payload.name,
                    enabled: enabled,
                    conditions: payload.rules,
                    selectedItems: payload.selectedItems,
                    redirect_url: payload.redirect_url,
                    widget_id: payload.widget_id,
                    text_widget_id: payload.text_widget_id,
                    user_request_by_email: payload.user_request_by_email,
                    hide_add_to_cart: payload.hide_add_to_cart,
                    hide_completely: payload.hide_completely,
                    protect_products: payload.protect_products,
                    starts_at: payload.starts_at,
                    expires_at: payload.expires_at,
                    prompt: payload.description,
                    popup_text: payload.popup_text,
                    reprompt: payload.reprompt,
                    // These were silently dropped on edit — the update endpoint
                    // accepts them and the storefront needs them to persist.
                    seo_block: payload.seo_block,
                    locked_variant_display: payload.locked_variant_display,
                    all_variants_locked_behavior: payload.all_variants_locked_behavior,
                } : payload;

               

                router[method](url, updatePayload, {
                    preserveState: false,
                    preserveScroll: false,
                    onBefore: () => {
                        // Hide SaveBar before navigation starts
                        shopify?.saveBar?.hide('lock-save-bar').catch(() => { });
                    },
                    onSuccess: (page) => {
                        // Landing back on the form page means the backend refused.
                        // The real reason arrives in the redirect URL (?save_error=…)
                        // because session flash is unreliable in the embedded iframe.
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
                        setIsDirty(false);
                        showToast('Lock updated successfully');
                        setTimeout(() => router.visit('/locks'), 100);
                    },
                    onError: (errors) => {
                        // Reset on error so SaveBar can show again
                        saveSuccessRef.current = false;
                        showToast(Object.values(errors).flat().join(', '), { isError: true });
                    },
                    onFinish: () => {
                        // Only reset submitting if save failed
                        if (!saveSuccessRef.current) {
                            setIsSubmitting(false);
                        }
                    },
                });
            }
        } catch (err) {
            // Reset on error
            saveSuccessRef.current = false;
            showToast(err.message || 'An error occurred while saving', { isError: true });
            setIsSubmitting(false);
        }
    }, [
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
        existingLock,
        products,
        collections,
        pages,
        blogs,
        themes,
        store,
        variants,
        unmatchedRules,
        showToast,
        shopify,
    ]);

    const handleDiscard = useCallback(() => {
        saveSuccessRef.current = false;
        resetForm();
        shopify?.saveBar?.hide('lock-save-bar').catch(() => { });
    }, [resetForm, shopify]);

    const renderFilterTypeDropdown = () => (
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
                {availableFilters.length > 0 ? (
                    <ActionList items={availableFilters.map((f) => ({ content: f.label, onAction: () => handleAddFilter(f.key) }))} />
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
                        {(filter.options || []).map((option) => (
                            <div
                                key={option}
                                className="flex cursor-pointer items-center gap-2 rounded p-2 hover:bg-gray-50"
                                onClick={() => toggleFilterOption(filter.key, option)}
                            >
                                {/* Decorative — the row's onClick owns selection. Kept pointer-inert so a click on the
                                    checkbox can't re-fire through the <label> and double-toggle the row (net no-op). */}
                                <span className="pointer-events-none">
                                    <Checkbox checked={filter.selectedOptions?.includes(option)} onChange={() => { }} label="" />
                                </span>
                                <Text variant="bodyMd">{option}</Text>
                            </div>
                        ))}
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
            const lists = itemListsByType({ products, collections, pages, blogs, themes, variants, store });
            const type = selId.slice(0, selId.indexOf('-'));
            return findBySelectionId(lists[type], type, selId) || null;
        },
        [products, collections, pages, blogs, themes, variants, store],
    );

    const embedStatus = useEmbedStatus();
    const saveable = lockConfig.name.trim() !== '' && lockConfig.selectedItems.length > 0;
    const lockKey = existingLock?.id || lock_id;

    // Leaving: the contextual save bar outlives an Inertia visit, so it goes first.
    const leave = useCallback(() => {
        shopify?.saveBar?.hide('lock-save-bar').catch(() => { });
        router.visit('/locks');
    }, [shopify]);

    // ===== DELETE =====
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const confirmDelete = useCallback(() => {
        if (!lockKey || deleting) return;
        setDeleting(true);
        // Nothing on this page is worth keeping once the lock is gone.
        saveSuccessRef.current = true;
        shopify?.saveBar?.hide('lock-save-bar').catch(() => { });
        const name = lockConfig.name || existingLock?.name || 'Lock';

        // DELETE /locks/{lock} answers with back(). Sent from here, "back" is
        // this lock's own page, which no longer exists once it is deleted — so
        // go to the list first and make the request from there.
        router.visit('/locks', {
            onSuccess: () => {
                router.delete(`/locks/${lockKey}`, {
                    preserveScroll: true,
                    onSuccess: () => showToast(`"${name}" deleted.`),
                    onError: () => showToast('Failed to delete lock. Please try again.', { isError: true }),
                });
            },
            onError: () => {
                saveSuccessRef.current = false;
                setDeleting(false);
            },
        });
    }, [lockKey, deleting, shopify, lockConfig.name, existingLock, showToast]);

    // The saved state, not the toggle: the badge says what the storefront is doing now.
    const savedActive = getInitialEnabled(existingLock);
    const statusBadge = !savedActive ? (
        <span className="badge">Disabled</span>
    ) : embedStatus.enabled === false ? (
        <span className="badge warning">Not running yet</span>
    ) : (
        <span className="badge success">Running</span>
    );

    return (
        <>
            {/* SaveBar Component */}
            <SaveBar id="lock-save-bar">
                <button variant="primary" onClick={handleSave} disabled={isSubmitting} loading={isSubmitting ? '' : undefined}>
                    Save
                </button>
                <button variant="secondary" onClick={handleDiscard} disabled={isSubmitting}>
                    Discard
                </button>
            </SaveBar>

            <Modal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                title="Delete this lock?"
                primaryAction={{
                    content: 'Delete lock',
                    destructive: true,
                    loading: deleting,
                    onAction: confirmDelete,
                }}
                secondaryActions={[{ content: 'Cancel', onAction: () => setDeleteOpen(false), disabled: deleting }]}
            >
                <Modal.Section>
                    <Text as="p">
                        The content it covers goes back to being open to everyone, straight away. This cannot be undone.
                    </Text>
                </Modal.Section>
            </Modal>

            <LockBuilderForm
                title={lockConfig.name || existingLock?.name || 'Edit lock'}
                lockId={lockKey}
                statusBadge={statusBadge}
                saveLabel={isSubmitting ? 'Saving...' : 'Save'}
                saveDisabled={isSubmitting || !saveable}
                saveable={saveable}
                onSave={handleSave}
                onBack={leave}
                onCancel={leave}
                onDelete={lockKey ? () => setDeleteOpen(true) : null}
                lockConfig={lockConfig}
                updateLockConfig={updateLockConfig}
                contentTypeTier={contentTypeTier}
                onSelectContentType={handleContentTypeSelect}
                resolveSelected={resolveSelected}
                onOpenPicker={() => setSelectionModalActive(true)}
                onClearItems={() => updateLockConfig({ selectedItems: [] })}
                onRemoveItem={handleItemToggle}
                selectedOverlaps={selectedOverlaps}
                unmatchedRules={unmatchedRules}
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
                onEnabledChange={(checked) => {
                    setEnabled(checked);
                    markDirty();
                }}
                redirectUrl={redirectUrl}
                onRedirectUrlChange={(value) => {
                    setRedirectUrl(value);
                    markDirty();
                }}
                onSeoBlockChange={(checked) => {
                    updateLockConfig({ seoBlock: checked });
                    markDirty();
                }}
                onLockedVariantDisplayChange={(value) => {
                    updateLockConfig({ lockedVariantDisplay: value });
                    markDirty();
                }}
                onAllVariantsLockedChange={(value) => {
                    updateLockConfig({ allVariantsLockedBehavior: value });
                    markDirty();
                }}
                schedulingTier={schedulingTier}
                startDate={startDate}
                startTime={startTime}
                endDate={endDate}
                endTime={endTime}
                onStartDate={(value) => { setStartDate(value); markDirty(); }}
                onStartTime={(value) => { setStartTime(value); markDirty(); }}
                onEndDate={(value) => { setEndDate(value); markDirty(); }}
                onEndTime={(value) => { setEndTime(value); markDirty(); }}
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

export default LockCreationEdit;
