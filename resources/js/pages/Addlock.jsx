import { router } from '@inertiajs/react';
import {
    ActionList,
    Badge,
    Banner,
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
    Layout,
    Modal,
    Page,
    Pagination,
    Popover,
    Select,
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
    FilterIcon,
    PageIcon,
    ProductIcon,
    SearchIcon,
    StoreIcon,
    XIcon,
} from '@shopify/polaris-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import HidePriceRule from './locks/HidePriceRule';

const AddLock = ({ products = [], collections = [], pages = [], blogs = [], themes = [] }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('Active');
    const [applyToHomepage, setApplyToHomepage] = useState(false);
    const [hidePrice, setHidePrice] = useState(false);
    const [priceMessage, setPriceMessage] = useState('');
    const [rules, setRules] = useState([]);
    const [lockType, setLockType] = useState('standard');
    const [modalActive, setModalActive] = useState(false);
    const [newRuleCondition, setNewRuleCondition] = useState('');
    const [newRuleOperator, setNewRuleOperator] = useState('AND');
    const [error, setError] = useState('');

    // Content selection modal
    const [selectionModalActive, setSelectionModalActive] = useState(false);
    const [selectedContentType, setSelectedContentType] = useState(''); // Changed to empty default
    const [selectedItems, setSelectedItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchBy, setSearchBy] = useState('title');

    // Filter states
    const [activeFilters, setActiveFilters] = useState([]);
    const [filterPopoverActive, setFilterPopoverActive] = useState(false);
    const [filterDropdownActive, setFilterDropdownActive] = useState({});
    const [contentTypePopoverActive, setContentTypePopoverActive] = useState(false);

    // Filter search states
    const [filterSearchQueries, setFilterSearchQueries] = useState({});

    // Pagination states
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(50);

    // Content type icons mapping
    const contentTypeIcons = {
        products: ProductIcon,
        collections: CollectionIcon,
        pages: PageIcon,
        blogs: BlogIcon,
        articles: PageIcon,
        store: StoreIcon,
        themes: CodeIcon,
    };

    // Content types with icons
    const contentTypes = [
        { label: 'Products', value: 'products', icon: ProductIcon },
        { label: 'Collections', value: 'collections', icon: CollectionIcon },
        { label: 'Pages', value: 'pages', icon: PageIcon },
        { label: 'Blogs', value: 'blogs', icon: BlogIcon },
        // { label: 'Variants', value: 'variants', icon: VariantIcon },
        // { label: 'Metafields', value: 'metafields', icon: MetafieldsIcon },
        // { label: 'Articles', value: 'articles', icon: PageIcon },
        // { label: 'Store', value: 'store', icon: StoreIcon },
        // { label: 'Liquid Theme', value: 'themes', icon: CodeIcon },
        { label: 'Hide Price Rule', value: 'price_hide', icon: ProductIcon },
    ];

    // Available filters for each content type
    const availableFilters = useMemo(() => {
        if (selectedContentType === 'products') {
            // Extract unique values from products data
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

            // Get unique product types from products (like suit, kurta, etc.)
            const productTypes = [...new Set(products.map((p) => p.product_type).filter(Boolean))];

            return [
                {
                    key: 'category',
                    label: 'Category',
                    type: 'multiselect',
                    options: categories,
                },
                {
                    key: 'vendor',
                    label: 'Vendor',
                    type: 'multiselect',
                    options: vendors,
                },
                {
                    key: 'tags',
                    label: 'Tags',
                    type: 'multiselect',
                    options: allTags,
                },
                {
                    key: 'product_type',
                    label: 'Type',
                    type: 'multiselect',
                    options: productTypes,
                },
            ];
        } else if (selectedContentType === 'collections') {
            // Extract unique values from collections data
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
                {
                    key: 'collection_type',
                    label: 'Collection Type',
                    type: 'multiselect',
                    options: collectionTypes,
                },
                {
                    key: 'products_count',
                    label: 'Product Count',
                    type: 'multiselect',
                    options: ['0-10', '11-50', '51-100', '100+'],
                },
                {
                    key: 'tags',
                    label: 'Tags',
                    type: 'multiselect',
                    options: allCollectionTags,
                },
                {
                    key: 'published_status',
                    label: 'Published Status',
                    type: 'multiselect',
                    options: ['published', 'unpublished'],
                },
            ];
        } else if (selectedContentType === 'pages') {
            return [
                {
                    key: 'published_status',
                    label: 'Published Status',
                    type: 'multiselect',
                    options: ['published', 'unpublished'],
                },
                {
                    key: 'template_suffix',
                    label: 'Template',
                    type: 'multiselect',
                    options: [...new Set(pages.map((p) => p.template_suffix).filter(Boolean))],
                },
            ];
        } else if (selectedContentType === 'blogs') {
            return [
                {
                    key: 'commentable',
                    label: 'Comments',
                    type: 'multiselect',
                    options: ['enabled', 'disabled'],
                },
                {
                    key: 'published_status',
                    label: 'Published Status',
                    type: 'multiselect',
                    options: ['published', 'unpublished'],
                },
            ];
        } else if (selectedContentType === 'themes') {
            return [
                {
                    key: 'role',
                    label: 'Role',
                    type: 'multiselect',
                    options: ['main', 'unpublished', 'demo'],
                },
            ];
        }

        return [];
    }, [selectedContentType, products, collections, pages, blogs]);

    const searchOptions = [
        { label: 'Title', value: 'title' },
        { label: 'Vendor', value: 'vendor' },
        { label: 'ID', value: 'id' },
    ];

    // Get data for current content type
    const getCurrentData = () => {
        switch (selectedContentType) {
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
            default:
                return [];
        }
    };

    // Client-side filtering function
    const getFilteredData = () => {
        let data = getCurrentData();

        // Apply search
        if (searchQuery) {
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
                        // For other filters like category, vendor
                        return filter.selectedOptions.includes(item[filter.key]);
                    }
                });
            }
        });

        return data;
    };

    // Get paginated data
    const getPaginatedData = () => {
        const filteredData = getFilteredData();
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filteredData.slice(startIndex, endIndex);
    };

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, searchBy, activeFilters, selectedContentType]);

    // Reset filters when content type changes
    useEffect(() => {
        setActiveFilters([]);
        setSearchQuery('');
        setFilterSearchQueries({});
        // Automatically open dropdowns for newly added filters
        if (availableFilters.length > 0) {
            const newDropdownActive = {};
            availableFilters.forEach((filter) => {
                if (!activeFilters.some((f) => f.key === filter.key)) {
                    newDropdownActive[filter.key] = true;
                }
            });
            setFilterDropdownActive(newDropdownActive);
        }
    }, [selectedContentType, availableFilters]);

    // Automatically open dropdowns for new filters
    useEffect(() => {
        const newDropdownActive = { ...filterDropdownActive };
        let hasChanges = false;

        availableFilters.forEach((filter) => {
            const isActive = activeFilters.some((f) => f.key === filter.key);
            if (isActive && !filterDropdownActive[filter.key]) {
                newDropdownActive[filter.key] = true;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setFilterDropdownActive(newDropdownActive);
        }
    }, [activeFilters, availableFilters]);

    // Calculate totals
    const filteredData = getFilteredData();
    const paginatedData = getPaginatedData();
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    // Add a new filter
    const handleAddFilter = (filterKey) => {
        const filter = availableFilters.find((f) => f.key === filterKey);
        if (filter && !activeFilters.some((f) => f.key === filterKey)) {
            setActiveFilters([...activeFilters, { ...filter, selectedOptions: [] }]);
            // Automatically open the dropdown for the new filter
            setFilterDropdownActive((prev) => ({ ...prev, [filterKey]: true }));
        }
        setFilterPopoverActive(false);
    };

    // Toggle filter option selection
    const toggleFilterOption = (filterKey, option) => {
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
    };

    // Remove a filter
    const handleRemoveFilter = (filterKey) => {
        setActiveFilters((prev) => prev.filter((f) => f.key !== filterKey));
        setFilterDropdownActive((prev) => ({ ...prev, [filterKey]: false }));
    };

    // Clear all filters
    const handleClearAllFilters = () => {
        setActiveFilters([]);
        setFilterDropdownActive({});
        setSearchQuery('');
        setSearchBy('title');
        setFilterSearchQueries({});
    };

    // Update filter search query
    const updateFilterSearchQuery = (filterKey, query) => {
        setFilterSearchQueries((prev) => ({
            ...prev,
            [filterKey]: query,
        }));
    };

    // Get filtered options for a filter
    const getFilteredOptions = (filter) => {
        const searchQuery = filterSearchQueries[filter.key] || '';
        if (!searchQuery) return filter.options || [];

        return (filter.options || []).filter((option) => option.toString().toLowerCase().includes(searchQuery.toLowerCase()));
    };

    const handleSubmit = useCallback(async () => {
        if (!name) {
            setError('Lock name is required');
            return;
        }
        if (selectedItems.length === 0) {
            setError('Please select at least one item to lock');
            return;
        }
        setError('');

        // Map selected ID strings back to full objects to get handles
        const payloadItems = selectedItems
            .map((selId) => {
                const [type, id] = selId.split('-');
                const dataMap = {
                    products: products,
                    collections: collections,
                    pages: pages,
                    blogs: blogs,
                    themes: themes,
                };
                const list = dataMap[type] || [];

                // Find the item by its shopify_X_id
                const item = list.find((item) => {
                    // Get the correct ID field based on type
                    let itemId;
                    switch (type) {
                        case 'products':
                            itemId = item.shopify_product_id;
                            break;
                        case 'collections':
                            itemId = item.shopify_collection_id;
                            break;
                        case 'pages':
                            itemId = item.shopify_page_id;
                            break;
                        case 'blogs':
                            itemId = item.shopify_blog_id;
                            break;
                        case 'themes':
                            itemId = item.shopify_theme_id;
                            break;
                        default:
                            itemId = item.id;
                    }
                    return itemId && `${type}-${itemId}` === selId;
                });

                if (!item) {
                    return null;
                }

                // Map plural type to singular resource_type expected by backend
                const resourceTypeMap = {
                    products: 'product',
                    collections: 'collection',
                    pages: 'page',
                    blogs: 'blog',
                    themes: 'theme',
                };

                return {
                    handle: item.handle || (type === 'themes' ? item.shopify_theme_id : ''),
                    resource_type: resourceTypeMap[type] || type, // Fallback to type if not in map
                    title: item.title || item.name || '',
                    // Include the original ID for debugging
                    original_id: item.id,
                };
            })
            .filter((i) => i && i.handle); // Filter out null items and items without handle

        if (payloadItems.length === 0) {
            setError('Could not find valid handles for selected items');
            return;
        }

        try {
            // Navigate to Lockmethod for configuration
            router.post('/lock/new-configure', {
                name,
                description,
                status,
                applyToHomepage,
                hidePrice,
                priceMessage,
                selectedItems: payloadItems,
            });
        } catch (error) {
            setError(error.message || 'Error proceeding to configuration');
        }
    }, [name, description, status, applyToHomepage, selectedItems, rules, products, collections, pages, blogs]);
    // Enhanced filter type dropdown
    const renderFilterTypeDropdown = () => {
        const availableFilterKeys = availableFilters
            .filter((filter) => !activeFilters.some((f) => f.key === filter.key))
            .map((filter) => ({
                content: (
                    <InlineStack>
                        <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="medium">
                                {filter.label}
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                                {filter.type === 'multiselect' ? 'Multiple select' : 'Single select'}
                            </Text>
                        </BlockStack>
                    </InlineStack>
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
                <div style={{ minWidth: '200px' }}>
                    {availableFilterKeys.length > 0 ? (
                        <>
                            <div style={{ padding: '12px 16px' }}>
                                <Text variant="bodySm" fontWeight="medium" tone="subdued">
                                    Available Filters
                                </Text>
                            </div>
                            <Divider />
                            <ActionList items={availableFilterKeys} actionRole="menuitem" />
                        </>
                    ) : (
                        <div
                            style={{
                                padding: '32px 16px',
                                textAlign: 'center',
                            }}
                        >
                            <div
                                style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '24px',
                                    backgroundColor: '#f1f2f3',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 16px',
                                }}
                            >
                                <Icon source={FilterIcon} tone="subdued" />
                            </div>
                            <Text variant="bodyMd" fontWeight="medium" tone="subdued">
                                No filters available for {selectedContentType}
                            </Text>
                        </div>
                    )}
                </div>
            </Popover>
        );
    };

    // Filter tag component
    const renderFilterTag = (filter) => {
        const isDropdownActive = filterDropdownActive[filter.key] || false;
        const selectedCount = filter.selectedOptions?.length || 0;
        const filteredOptions = getFilteredOptions(filter);
        const searchQuery = filterSearchQueries[filter.key] || '';

        return (
            <Popover
                active={isDropdownActive}
                activator={
                    <div
                        style={{
                            display: 'inline-block',
                            cursor: 'pointer',
                        }}
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
                                    <div
                                        style={{
                                            backgroundColor: '#5C6AC4',
                                            color: 'white',
                                            borderRadius: '10px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            padding: '1px 6px',
                                            minWidth: '18px',
                                            height: '18px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        {selectedCount}
                                    </div>
                                )}
                                <div style={{ opacity: 0.5 }}>
                                    <Icon source={isDropdownActive ? ChevronUpIcon : ChevronDownIcon} size="small" />
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
                <div style={{ padding: '12px', minWidth: '260px', maxWidth: '320px' }}>
                    <InlineStack gap="300" align="center" blockAlign="center">
                        <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="semibold">
                                {filter.label}
                            </Text>
                            <Text variant="bodySm" tone="subdued">
                                Select options
                            </Text>
                        </BlockStack>
                    </InlineStack>

                    {/* Search bar for filter options */}
                    <div style={{ marginTop: '12px' }}>
                        <TextField
                            prefix={<Icon source={SearchIcon} />}
                            value={searchQuery}
                            onChange={(value) => updateFilterSearchQuery(filter.key, value)}
                            label={`Search ${filter.label}`}
                            labelHidden
                            placeholder={`Search ${filter.label}...`}
                            autoComplete="off"
                            clearButton
                            onClearButtonClick={() => updateFilterSearchQuery(filter.key, '')}
                        />
                    </div>

                    <div style={{ marginTop: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                        {filteredOptions.length > 0 ? (
                            <BlockStack gap="200">
                                {filteredOptions.map((option) => {
                                    const isSelected = filter.selectedOptions?.includes(option);
                                    return (
                                        <div
                                            key={option}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: '6px',
                                                backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                            }}
                                            onClick={() => toggleFilterOption(filter.key, option)}
                                        >
                                            <Checkbox checked={isSelected} onChange={() => { }} label="" />
                                            <Text variant="bodyMd">{option}</Text>
                                        </div>
                                    );
                                })}
                            </BlockStack>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '20px' }}>
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

    // Handle content type selection - opens modal
    const handleContentTypeSelect = useCallback((value) => {
        if (value === 'price_hide') {
            setLockType('price_hide');
            setSelectedContentType('products');
        } else {
            setLockType('standard');
            setSelectedContentType(value);
        }
        setSelectionModalActive(true); // Open modal when content type is selected
    }, []);

    if (lockType === 'price_hide' && !selectionModalActive && selectedItems.length > 0) {
        return <HidePriceRule selectedItems={selectedItems} />;
    }

    return (
        <Page
            title="Create New Lock"
            subtitle="Add a new lock to control access to your content."
            backAction={{ content: 'Back', onAction: () => router.visit('/') }}
            primaryAction={{
                content: 'Next',
                onAction: handleSubmit,
                primary: true,
            }}
        >
            <Layout>
                {error && (
                    <Layout.Section>
                        <Banner status="critical">
                            <p>{error}</p>
                        </Banner>
                    </Layout.Section>
                )}

                {/* Main Content Area */}
                <Layout.Section>
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
                                        value={name}
                                        onChange={setName}
                                        // error={!name && 'Lock name is required'}
                                        autoComplete="off"
                                        required
                                        label="Lock name"
                                        labelHidden
                                        placeholder="Enter lock name"
                                    />
                                </BlockStack>
                            </Card>

                            {/* Description Section */}
                            <Card>
                                <BlockStack gap="400">
                                    <Text variant="headingSm" as="h3">
                                        Description
                                    </Text>
                                    <TextField
                                        label="Description"
                                        value={description}
                                        onChange={setDescription}
                                        multiline={4}
                                        autoComplete="off"
                                        labelHidden
                                        placeholder="Describe what this lock will protect and its purpose"
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
                                        {selectedItems.length > 0 && <Badge tone="success">{selectedItems.length} selected</Badge>}
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
                                                                    selectedContentType
                                                                        ? contentTypeIcons[selectedContentType] || ProductIcon
                                                                        : ProductIcon
                                                                }
                                                            />
                                                            <span>
                                                                {selectedContentType
                                                                    ? contentTypes.find((c) => c.value === selectedContentType)?.label
                                                                    : 'Select Content Type'}
                                                            </span>
                                                        </InlineStack>
                                                    </Button>
                                                }
                                                onClose={() => setContentTypePopoverActive(false)}
                                                preferredAlignment="left"
                                            >
                                                <div style={{ minWidth: '250px' }}>
                                                    <ActionList
                                                        items={contentTypes.map((type) => ({
                                                            content: type.label,
                                                            icon: type.icon,
                                                            onAction: () => {
                                                                handleContentTypeSelect(type.value); // This will open modal
                                                                setContentTypePopoverActive(false);
                                                            },
                                                        }))}
                                                    />
                                                </div>
                                            </Popover>
                                        </Box>
                                    </div>

                                    {/* Selected Items Preview */}
                                    {selectedItems.length > 0 ? (
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
                                                            onClick={() => setSelectedItems([])}
                                                            plain
                                                            destructive
                                                            icon={XIcon}
                                                            size="slim"
                                                            accessibilityLabel="Clear all selected items"
                                                        >
                                                            Clear all
                                                        </Button>
                                                    </InlineStack>
                                                </InlineStack>

                                                <BlockStack gap="200">
                                                    {selectedItems.slice(0, 3).map((selId) => {
                                                        const [type, id] = selId.split('-');
                                                        const data =
                                                            type === 'products'
                                                                ? products
                                                                : type === 'collections'
                                                                    ? collections
                                                                    : type === 'pages'
                                                                        ? pages
                                                                        : type === 'themes'
                                                                            ? themes
                                                                            : blogs;
                                                        const item = data.find((item) => {
                                                            const itemId =
                                                                type === 'products'
                                                                    ? item.shopify_product_id
                                                                    : type === 'collections'
                                                                        ? item.shopify_collection_id
                                                                        : type === 'pages'
                                                                            ? item.shopify_page_id
                                                                            : type === 'themes'
                                                                                ? item.shopify_theme_id
                                                                                : item.shopify_blog_id;
                                                            return `${type}-${itemId}` === selId;
                                                        });

                                                        if (!item) return null;

                                                        return (
                                                            <div
                                                                key={selId}
                                                                style={{
                                                                    padding: '8px 12px',
                                                                    backgroundColor: '#fafbfb',
                                                                    border: '1px solid #e1e3e5',
                                                                    borderRadius: '6px',
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                }}
                                                            >
                                                                <InlineStack align="center" gap="300">
                                                                    {type === 'products' && item.image_url ? (
                                                                        <div
                                                                            style={{
                                                                                width: '40px',
                                                                                height: '40px',
                                                                                borderRadius: '4px',
                                                                                overflow: 'hidden',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                backgroundColor: '#f1f2f3',
                                                                            }}
                                                                        >
                                                                            <Image
                                                                                source={item.image_url}
                                                                                alt={item.title || item.name}
                                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                            />
                                                                        </div>
                                                                    ) : (
                                                                        <div
                                                                            style={{
                                                                                width: '40px',
                                                                                height: '40px',
                                                                                borderRadius: '4px',
                                                                                backgroundColor: '#e3f2fd',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                            }}
                                                                        >
                                                                            <Icon source={contentTypeIcons[type]} tone="success" />
                                                                        </div>
                                                                    )}
                                                                    <BlockStack gap="50">
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
                                                                    onClick={() => setSelectedItems(selectedItems.filter((s) => s !== selId))}
                                                                    plain
                                                                    destructive
                                                                    icon={XIcon}
                                                                    size="slim"
                                                                    accessibilityLabel={`Remove ${item.title || item.name}`}
                                                                />
                                                            </div>
                                                        );
                                                    })}

                                                    {selectedItems.length > 3 && (
                                                        <Box paddingBlockStart="100">
                                                            <Text variant="bodySm" tone="subdued" alignment="center">
                                                                + {selectedItems.length - 3} more items
                                                            </Text>
                                                        </Box>
                                                    )}
                                                </BlockStack>

                                                {/* ADDED: Next Button when items are selected */}
                                                {/* <Box paddingBlockStart="300">
                                                    <InlineStack align="end">
                                                        <Button onClick={() => alert('Proceeding to next step...')} variant="primary">
                                                            Next
                                                        </Button>
                                                    </InlineStack>
                                                </Box> */}
                                            </BlockStack>
                                        </Card>
                                    ) : (
                                        ''
                                    )}
                                </BlockStack>
                            </Card>
                        </BlockStack>

                        {/* Right Column */}
                        <BlockStack gap="400">
                            <Card>
                                <BlockStack gap="300">
                                    <Text variant="headingSm" as="h3">
                                        Status
                                    </Text>
                                    <Select
                                        label="Status"
                                        options={[
                                            { label: 'Active', value: 'Active' },
                                            { label: 'Inactive', value: 'Inactive' },
                                        ]}
                                        value={status}
                                        onChange={setStatus}
                                        labelHidden
                                    />
                                </BlockStack>
                            </Card>

                            {/* <Card>
                                <BlockStack gap="300">
                                    <Text variant="headingSm" as="h3">
                                        Settings
                                    </Text>
                                    <Checkbox
                                        label="Apply to homepage and featured sections"
                                        checked={applyToHomepage}
                                        onChange={setApplyToHomepage}
                                    />

                                    {selectedContentType === 'products' && (
                                        <>
                                            <Checkbox
                                                label="Hide Price"
                                                checked={hidePrice}
                                                onChange={setHidePrice}
                                                helpText="Hide product price and Add to Cart button for locked items."
                                            />
                                            {hidePrice && (
                                                <TextField
                                                    label="Price Hidden Message"
                                                    value={priceMessage}
                                                    onChange={setPriceMessage}
                                                    placeholder="Sign in to see price"
                                                    autoComplete="off"
                                                />
                                            )}
                                        </>
                                    )}
                                </BlockStack>
                            </Card> */}
                        </BlockStack>
                    </InlineGrid>
                </Layout.Section>
            </Layout>

            {/* Content Selection Modal */}
            <Modal
                open={selectionModalActive}
                onClose={() => setSelectionModalActive(false)}
                title={`Select ${selectedContentType}`}
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
                    <div style={{ padding: '16px 0' }}>
                        {/* Search and Filters */}
                        <InlineStack gap="300" blockAlign="center">
                            <div style={{ flex: 1 }}>
                                <TextField
                                    label={`Search ${selectedContentType}`}
                                    labelHidden
                                    prefix={<Icon source={SearchIcon} />}
                                    value={searchQuery}
                                    onChange={setSearchQuery}
                                    placeholder={`Search ${selectedContentType}...`}
                                    autoComplete="off"
                                    clearButton
                                    onClearButtonClick={() => setSearchQuery('')}
                                />
                            </div>
                            <div style={{ width: '150px' }}>
                                <Select options={searchOptions} value={searchBy} onChange={setSearchBy} />
                            </div>
                        </InlineStack>

                        {/* Filters */}
                        <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                {renderFilterTypeDropdown()}
                                {activeFilters.map((filter) => (
                                    <React.Fragment key={filter.key}>{renderFilterTag(filter)}</React.Fragment>
                                ))}
                                {(activeFilters.length > 0 || searchQuery) && (
                                    <Button plain onClick={handleClearAllFilters} size="slim">
                                        Clear all
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Results Summary */}
                        <InlineStack align="center" blockAlign="center" justifyContent="spaceBetween">
                            <Text variant="bodySm" tone="subdued">
                                Showing {Math.min(filteredData.length, itemsPerPage)} of {filteredData.length} items
                                {filteredData.length !== getCurrentData().length && ` (filtered from ${getCurrentData().length} total)`}
                            </Text>
                            {paginatedData.length > 0 && (
                                <Button
                                    onClick={() => {
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

                                        const allSelected = allSelIds.length > 0 && allSelIds.every((selId) => selectedItems.includes(selId));

                                        if (allSelected) {
                                            setSelectedItems(selectedItems.filter((selId) => !allSelIds.includes(selId)));
                                        } else {
                                            const newSelected = [...new Set([...selectedItems, ...allSelIds])];
                                            setSelectedItems(newSelected);
                                        }
                                    }}
                                    size="slim"
                                >
                                    {(() => {
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
                                        const allSelected = allSelIds.length > 0 && allSelIds.every((selId) => selectedItems.includes(selId));
                                        return allSelected ? 'Deselect all' : 'Select all on page';
                                    })()}
                                </Button>
                            )}
                        </InlineStack>

                        {/* Data List */}
                        <div style={{ marginTop: '16px', minHeight: '400px' }}>
                            {paginatedData.length > 0 ? (
                                <>
                                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                        {paginatedData.map((item) => {
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
                                            const selId = `${selectedContentType}-${item[idField]}`;
                                            const isSelected = selectedItems.includes(selId);
                                            const IconComponent = contentTypeIcons[selectedContentType];

                                            return (
                                                <div
                                                    key={selId}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedItems(selectedItems.filter((s) => s !== selId));
                                                        } else {
                                                            setSelectedItems([...selectedItems, selId]);
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '12px 16px',
                                                        borderBottom: '1px solid #f1f2f3',
                                                        backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '12px',
                                                        transition: 'background-color 0.2s ease',
                                                    }}
                                                >
                                                    <Checkbox checked={isSelected} onChange={() => { }} label="" />
                                                    {selectedContentType === 'products' && item.image_url ? (
                                                        <div
                                                            style={{
                                                                width: '40px',
                                                                height: '40px',
                                                                borderRadius: '4px',
                                                                overflow: 'hidden',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                backgroundColor: '#f1f2f3',
                                                            }}
                                                        >
                                                            <Image
                                                                source={item.image_url}
                                                                alt={item.title || item.name}
                                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div
                                                            style={{
                                                                width: '40px',
                                                                height: '40px',
                                                                borderRadius: '4px',
                                                                backgroundColor: isSelected ? '#008060' : '#e1e3e5',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }}
                                                        >
                                                            <Icon source={IconComponent} tone={isSelected ? 'textInverse' : 'subdued'} />
                                                        </div>
                                                    )}
                                                    <div style={{ flex: 1 }}>
                                                        <Text variant="bodyMd" fontWeight="medium">
                                                            {item.title || item.name}
                                                        </Text>
                                                        <Text variant="bodySm" tone="subdued">
                                                            {selectedContentType === 'products' && item.vendor && `Vendor: ${item.vendor}`}
                                                            {selectedContentType === 'collections' &&
                                                                item.products_count &&
                                                                `Products: ${item.products_count}`}
                                                            {selectedContentType === 'products' && item.category && `Category: ${item.category}`}
                                                            {selectedContentType === 'products' && item.product_type && `Type: ${item.product_type}`}
                                                            {selectedContentType === 'collections' &&
                                                                item.collection_type &&
                                                                `Type: ${item.collection_type}`}
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
                                <div style={{ textAlign: 'center', padding: '40px' }}>
                                    <Icon source={SearchIcon} tone="subdued" />
                                    <Text variant="bodyMd" tone="subdued">
                                        {filteredData.length === 0 ? 'No items found' : 'No items on this page'}
                                    </Text>
                                </div>
                            )}
                        </div>

                        {/* Selected Items Summary */}
                        {selectedItems.length > 0 && (
                            <Box padding="400" background="bg-surface-success" borderRadius="200">
                                <BlockStack gap="300">
                                    <InlineStack align="spaceBetween" blockAlign="center">
                                        <InlineStack align="center" gap="200">
                                            <Icon source={CollectionIcon} tone="success" />
                                            <Text variant="bodyMd" fontWeight="medium" tone="success">
                                                {selectedItems.length} item(s) selected
                                            </Text>
                                        </InlineStack>
                                        <Button onClick={() => setSelectedItems([])} plain destructive size="slim">
                                            Clear all
                                        </Button>
                                    </InlineStack>
                                    <Button
                                        onClick={() => {
                                            setSelectionModalActive(false);
                                        }}
                                        variant="primary"
                                        size="slim"
                                        fullWidth
                                    >
                                        Add Selected Items
                                    </Button>
                                </BlockStack>
                            </Box>
                        )}
                    </div>
                </Modal.Section>
            </Modal>
        </Page>
    );
};

export default AddLock;
