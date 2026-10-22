import React, { useState, useCallback, useMemo } from 'react';
import {
  Page,
  Card,
  IndexTable,
  Badge,
  TextField,
  Button,
  Modal,
  EmptySearchResult,
  Pagination,
  Text,
  InlineStack,
  BlockStack,
  useIndexResourceState,
  Tooltip,
  Box,
  Popover,
  ActionList,
  InlineGrid,
  IndexFilters,
  useSetIndexFiltersMode,
  ChoiceList,
  useBreakpoints,
  LegacyCard,
  Icon,
} from '@shopify/polaris';
import {
  CheckCircleIcon,
  XCircleIcon,
  DeleteIcon,
  AlertTriangleIcon,
  ChartVerticalIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@shopify/polaris-icons';

// ============================================
// STATIC DATA
// ============================================
const INITIAL_DATA = [
  { id: '1', widgetName: 'Header Navigation Widget', status: 'Approved' },
  { id: '2', widgetName: 'Footer Links Widget', status: 'Disapproved' },
  { id: '3', widgetName: 'Sidebar Menu Widget', status: 'Approved' },
  { id: '4', widgetName: 'Mobile Navigation Widget', status: 'Approved' },
  { id: '5', widgetName: 'Hero Banner Widget', status: 'Disapproved' },
  { id: '6', widgetName: 'Product Carousel Widget', status: 'Approved' },
  { id: '7', widgetName: 'Customer Testimonials Widget', status: 'Disapproved' },
  { id: '8', widgetName: 'Contact Form Widget', status: 'Approved' },
  { id: '9', widgetName: 'Newsletter Signup Widget', status: 'Approved' },
  { id: '10', widgetName: 'Social Media Links Widget', status: 'Disapproved' },
  { id: '11', widgetName: 'Product Grid Widget', status: 'Approved' },
  { id: '12', widgetName: 'Search Bar Widget', status: 'Approved' },
  { id: '13', widgetName: 'Breadcrumb Widget', status: 'Disapproved' },
  { id: '14', widgetName: 'FAQ Accordion Widget', status: 'Approved' },
  { id: '15', widgetName: 'Image Gallery Widget', status: 'Approved' },
  { id: '16', widgetName: 'Video Player Widget', status: 'Disapproved' },
  { id: '17', widgetName: 'Countdown Timer Widget', status: 'Approved' },
  { id: '18', widgetName: 'Price Comparison Widget', status: 'Approved' },
  { id: '19', widgetName: 'Wishlist Widget', status: 'Disapproved' },
  { id: '20', widgetName: 'Recently Viewed Widget', status: 'Approved' },
];

// ============================================
// CONSTANTS
// ============================================
const ITEMS_PER_PAGE = 5;

const RESOURCE_NAME = {
  singular: 'request code',
  plural: 'request codes',
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function isEmpty(value) {
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return value === '' || value == null;
}

function disambiguateLabel(key, value) {
  switch (key) {
    case 'status':
      return `Status: ${value.join(', ')}`;
    case 'widgetName':
      return `Widget name contains: ${value}`;
    default:
      return value;
  }
}

// ============================================
// STATS CARD COMPONENT - FIXED GAP ISSUE
// ============================================
function StatsCard({ title, count, icon, iconBgColor, iconColor, percentage, trend }) {
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <Text as="span" variant="bodySm" tone="subdued">
              {title}
            </Text>
            <Text as="span" variant="headingLg" fontWeight="bold">
              {count}
            </Text>
          </BlockStack>
          <div
            style={{
              padding: '10px',
              borderRadius: '50%',
              backgroundColor: iconBgColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon source={icon} tone={iconColor} />
          </div>
        </InlineStack>
        {percentage !== undefined && (
          <InlineStack blockAlign="center" wrap={false}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {trend === 'up' ? (
                <Icon source={ArrowUpIcon} tone="success" />
              ) : trend === 'down' ? (
                <Icon source={ArrowDownIcon} tone="critical" />
              ) : null}
              <Text
                as="span"
                variant="bodySm"
                tone={trend === 'up' ? 'success' : trend === 'down' ? 'critical' : 'subdued'}
              >
                {percentage}% of total
              </Text>
            </div>
          </InlineStack>
        )}
      </BlockStack>
    </Card>
  );
}

// ============================================
// STATUS DROPDOWN COMPONENT
// ============================================
function StatusDropdown({ item, onStatusChange }) {
  const [popoverActive, setPopoverActive] = useState(false);

  const togglePopover = useCallback(() => {
    setPopoverActive((prev) => !prev);
  }, []);

  const closePopover = useCallback(() => {
    setPopoverActive(false);
  }, []);

  const handleStatusSelect = useCallback(
    (newStatus) => {
      onStatusChange(item.id, newStatus);
      closePopover();
    },
    [item.id, onStatusChange, closePopover]
  );

  const activator = (
    <Button onClick={togglePopover} disclosure size="slim" variant="plain">
      <Badge tone={item.status === 'Approved' ? 'success' : 'critical'}>
        {item.status}
      </Badge>
    </Button>
  );

  return (
    <Popover
      active={popoverActive}
      activator={activator}
      autofocusTarget="first-node"
      onClose={closePopover}
      preferredAlignment="left"
    >
      <ActionList
        actionRole="menuitem"
        items={[
          {
            content: 'Approved',
            prefix: <Icon source={CheckCircleIcon} tone="success" />,
            onAction: () => handleStatusSelect('Approved'),
            active: item.status === 'Approved',
          },
          {
            content: 'Disapproved',
            prefix: <Icon source={XCircleIcon} tone="critical" />,
            onAction: () => handleStatusSelect('Disapproved'),
            active: item.status === 'Disapproved',
          },
        ]}
      />
    </Popover>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
function RequestCode() {
  // ----------------------------------------
  // BREAKPOINTS
  // ----------------------------------------
  const { smDown } = useBreakpoints();

  // ----------------------------------------
  // STATE MANAGEMENT
  // ----------------------------------------
  const [data, setData] = useState(INITIAL_DATA);
  const [currentPage, setCurrentPage] = useState(1);

  // IndexFilters state
  const [selected, setSelected] = useState(0);
  const [queryValue, setQueryValue] = useState('');
  const [sortSelected, setSortSelected] = useState(['widgetName asc']);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [widgetNameFilter, setWidgetNameFilter] = useState('');

  // Modal states
  const [deleteModalActive, setDeleteModalActive] = useState(false);
  const [bulkDeleteModalActive, setBulkDeleteModalActive] = useState(false);
  const [bulkStatusModalActive, setBulkStatusModalActive] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [bulkStatusTarget, setBulkStatusTarget] = useState(null);

  // IndexFilters mode
  const { mode, setMode } = useSetIndexFiltersMode();

  // ----------------------------------------
  // TABS CONFIGURATION
  // ----------------------------------------
  const tabs = [
    {
      content: 'All',
      index: 0,
      onAction: () => { },
      id: 'all-0',
      isLocked: true,
    },
    {
      content: 'Approved',
      index: 1,
      onAction: () => { },
      id: 'approved-1',
      isLocked: true,
    },
    {
      content: 'Disapproved',
      index: 2,
      onAction: () => { },
      id: 'disapproved-2',
      isLocked: true,
    },
  ];

  // ----------------------------------------
  // SORT OPTIONS
  // ----------------------------------------
  const sortOptions = [
    { label: 'Widget Name', value: 'widgetName asc', directionLabel: 'A-Z' },
    { label: 'Widget Name', value: 'widgetName desc', directionLabel: 'Z-A' },
    { label: 'Status', value: 'status asc', directionLabel: 'A-Z' },
    { label: 'Status', value: 'status desc', directionLabel: 'Z-A' },
  ];

  // ----------------------------------------
  // FILTERS CONFIGURATION
  // ----------------------------------------
  const handleStatusFilterChange = useCallback((value) => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const handleWidgetNameFilterChange = useCallback((value) => {
    setWidgetNameFilter(value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterRemove = useCallback(() => {
    setStatusFilter(undefined);
    setCurrentPage(1);
  }, []);

  const handleWidgetNameFilterRemove = useCallback(() => {
    setWidgetNameFilter('');
    setCurrentPage(1);
  }, []);

  const handleQueryValueChange = useCallback((value) => {
    setQueryValue(value);
    setCurrentPage(1);
  }, []);

  const handleQueryValueRemove = useCallback(() => {
    setQueryValue('');
    setCurrentPage(1);
  }, []);

  const handleFiltersClearAll = useCallback(() => {
    handleStatusFilterRemove();
    handleWidgetNameFilterRemove();
    handleQueryValueRemove();
  }, [handleStatusFilterRemove, handleWidgetNameFilterRemove, handleQueryValueRemove]);

  const filters = [
    {
      key: 'status',
      label: 'Status',
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={[
            { label: 'Approved', value: 'Approved' },
            { label: 'Disapproved', value: 'Disapproved' },
          ]}
          selected={statusFilter || []}
          onChange={handleStatusFilterChange}
          allowMultiple
        />
      ),
      shortcut: true,
    },
    {
      key: 'widgetName',
      label: 'Widget Name',
      filter: (
        <TextField
          label="Widget Name"
          value={widgetNameFilter}
          onChange={handleWidgetNameFilterChange}
          autoComplete="off"
          labelHidden
          placeholder="Search widget name..."
        />
      ),
      shortcut: true,
    },
  ];

  // Applied filters display
  const appliedFilters = [];
  if (statusFilter && !isEmpty(statusFilter)) {
    appliedFilters.push({
      key: 'status',
      label: disambiguateLabel('status', statusFilter),
      onRemove: handleStatusFilterRemove,
    });
  }
  if (!isEmpty(widgetNameFilter)) {
    appliedFilters.push({
      key: 'widgetName',
      label: disambiguateLabel('widgetName', widgetNameFilter),
      onRemove: handleWidgetNameFilterRemove,
    });
  }

  // ----------------------------------------
  // CANCEL ACTION HANDLER
  // ----------------------------------------
  const onHandleCancel = useCallback(() => {
    setQueryValue('');
    setStatusFilter(undefined);
    setWidgetNameFilter('');
  }, []);

  // ----------------------------------------
  // STATS CALCULATIONS
  // ----------------------------------------
  const stats = useMemo(() => {
    const total = data.length;
    const approved = data.filter((item) => item.status === 'Approved').length;
    const disapproved = data.filter((item) => item.status === 'Disapproved').length;
    const approvedPercentage = total > 0 ? Math.round((approved / total) * 100) : 0;
    const disapprovedPercentage = total > 0 ? Math.round((disapproved / total) * 100) : 0;

    return {
      total,
      approved,
      disapproved,
      approvedPercentage,
      disapprovedPercentage,
    };
  }, [data]);

  // ----------------------------------------
  // COMPUTED DATA - Filtering, Sorting, Pagination
  // ----------------------------------------
  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply tab filter
    if (selected === 1) {
      result = result.filter((item) => item.status === 'Approved');
    } else if (selected === 2) {
      result = result.filter((item) => item.status === 'Disapproved');
    }

    // Apply search query
    if (queryValue.trim()) {
      const query = queryValue.toLowerCase().trim();
      result = result.filter((item) =>
        item.widgetName.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter && statusFilter.length > 0) {
      result = result.filter((item) => statusFilter.includes(item.status));
    }

    // Apply widget name filter
    if (widgetNameFilter.trim()) {
      const filter = widgetNameFilter.toLowerCase().trim();
      result = result.filter((item) =>
        item.widgetName.toLowerCase().includes(filter)
      );
    }

    // Apply sorting
    const [sortKey, sortDirection] = sortSelected[0].split(' ');
    result.sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'widgetName') {
        comparison = a.widgetName.localeCompare(b.widgetName);
      } else if (sortKey === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [data, selected, queryValue, statusFilter, widgetNameFilter, sortSelected]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const totalItems = filteredData.length;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);

  const paginatedData = useMemo(() => {
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, startIndex]);

  // ----------------------------------------
  // BULK SELECTION HOOK
  // ----------------------------------------
  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(paginatedData);

  // ----------------------------------------
  // TAB SELECT HANDLER
  // ----------------------------------------
  const handleTabSelect = useCallback(
    (index) => {
      setSelected(index);
      setCurrentPage(1);
      clearSelection();
    },
    [clearSelection]
  );

  // ----------------------------------------
  // STATUS CHANGE HANDLERS
  // ----------------------------------------
  const handleSingleStatusChange = useCallback((itemId, newStatus) => {
    setData((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, status: newStatus } : item
      )
    );
  }, []);

  const handleBulkStatusClick = useCallback(
    (targetStatus) => {
      if (selectedResources.length > 0) {
        setBulkStatusTarget(targetStatus);
        setBulkStatusModalActive(true);
      }
    },
    [selectedResources.length]
  );

  const handleBulkStatusModalClose = useCallback(() => {
    setBulkStatusModalActive(false);
    setBulkStatusTarget(null);
  }, []);

  const handleConfirmBulkStatusChange = useCallback(() => {
    if (bulkStatusTarget) {
      setData((prev) =>
        prev.map((item) =>
          selectedResources.includes(item.id)
            ? { ...item, status: bulkStatusTarget }
            : item
        )
      );
      clearSelection();
    }
    handleBulkStatusModalClose();
  }, [bulkStatusTarget, selectedResources, clearSelection, handleBulkStatusModalClose]);

  // ----------------------------------------
  // PAGINATION HANDLERS
  // ----------------------------------------
  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
    clearSelection();
  }, [clearSelection]);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
    clearSelection();
  }, [totalPages, clearSelection]);

  // ----------------------------------------
  // DELETE HANDLERS
  // ----------------------------------------
  const handleDeleteClick = useCallback((item) => {
    setItemToDelete(item);
    setDeleteModalActive(true);
  }, []);

  const handleDeleteModalClose = useCallback(() => {
    setDeleteModalActive(false);
    setItemToDelete(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (itemToDelete) {
      setData((prev) => prev.filter((item) => item.id !== itemToDelete.id));
    }
    handleDeleteModalClose();
  }, [itemToDelete, handleDeleteModalClose]);

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedResources.length > 0) {
      setBulkDeleteModalActive(true);
    }
  }, [selectedResources.length]);

  const handleBulkDeleteModalClose = useCallback(() => {
    setBulkDeleteModalActive(false);
  }, []);

  const handleConfirmBulkDelete = useCallback(() => {
    setData((prev) =>
      prev.filter((item) => !selectedResources.includes(item.id))
    );
    clearSelection();
    handleBulkDeleteModalClose();

    const remainingItems = data.length - selectedResources.length;
    const newTotalPages = Math.ceil(remainingItems / ITEMS_PER_PAGE);
    if (currentPage > newTotalPages) {
      setCurrentPage(Math.max(1, newTotalPages));
    }
  }, [
    selectedResources,
    clearSelection,
    handleBulkDeleteModalClose,
    data.length,
    currentPage,
  ]);

  // ----------------------------------------
  // TABLE CONFIGURATION
  // ----------------------------------------
  const headings = [
    { title: 'Widget Name' },
    { title: 'Status' },
    { title: 'Action', alignment: 'end' },
  ];

  // Promoted bulk actions - Approve and Disapprove shown directly
  const promotedBulkActions = [
    {
      icon: CheckCircleIcon,
      content: 'Approve',
      onAction: () => handleBulkStatusClick('Approved'),
    },
    {
      icon: XCircleIcon,
      content: 'Disapprove',
      onAction: () => handleBulkStatusClick('Disapproved'),
    },
  ];

  // Bulk actions - Delete shown in three-dot menu
  const bulkActions = [
    {
      icon: DeleteIcon,
      content: 'Delete',
      onAction: handleBulkDeleteClick,
      destructive: true,
    },
  ];

  // ----------------------------------------
  // ROW RENDERING - Only Delete icon in actions
  // ----------------------------------------
  const rowMarkup = paginatedData.map((item, index) => {
    const { id, widgetName } = item;
    const isSelected = selectedResources.includes(id);

    return (
      <IndexTable.Row id={id} key={id} selected={isSelected} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="medium" as="span">
            {widgetName}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <StatusDropdown
            item={item}
            onStatusChange={handleSingleStatusChange}
          />
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack align="end">
            <Tooltip content="Delete" dismissOnMouseOut>
              <Button
                icon={DeleteIcon}
                variant="tertiary"
                tone="critical"
                onClick={() => handleDeleteClick(item)}
                accessibilityLabel={`Delete ${widgetName}`}
              />
            </Tooltip>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  // ----------------------------------------
  // EMPTY STATE
  // ----------------------------------------
  const emptyStateMarkup = (
    <EmptySearchResult
      title="No request codes found"
      description="Try changing the filters or search term"
      withIllustration
    />
  );

  // ----------------------------------------
  // RENDER
  // ----------------------------------------
  return (
    <Page
      title="Request Codes"
      subtitle="Manage and monitor your widget request codes"
    >
      <BlockStack gap="500">
        {/* ====== STATS CARDS SECTION ====== */}
        <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
          <StatsCard
            title="Total Requests"
            count={stats.total}
            icon={ChartVerticalIcon}
            iconBgColor="#e3f1fc"
            iconColor="info"
          />
          <StatsCard
            title="Approved"
            count={stats.approved}
            icon={CheckCircleIcon}
            iconBgColor="#d4edda"
            iconColor="success"
            percentage={stats.approvedPercentage}
            trend="up"
          />
          <StatsCard
            title="Disapproved"
            count={stats.disapproved}
            icon={XCircleIcon}
            iconBgColor="#f8d7da"
            iconColor="critical"
            percentage={stats.disapprovedPercentage}
            trend="down"
          />
        </InlineGrid>

        {/* ====== MAIN TABLE CARD WITH INDEX FILTERS ====== */}
        <LegacyCard>
          <IndexFilters
            sortOptions={sortOptions}
            sortSelected={sortSelected}
            queryValue={queryValue}
            queryPlaceholder="Search request codes..."
            onQueryChange={handleQueryValueChange}
            onQueryClear={handleQueryValueRemove}
            onSort={setSortSelected}
            cancelAction={{
              onAction: onHandleCancel,
              disabled: false,
              loading: false,
            }}
            tabs={tabs}
            selected={selected}
            onSelect={handleTabSelect}
            canCreateNewView={false}
            filters={filters}
            appliedFilters={appliedFilters}
            onClearAll={handleFiltersClearAll}
            mode={mode}
            setMode={setMode}
          />

          {/* ====== INDEX TABLE ====== */}
          {paginatedData.length === 0 ? (
            <Box padding="600">{emptyStateMarkup}</Box>
          ) : (
            <IndexTable
              condensed={smDown}
              resourceName={RESOURCE_NAME}
              itemCount={paginatedData.length}
              selectedItemsCount={
                allResourcesSelected ? 'All' : selectedResources.length
              }
              onSelectionChange={handleSelectionChange}
              headings={headings}
              promotedBulkActions={promotedBulkActions}
              bulkActions={bulkActions}
              lastColumnSticky
            >
              {rowMarkup}
            </IndexTable>
          )}

          {/* ====== PAGINATION SECTION ====== */}
          {filteredData.length > 0 && (
            <Box
              padding="300"
              borderBlockStartWidth="025"
              borderColor="border"
            >
              <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="bodySm" tone="subdued">
                  {startIndex + 1}–{endIndex} of {totalItems}
                </Text>
                <InlineStack gap="300" blockAlign="center">
                  <Text as="span" variant="bodySm" tone="subdued">
                    Page {currentPage} of {totalPages || 1}
                  </Text>
                  <Pagination
                    hasPrevious={currentPage > 1}
                    onPrevious={handlePreviousPage}
                    hasNext={currentPage < totalPages}
                    onNext={handleNextPage}
                  />
                </InlineStack>
              </InlineStack>
            </Box>
          )}
        </LegacyCard>
      </BlockStack>

      {/* ====== SINGLE DELETE MODAL ====== */}
      <Modal
        open={deleteModalActive}
        onClose={handleDeleteModalClose}
        title="Delete Request Code"
        primaryAction={{
          content: 'Delete',
          destructive: true,
          onAction: handleConfirmDelete,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: handleDeleteModalClose,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <InlineStack gap="300" blockAlign="start" wrap={false}>
              <div
                style={{
                  padding: '8px',
                  backgroundColor: '#fef2f2',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon source={AlertTriangleIcon} tone="critical" />
              </div>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd">
                  Are you sure you want to delete this request code?
                </Text>
                <Text as="p" variant="bodyMd" fontWeight="bold">
                  {itemToDelete?.widgetName}
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  This action cannot be undone.
                </Text>
              </BlockStack>
            </InlineStack>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* ====== BULK DELETE MODAL ====== */}
      <Modal
        open={bulkDeleteModalActive}
        onClose={handleBulkDeleteModalClose}
        title="Delete Selected Request Codes"
        primaryAction={{
          content: `Delete ${selectedResources.length} item${selectedResources.length !== 1 ? 's' : ''
            }`,
          destructive: true,
          onAction: handleConfirmBulkDelete,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: handleBulkDeleteModalClose,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <InlineStack gap="300" blockAlign="start" wrap={false}>
              <div
                style={{
                  padding: '8px',
                  backgroundColor: '#fef2f2',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon source={AlertTriangleIcon} tone="critical" />
              </div>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd">
                  Delete{' '}
                  <Text as="span" fontWeight="bold">
                    {selectedResources.length}
                  </Text>{' '}
                  selected item{selectedResources.length !== 1 ? 's' : ''}?
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  This action cannot be undone.
                </Text>
              </BlockStack>
            </InlineStack>
          </BlockStack>
        </Modal.Section>
      </Modal>

      {/* ====== BULK STATUS CHANGE MODAL ====== */}
      <Modal
        open={bulkStatusModalActive}
        onClose={handleBulkStatusModalClose}
        title={`${bulkStatusTarget === 'Approved' ? 'Approve' : 'Disapprove'
          } Selected Items`}
        primaryAction={{
          content: `${bulkStatusTarget === 'Approved' ? 'Approve' : 'Disapprove'
            } ${selectedResources.length} item${selectedResources.length !== 1 ? 's' : ''
            }`,
          onAction: handleConfirmBulkStatusChange,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: handleBulkStatusModalClose,
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <InlineStack gap="300" blockAlign="start" wrap={false}>
              <div
                style={{
                  padding: '8px',
                  backgroundColor:
                    bulkStatusTarget === 'Approved' ? '#d4edda' : '#fef2f2',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {bulkStatusTarget === 'Approved' ? (
                  <Icon source={CheckCircleIcon} tone="success" />
                ) : (
                  <Icon source={XCircleIcon} tone="critical" />
                )}
              </div>
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd">
                  Change status of{' '}
                  <Text as="span" fontWeight="bold">
                    {selectedResources.length}
                  </Text>{' '}
                  item{selectedResources.length !== 1 ? 's' : ''} to{' '}
                  <Badge
                    tone={
                      bulkStatusTarget === 'Approved' ? 'success' : 'critical'
                    }
                  >
                    {bulkStatusTarget}
                  </Badge>
                  ?
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {bulkStatusTarget === 'Approved'
                    ? 'Items will be marked as approved and become active.'
                    : 'Items will be marked as disapproved and become inactive.'}
                </Text>
              </BlockStack>
            </InlineStack>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

export default RequestCode;