import {
    ActionList,
    Badge,
    BlockStack,
    Box,
    Button,
    Card,
    Checkbox,
    Divider,
    Icon,
    Image,
    InlineGrid,
    InlineStack,
    Modal,
    Pagination,
    Popover,
    Select,
    Spinner,
    Tag,
    Text,
    TextField,
} from '@shopify/polaris';
import {
    BlogIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    CodeIcon,
    CollectionIcon,
    DuplicateIcon,
    FilterIcon,
    PageIcon,
    ProductIcon,
    SearchIcon,
    StoreIcon,
    XIcon,
} from '@shopify/polaris-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { goToPricing, PlanBadge, usePlanGate } from '../../components/locks/planGate';

const AddLock = ({
    products = [],
    collections = [],
    pages = [],
    blogs = [],
    themes = [],
    store = null,
    variants = [],
    lockConfig,
    updateLockConfig,
    onNext,
    error,
    setError,
    isEmbedded = false,
}) => {
    // Local state for modal and UI interactions
    const [selectionModalActive, setSelectionModalActive] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchBy, setSearchBy] = useState('title');
    const [activeFilters, setActiveFilters] = useState([]);
    const [filterPopoverActive, setFilterPopoverActive] = useState(false);
    const [filterDropdownActive, setFilterDropdownActive] = useState({});
    const [contentTypePopoverActive, setContentTypePopoverActive] = useState(false);
    const [filterSearchQueries, setFilterSearchQueries] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    const itemsPerPage = 50;

    // Content type icons mapping
    const contentTypeIcons = {
        products: ProductIcon,
        collections: CollectionIcon,
        pages: PageIcon,
        blogs: BlogIcon,
        articles: PageIcon,
        store: StoreIcon,
        themes: CodeIcon,
        variants: DuplicateIcon,
    };

    // Content types with icons
    const contentTypes = [
        { label: 'Products', value: 'products', icon: ProductIcon },
        { label: 'Collections', value: 'collections', icon: CollectionIcon },
        { label: 'Pages', value: 'pages', icon: PageIcon },
        { label: 'Blogs', value: 'blogs', icon: BlogIcon },
        { label: 'Liquid Theme', value: 'themes', icon: CodeIcon },
        { label: 'Entire Store', value: 'store', icon: StoreIcon },
        { label: 'Variants', value: 'variants', icon: DuplicateIcon },
        { label: 'Hide Price Rule', value: 'price_hide', icon: ProductIcon },
    ];

    // Plan badges ("Pro"/"Unlimited") on gated options — display only,
    // enforcement is server-side.
    const { contentTypeTier } = usePlanGate();

    // Search options
    const searchOptions = [
        { label: 'Title', value: 'title' },
        { label: 'Vendor', value: 'vendor' },
        // { label: 'ID', value: 'id' },
    ];

    // Available filters for each content type
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
            const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
            const productTypes = [...new Set(products.map((p) => p.product_type).filter(Boolean))];

            return [
                { key: 'category', label: 'Category', type: 'multiselect', options: categories },
                { key: 'vendor', label: 'Vendor', type: 'multiselect', options: vendors },
                { key: 'tags', label: 'Tags', type: 'multiselect', options: allTags },
                { key: 'product_type', label: 'Type', type: 'multiselect', options: productTypes },
            ];
        } else if (selectedContentType === 'collections') {
            const collectionTypes = [...new Set(collections.map((c) => c.collection_type).filter(Boolean))];
            const allCollectionTags = [
                ...new Set(
                    collections
                        .flatMap((c) => {
                            try {
                                return Array.isArray(c.tags) ? c.tags : JSON.parse(c.tags || '[]');
                            } catch {
                                return [];
                            }
                        })
                        .filter(Boolean),
                ),
            ];

            return [
                { key: 'collection_type', label: 'Collection Type', type: 'multiselect', options: collectionTypes },
                { key: 'products_count', label: 'Product Count', type: 'multiselect', options: ['0-10', '11-50', '51-100', '100+'] },
                { key: 'tags', label: 'Tags', type: 'multiselect', options: allCollectionTags },
                { key: 'published_status', label: 'Published Status', type: 'multiselect', options: ['published', 'unpublished'] },
            ];
        } else if (selectedContentType === 'pages') {
            return [
                { key: 'published_status', label: 'Published Status', type: 'multiselect', options: ['published', 'unpublished'] },
                {
                    key: 'template_suffix',
                    label: 'Template',
                    type: 'multiselect',
                    options: [...new Set(pages.map((p) => p.template_suffix).filter(Boolean))],
                },
            ];
        } else if (selectedContentType === 'blogs') {
            return [
                { key: 'commentable', label: 'Comments', type: 'multiselect', options: ['enabled', 'disabled'] },
                { key: 'published_status', label: 'Published Status', type: 'multiselect', options: ['published', 'unpublished'] },
            ];
        } else if (selectedContentType === 'themes') {
            return [{ key: 'role', label: 'Role', type: 'multiselect', options: ['main', 'unpublished', 'demo'] }];
        } else if (selectedContentType === 'variants') {
            // For variants, we might want to filter by the extracted Option Name if possible,
            // but for now let's just allow searching by value.
            return [];
        }

        return [];
    }, [lockConfig.selectedContentType, products, collections, pages, blogs]);

    // Get data for current content type
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
                return store ? [store] : [];
            case 'variants':
                return variants;
            default:
                return [];
        }
    }, [lockConfig.selectedContentType, products, collections, pages, blogs, themes]);

    // Client-side filtering function
    const getFilteredData = useCallback(() => {
        let data = getCurrentData();

        // Apply search
        if (searchQuery) {
            const selectedContentType = lockConfig.selectedContentType;
            data = data.filter((item) => {
                if (searchBy === 'title') {
                    return (item.title || '').toLowerCase().includes(searchQuery.toLowerCase());
                } else if (searchBy === 'vendor') {
                    return (item.vendor || '').toLowerCase().includes(searchQuery.toLowerCase());
                } else if (searchBy === 'id') {
                    const idField =
                        selectedContentType === 'products'
                            ? 'shopify_product_id'
                            : selectedContentType === 'collections'
                              ? 'shopify_collection_id'
                              : selectedContentType === 'pages'
                                ? 'shopify_page_id'
                                : selectedContentType === 'blogs'
                                  ? 'shopify_blog_id'
                                  : selectedContentType === 'themes'
                                    ? 'shopify_theme_id'
                                    : selectedContentType === 'store'
                                      ? 'id'
                                      : selectedContentType === 'variants'
                                        ? 'variant_id'
                                        : 'id';
                    return (item[idField] || '').toLowerCase().includes(searchQuery.toLowerCase());
                }
                return true;
            });
        }

        // Apply filters
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
                    } else if (filter.key === 'product_type') {
                        const itemType = item.product_type || '';
                        return filter.selectedOptions.some((option) => itemType.toLowerCase().includes(option.toLowerCase()));
                    } else if (filter.key === 'collection_type') {
                        const itemType = item.collection_type || '';
                        return filter.selectedOptions.some((option) => itemType.toLowerCase().includes(option.toLowerCase()));
                    } else if (filter.key === 'published_status') {
                        const isPublished = item.published_at || item.published;
                        const statusValue = isPublished ? 'published' : 'unpublished';
                        return filter.selectedOptions.includes(statusValue);
                    } else if (filter.key === 'commentable') {
                        const isCommentable = item.commentable || false;
                        const statusValue = isCommentable ? 'enabled' : 'disabled';
                        return filter.selectedOptions.includes(statusValue);
                    } else if (filter.key === 'template_suffix') {
                        const template = item.template_suffix || 'default';
                        return filter.selectedOptions.includes(template);
                    } else {
                        return filter.selectedOptions.includes(item[filter.key]);
                    }
                });
            }
        });

        return data;
    }, [getCurrentData, searchQuery, searchBy, activeFilters, lockConfig.selectedContentType]);

    // Get paginated data
    const getPaginatedData = useCallback(() => {
        const filteredData = getFilteredData();
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredData.slice(startIndex, endIndex);
    }, [getFilteredData, currentPage, itemsPerPage]);

    // Memoized data
    const filteredData = useMemo(() => getFilteredData(), [getFilteredData]);
    const paginatedData = useMemo(() => getPaginatedData(), [getPaginatedData]);
    const totalPages = useMemo(() => Math.ceil(filteredData.length / itemsPerPage), [filteredData.length, itemsPerPage]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, searchBy, activeFilters, lockConfig.selectedContentType]);

    // Reset filters when content type changes
    useEffect(() => {
        setActiveFilters([]);
        setSearchQuery('');
        setFilterSearchQueries({});
    }, [lockConfig.selectedContentType]);

    // Handle content type selection
    const handleContentTypeSelect = useCallback(
        (value) => {
            if (value === 'price_hide') {
                updateLockConfig({
                    lockType: 'price_hide',
                    selectedContentType: 'products',
                });
            } else {
                updateLockConfig({
                    lockType: 'standard',
                    selectedContentType: value,
                });
            }
            setSelectionModalActive(true);
        },
        [updateLockConfig],
    );

    // Handle item selection toggle
    const handleItemToggle = useCallback(
        (selId) => {
            const currentSelected = lockConfig.selectedItems;
            const newSelected = currentSelected.includes(selId) ? currentSelected.filter((s) => s !== selId) : [...currentSelected, selId];
            updateLockConfig({ selectedItems: newSelected });
        },
        [lockConfig.selectedItems, updateLockConfig],
    );

    // Handle select all on page
    const handleSelectAllOnPage = useCallback(() => {
        const selectedContentType = lockConfig.selectedContentType;
        const allSelIds = filteredData.map((item) => {
            const idField =
                selectedContentType === 'products'
                    ? 'shopify_product_id'
                    : selectedContentType === 'collections'
                      ? 'shopify_collection_id'
                      : selectedContentType === 'pages'
                        ? 'shopify_page_id'
                        : selectedContentType === 'blogs'
                          ? 'shopify_blog_id'
                          : selectedContentType === 'themes'
                            ? 'shopify_theme_id'
                            : 'id';
            return `${selectedContentType}-${item[idField]}`;
        });

        const allSelected = allSelIds.length > 0 && allSelIds.every((selId) => lockConfig.selectedItems.includes(selId));

        if (allSelected) {
            updateLockConfig({
                selectedItems: lockConfig.selectedItems.filter((selId) => !allSelIds.includes(selId)),
            });
        } else {
            const newSelected = [...new Set([...lockConfig.selectedItems, ...allSelIds])];
            updateLockConfig({ selectedItems: newSelected });
        }
    }, [filteredData, lockConfig.selectedItems, lockConfig.selectedContentType, updateLockConfig]);

    // Add a new filter
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

    // Toggle filter option selection
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

    // Remove a filter
    const handleRemoveFilter = useCallback((filterKey) => {
        setActiveFilters((prev) => prev.filter((f) => f.key !== filterKey));
        setFilterDropdownActive((prev) => ({ ...prev, [filterKey]: false }));
    }, []);

    // Clear all filters
    const handleClearAllFilters = useCallback(() => {
        setActiveFilters([]);
        setFilterDropdownActive({});
        setSearchQuery('');
        setSearchBy('title');
        setFilterSearchQueries({});
    }, []);

    // Update filter search query
    const updateFilterSearchQuery = useCallback((filterKey, query) => {
        setFilterSearchQueries((prev) => ({
            ...prev,
            [filterKey]: query,
        }));
    }, []);

    // Get filtered options for a filter
    const getFilteredOptions = useCallback(
        (filter) => {
            const query = filterSearchQueries[filter.key] || '';
            if (!query) return filter.options || [];
            return (filter.options || []).filter((option) => option.toString().toLowerCase().includes(query.toLowerCase()));
        },
        [filterSearchQueries],
    );

    // Handle next step
    const handleNextStep = useCallback(() => {
        if (!lockConfig.name.trim()) {
            setError('Lock name is required');
            return;
        }
        if (lockConfig.selectedItems.length === 0) {
            setError('Please select at least one item to lock');
            return;
        }
        setError('');
        onNext();
    }, [lockConfig.name, lockConfig.selectedItems, onNext, setError]);

    // Render filter type dropdown
    const renderFilterTypeDropdown = () => {
        const availableFilterKeys = availableFilters
            .filter((filter) => !activeFilters.some((f) => f.key === filter.key))
            .map((filter) => ({
                content: (
                    <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="medium">
                            {filter.label}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                            {filter.type === 'multiselect' ? 'Multiple select' : 'Single select'}
                        </Text>
                    </BlockStack>
                ),
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
                        variant="primary"
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
                        <>
                            <div className="p-3 px-4">
                                <Text variant="bodySm" fontWeight="medium" tone="subdued">
                                    Available Filters
                                </Text>
                            </div>
                            <Divider />
                            <ActionList items={availableFilterKeys} actionRole="menuitem" />
                        </>
                    ) : (
                        <div className="p-8 text-center">
                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                                <Icon source={FilterIcon} tone="subdued" />
                            </div>
                            <Text variant="bodyMd" fontWeight="medium" tone="subdued">
                                No filters available for {lockConfig.selectedContentType}
                            </Text>
                        </div>
                    )}
                </div>
            </Popover>
        );
    };

    // Render filter tag component
    const renderFilterTag = (filter) => {
        const isDropdownActive = filterDropdownActive[filter.key] || false;
        const selectedCount = filter.selectedOptions?.length || 0;
        const filteredOptions = getFilteredOptions(filter);
        const query = filterSearchQueries[filter.key] || '';

        return (
            <Popover
                key={filter.key}
                active={isDropdownActive}
                activator={
                    <div
                        className="inline-block cursor-pointer"
                        onClick={() =>
                            setFilterDropdownActive((prev) => ({
                                ...prev,
                                [filter.key]: !prev[filter.key],
                            }))
                        }
                    >
                        <Tag onRemove={() => handleRemoveFilter(filter.key)} removeAccessibilityLabel={`Remove ${filter.label} filter`}>
                            <InlineStack gap="200" align="center">
                                <Text variant="bodySm" fontWeight="medium">
                                    {filter.label}
                                </Text>
                                {selectedCount > 0 && (
                                    <div className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#5C6AC4] px-1.5 py-0.5 text-xs font-semibold text-white">
                                        {selectedCount}
                                    </div>
                                )}
                                <div className="opacity-50">
                                    <Icon source={isDropdownActive ? ChevronUpIcon : ChevronDownIcon} />
                                </div>
                            </InlineStack>
                        </Tag>
                    </div>
                }
                onClose={() =>
                    setFilterDropdownActive((prev) => ({
                        ...prev,
                        [filter.key]: false,
                    }))
                }
                preferredAlignment="left"
            >
                <div className="max-w-[320px] min-w-[260px] p-3">
                    <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="semibold">
                            {filter.label}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                            Select options
                        </Text>
                    </BlockStack>

                    <div className="mt-3">
                        <TextField
                            label={`Search ${filter.label}`}
                            labelHidden
                            prefix={<Icon source={SearchIcon} />}
                            value={query}
                            onChange={(value) => updateFilterSearchQuery(filter.key, value)}
                            placeholder={`Search ${filter.label}...`}
                            autoComplete="off"
                            clearButton
                            onClearButtonClick={() => updateFilterSearchQuery(filter.key, '')}
                        />
                    </div>

                    <div className="mt-3 max-h-[300px] overflow-y-auto">
                        {filteredOptions.length > 0 ? (
                            <BlockStack gap="200">
                                {filteredOptions.map((option) => {
                                    const isSelected = filter.selectedOptions?.includes(option);
                                    return (
                                        <div
                                            key={option}
                                            className={`flex cursor-pointer items-center gap-3 rounded-md p-2 px-3 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'} `}
                                            onClick={() => toggleFilterOption(filter.key, option)}
                                        >
                                            <Checkbox checked={isSelected} onChange={() => {}} label="" />
                                            <Text variant="bodyMd">{option}</Text>
                                        </div>
                                    );
                                })}
                            </BlockStack>
                        ) : (
                            <div className="py-5 text-center">
                                <Text variant="bodySm" tone="subdued">
                                    No options found
                                </Text>
                            </div>
                        )}
                    </div>
                </div>
            </Popover>
        );
    };

    // Render selected items preview
    const renderSelectedItemsPreview = () => {
        if (lockConfig.selectedItems.length === 0) return null;

        const selectedContentType = lockConfig.selectedContentType;

        return (
            <Card padding="400">
                <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="medium">
                            Selected Items
                        </Text>
                        <InlineStack gap="200">
                            <Button onClick={() => setSelectionModalActive(true)} size="slim" variant="tertiary">
                                Change
                            </Button>
                            <Button
                                onClick={() => updateLockConfig({ selectedItems: [] })}
                                plain
                                tone="critical"
                                icon={XIcon}
                                size="slim"
                                accessibilityLabel="Clear all selected items"
                            >
                                Clear all
                            </Button>
                        </InlineStack>
                    </InlineStack>

                    <BlockStack gap="200">
                        {lockConfig.selectedItems.slice(0, 3).map((selId) => {
                            const [type, id] = selId.split('-');
                            const dataMap = { products, collections, pages, blogs, themes };
                            const data = dataMap[type] || [];

                            const item = data.find((item) => {
                                const idFieldMap = {
                                    products: 'shopify_product_id',
                                    collections: 'shopify_collection_id',
                                    pages: 'shopify_page_id',
                                    blogs: 'shopify_blog_id',
                                    themes: 'shopify_theme_id',
                                    variants: 'variant_id',
                                };
                                const itemId = item[idFieldMap[type]];
                                return `${type}-${itemId}` === selId;
                            });

                            if (!item) return null;

                            return (
                                <div key={selId} className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-2 px-3">
                                    <InlineStack align="center" gap="300">
                                        {type === 'products' && item.image_url ? (
                                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-gray-100">
                                                <Image source={item.image_url} alt={item.title || item.name} className="h-full w-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-50">
                                                <Icon source={contentTypeIcons[type]} tone="success" />
                                            </div>
                                        )}
                                        <BlockStack gap="050">
                                            <Text variant="bodyMd" fontWeight="medium">
                                                {item.title || item.name}
                                            </Text>
                                            <Text variant="bodySm" tone="subdued">
                                                {type.charAt(0).toUpperCase() + type.slice(1)}
                                                {item.vendor && ` • ${item.vendor}`}
                                                {item.products_count && ` • ${item.products_count} products`}
                                                {item.product_type && ` • ${item.product_type}`}
                                            </Text>
                                        </BlockStack>
                                    </InlineStack>
                                    <Button
                                        onClick={() => handleItemToggle(selId)}
                                        plain
                                        tone="critical"
                                        icon={XIcon}
                                        size="slim"
                                        accessibilityLabel={`Remove ${item.title || item.name}`}
                                    />
                                </div>
                            );
                        })}

                        {lockConfig.selectedItems.length > 3 && (
                            <Box paddingBlockStart="100">
                                <Text variant="bodySm" tone="subdued" alignment="center">
                                    + {lockConfig.selectedItems.length - 3} more items
                                </Text>
                            </Box>
                        )}
                    </BlockStack>
                </BlockStack>
            </Card>
        );
    };

    // Render Hide Price inline settings when lockType is 'price_hide'
    const renderHidePriceInlineSettings = () => {
        if (lockConfig.lockType !== 'price_hide') return null;

        return (
            <Card>
                {/* <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingSm" as="h3">
                            Hide Price Settings
                        </Text>
                        <Badge tone="info">Price Rule</Badge>
                    </InlineStack>

                    <TextField
                        label="Price Hidden Message"
                        value={lockConfig.priceMessage}
                        onChange={(value) => updateLockConfig({ priceMessage: value })}
                        helpText="Message to display in place of the price"
                        autoComplete="off"
                        placeholder="Sign in to see price"
                    />

                    <BlockStack gap="200">
                        <Checkbox
                            label="Hide on all pages (Collections, Search, etc.)"
                            checked={lockConfig.hideOnAllPages}
                            onChange={(checked) => updateLockConfig({ hideOnAllPages: checked })}
                        />
                        <Checkbox
                            label="Disallow Add to Cart / Checkout"
                            checked={lockConfig.hideOnCheckout}
                            onChange={(checked) => updateLockConfig({ hideOnCheckout: checked })}
                            helpText="Hides 'Add to Cart' buttons and prevents checkout"
                        />
                    </BlockStack>
                </BlockStack> */}
            </Card>
        );
    };

    return (
        <BlockStack gap="400">
            <InlineGrid columns={{ xs: '1fr', md: '2fr 1fr' }} gap="400">
                {/* Left Column */}
                <BlockStack gap="400">
                    {/* Lock Name Section */}
                    <Card>
                        <BlockStack gap="400">
                            <Text variant="headingSm" as="h3">
                                Lock Name
                            </Text>
                            <TextField
                                label="Lock Name"
                                value={lockConfig.name}
                                onChange={(value) => updateLockConfig({ name: value })}
                                autoComplete="off"
                                required
                                labelHidden
                                placeholder="Enter lock name"
                                error={error && !lockConfig.name.trim() ? 'Lock name is required' : ''}
                            />
                        </BlockStack>
                    </Card>

                    {/* Content Selection Section */}
                    <Card>
                        <BlockStack gap="400">
                            <InlineStack align="space-between" blockAlign="center">
                                <Text variant="headingSm" as="h3">
                                    Content Selection
                                </Text>
                                {lockConfig.selectedItems.length > 0 && <Badge tone="success">{lockConfig.selectedItems.length} selected</Badge>}
                            </InlineStack>

                            {/* Content Type Selector */}
                            <div>
                                <Text variant="bodySm" as="p" fontWeight="medium">
                                    Content Type
                                </Text>
                                <Box paddingBlockStart="200">
                                    <Popover
                                        active={contentTypePopoverActive}
                                        activator={
                                            <Button
                                                onClick={() => setContentTypePopoverActive(true)}
                                                disclosure
                                                fullWidth
                                                textAlign="left"
                                                disabled={selectionModalActive}
                                            >
                                                <InlineStack align="center" gap="200">
                                                    <Icon
                                                        source={
                                                            lockConfig.selectedContentType
                                                                ? contentTypeIcons[lockConfig.selectedContentType] || ProductIcon
                                                                : ProductIcon
                                                        }
                                                    />
                                                    <span>
                                                        {lockConfig.selectedContentType
                                                            ? lockConfig.lockType === 'price_hide'
                                                                ? 'Hide Price Rule (Products)'
                                                                : contentTypes.find((c) => c.value === lockConfig.selectedContentType)?.label
                                                            : 'Select Content Type'}
                                                    </span>
                                                </InlineStack>
                                            </Button>
                                        }
                                        onClose={() => setContentTypePopoverActive(false)}
                                        preferredAlignment="left"
                                    >
                                        <div className="min-w-[250px]">
                                            <ActionList
                                                items={contentTypes.map((type) => {
                                                    const tier = contentTypeTier(type.value);

                                                    return {
                                                        content: type.label,
                                                        icon: type.icon,
                                                        suffix: <PlanBadge tier={tier} />,
                                                        onAction: () => {
                                                            setContentTypePopoverActive(false);
                                                            // Plan-gated types can't be selected — send
                                                            // the merchant to upgrade instead.
                                                            if (tier) {
                                                                goToPricing();
                                                                return;
                                                            }
                                                            handleContentTypeSelect(type.value);
                                                        },
                                                    };
                                                })}
                                            />
                                        </div>
                                    </Popover>
                                </Box>
                            </div>

                            {/* Selected Items Preview */}
                            {renderSelectedItemsPreview()}
                        </BlockStack>
                    </Card>

                    {/* Hide Price Inline Settings */}
                    {renderHidePriceInlineSettings()}
                </BlockStack>

                {/* Right Column - Summary Card */}
                <BlockStack gap="400">
                    <Card>
                        <BlockStack gap="400">
                            <Text variant="headingSm" as="h3">
                                Lock Summary
                            </Text>
                            <Divider />
                            <BlockStack gap="200">
                                <InlineStack align="space-between">
                                    <Text variant="bodySm" tone="subdued">
                                        Lock Type
                                    </Text>
                                    <Badge tone={lockConfig.lockType === 'price_hide' ? 'attention' : 'info'}>
                                        {lockConfig.lockType === 'price_hide' ? 'Price Rule' : 'Standard Lock'}
                                    </Badge>
                                </InlineStack>
                                <InlineStack align="space-between">
                                    <Text variant="bodySm" tone="subdued">
                                        Content Type
                                    </Text>
                                    <Text variant="bodySm" fontWeight="medium">
                                        {lockConfig.selectedContentType
                                            ? contentTypes.find((c) => c.value === lockConfig.selectedContentType)?.label ||
                                              lockConfig.selectedContentType
                                            : 'Not selected'}
                                    </Text>
                                </InlineStack>
                                <InlineStack align="space-between">
                                    <Text variant="bodySm" tone="subdued">
                                        Selected Items
                                    </Text>
                                    <Text variant="bodySm" fontWeight="medium">
                                        {lockConfig.selectedItems.length}
                                    </Text>
                                </InlineStack>
                            </BlockStack>
                        </BlockStack>
                    </Card>

                    {/* Action Buttons */}
                    <Card>
                        <BlockStack gap="300">
                            <Button
                                variant="primary"
                                size="large"
                                fullWidth
                                onClick={handleNextStep}
                                disabled={!lockConfig.name.trim() || lockConfig.selectedItems.length === 0}
                            >
                                {lockConfig.lockType === 'price_hide' ? 'Configure Price Rule' : 'Configure Access Rules'}
                            </Button>
                            <Text variant="bodySm" tone="subdued" alignment="center">
                                {lockConfig.lockType === 'price_hide'
                                    ? 'Set up price visibility settings'
                                    : 'Define how customers can access this content'}
                            </Text>
                        </BlockStack>
                    </Card>
                </BlockStack>
            </InlineGrid>

            {/* Content Selection Modal */}
            <Modal
                open={selectionModalActive}
                onClose={() => setSelectionModalActive(false)}
                title={`Select ${lockConfig.selectedContentType || 'Content'}`}
                large
                primaryAction={{
                    content: 'Add Selected',
                    onAction: () => setSelectionModalActive(false),
                }}
                secondaryActions={[
                    {
                        content: 'Cancel',
                        onAction: () => setSelectionModalActive(false),
                    },
                ]}
            >
                <Modal.Section>
                    <div className="py-4">
                        {/* Search and Filters */}
                        <Box padding="400" background="bg-surface-secondary" borderRadius="300" shadow="sm">
                            <BlockStack gap="400">
                                <InlineStack gap="300" blockAlign="center">
                                    <div className="flex-1">
                                        <TextField
                                            label={`Search ${lockConfig.selectedContentType}`}
                                            labelHidden
                                            prefix={<Icon source={SearchIcon} />}
                                            value={searchQuery}
                                            onChange={setSearchQuery}
                                            placeholder={`Search ${lockConfig.selectedContentType}...`}
                                            autoComplete="off"
                                            clearButton
                                            onClearButtonClick={() => setSearchQuery('')}
                                        />
                                    </div>
                                    <div className="w-[140px]">
                                        <Select options={searchOptions} value={searchBy} onChange={setSearchBy} />
                                    </div>
                                    {renderFilterTypeDropdown()}
                                </InlineStack>

                                {activeFilters.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        {activeFilters.map((filter) => renderFilterTag(filter))}
                                        <Button plain onClick={handleClearAllFilters} size="slim">
                                            Clear all
                                        </Button>
                                    </div>
                                )}
                            </BlockStack>
                        </Box>

                        {/* Results Summary */}
                        <InlineStack align="space-between" blockAlign="center">
                            <Text variant="bodySm" tone="subdued">
                                Showing {Math.min(filteredData.length, itemsPerPage)} of {filteredData.length} items
                                {filteredData.length !== getCurrentData().length && ` (filtered from ${getCurrentData().length} total)`}
                            </Text>
                            {paginatedData.length > 0 && (
                                <Button onClick={handleSelectAllOnPage} size="slim">
                                    {(() => {
                                        const allSelIds = filteredData.map((item) => {
                                            const idField =
                                                lockConfig.selectedContentType === 'products'
                                                    ? 'shopify_product_id'
                                                    : lockConfig.selectedContentType === 'collections'
                                                      ? 'shopify_collection_id'
                                                      : lockConfig.selectedContentType === 'pages'
                                                        ? 'shopify_page_id'
                                                        : lockConfig.selectedContentType === 'blogs'
                                                          ? 'shopify_blog_id'
                                                          : lockConfig.selectedContentType === 'themes'
                                                            ? 'shopify_theme_id'
                                                            : 'id';
                                            return `${lockConfig.selectedContentType}-${item[idField]}`;
                                        });
                                        const allSelected =
                                            allSelIds.length > 0 && allSelIds.every((selId) => lockConfig.selectedItems.includes(selId));
                                        return allSelected ? 'Deselect all' : 'Select all';
                                    })()}
                                </Button>
                            )}
                        </InlineStack>

                        {/* Data List */}
                        <div className="mt-4 min-h-[400px]">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-10">
                                    <Spinner size="large" />
                                </div>
                            ) : paginatedData.length > 0 ? (
                                <>
                                    <div className="max-h-[400px] overflow-y-auto">
                                        {paginatedData.map((item) => {
                                            const idField =
                                                lockConfig.selectedContentType === 'products'
                                                    ? 'shopify_product_id'
                                                    : lockConfig.selectedContentType === 'collections'
                                                      ? 'shopify_collection_id'
                                                      : lockConfig.selectedContentType === 'pages'
                                                        ? 'shopify_page_id'
                                                        : lockConfig.selectedContentType === 'blogs'
                                                          ? 'shopify_blog_id'
                                                          : lockConfig.selectedContentType === 'themes'
                                                            ? 'shopify_theme_id'
                                                            : 'id';
                                            const selId = `${lockConfig.selectedContentType}-${item[idField]}`;
                                            const isSelected = lockConfig.selectedItems.includes(selId);
                                            const IconComponent = contentTypeIcons[lockConfig.selectedContentType];

                                            return (
                                                <div
                                                    key={selId}
                                                    onClick={() => handleItemToggle(selId)}
                                                    className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 p-3 px-4 transition-colors duration-200 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'} `}
                                                >
                                                    <Checkbox checked={isSelected} onChange={() => {}} label="" />
                                                    {lockConfig.selectedContentType === 'products' && item.image_url ? (
                                                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-gray-100">
                                                            <Image
                                                                source={item.image_url}
                                                                alt={item.title || item.name}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div
                                                            className={`flex h-10 w-10 items-center justify-center rounded ${isSelected ? 'bg-[#008060]' : 'bg-gray-200'} `}
                                                        >
                                                            <Icon source={IconComponent} tone={isSelected ? 'textInverse' : 'subdued'} />
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <Text variant="bodyMd" fontWeight="medium">
                                                            {item.title || item.name}
                                                        </Text>
                                                        <Text variant="bodySm" tone="subdued">
                                                            {lockConfig.selectedContentType === 'products' && item.vendor && `Vendor: ${item.vendor}`}
                                                            {lockConfig.selectedContentType === 'collections' &&
                                                                item.products_count &&
                                                                `Products: ${item.products_count}`}
                                                            {lockConfig.selectedContentType === 'products' &&
                                                                item.category &&
                                                                ` • Category: ${item.category}`}
                                                            {lockConfig.selectedContentType === 'products' &&
                                                                item.product_type &&
                                                                ` • Type: ${item.product_type}`}
                                                            {lockConfig.selectedContentType === 'collections' &&
                                                                item.collection_type &&
                                                                ` • Type: ${item.collection_type}`}
                                                        </Text>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <Box padding="400">
                                            <Pagination
                                                hasNext={currentPage < totalPages}
                                                hasPrevious={currentPage > 1}
                                                onNext={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                                onPrevious={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                                label={`Page ${currentPage} of ${totalPages}`}
                                            />
                                        </Box>
                                    )}
                                </>
                            ) : (
                                <div className="py-10 text-center">
                                    <Icon source={SearchIcon} tone="subdued" />
                                    <Text variant="bodyMd" tone="subdued">
                                        {filteredData.length === 0 ? 'No items found' : 'No items on this page'}
                                    </Text>
                                </div>
                            )}
                        </div>

                        {/* Selected Items Summary */}
                        {lockConfig.selectedItems.length > 0 && (
                            <Box padding="400" background="bg-surface-info-subdued" borderRadius="300" borderStyle="dashed" borderWidth="025" borderColor="border-info">
                                <InlineStack align="space-between" blockAlign="center">
                                    <InlineStack align="center" gap="300">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                                            <Icon source={CollectionIcon} tone="info" />
                                        </div>
                                        <BlockStack gap="050">
                                            <Text variant="bodyMd" fontWeight="semibold" tone="info">
                                                {lockConfig.selectedItems.length} item(s) selected
                                            </Text>
                                            <Text variant="bodySm" tone="subdued">
                                                Click 'Add Selected' to confirm
                                            </Text>
                                        </BlockStack>
                                    </InlineStack>
                                    <Button onClick={() => updateLockConfig({ selectedItems: [] })} plain tone="critical" size="slim">
                                        Deselect all
                                    </Button>
                                </InlineStack>
                            </Box>
                        )}
                    </div>
                </Modal.Section>
            </Modal>
        </BlockStack>
    );
};

export default AddLock;
