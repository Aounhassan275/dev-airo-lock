import { router, usePage } from '@inertiajs/react';
import { SaveBar, useAppBridge } from '@shopify/app-bridge-react';
import {
    ActionList,
    Autocomplete,
    Badge,
    Banner,
    BlockStack,
    Box,
    Button,
    Card,
    Checkbox,
    Collapsible,
    Divider,
    FormLayout,
    Frame,
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
    Spinner,
    Tag,
    Text,
    TextField,
} from '@shopify/polaris';
import {
    BlogIcon,
    CalendarIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    ClockIcon,
    CodeIcon,
    CollectionIcon,
    DesktopIcon,
    DuplicateIcon,
    EmailIcon,
    FilterIcon,
    GlobeIcon,
    HashtagIcon,
    InfoIcon,
    KeyIcon,
    LinkIcon,
    PageIcon,
    PersonIcon,
    ProductIcon,
    SearchIcon,
    StoreIcon,
    XIcon,
    RefreshIcon,
} from '@shopify/polaris-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import KnobToggle from '../../components/KnobToggle';
import { goToPricing, optionSuffix, PlanBadge, usePlanGate } from '../../components/locks/planGate';
import { itemListsByType, storeItem } from '../../lib/lockItems';
import CredentialPairField from '../../components/locks/CredentialPairField';
import CreateWidgetButton from '../../components/locks/CreateWidgetButton';
import PopupTextModal from '../../components/locks/PopupTextModal';
import PasscodeListField from '../../components/locks/PasscodeListField';

// ===== CONDITION TYPES =====
const CONDITION_TYPES = [
    { label: 'If user is tagged with...', value: 'tag', icon: HashtagIcon },
    { label: 'If user is signed in', value: 'signedIn', icon: PersonIcon },
    { label: 'If user gives the passcode...', value: 'singlePasscode', icon: KeyIcon },
    { label: 'If user gives one of many passcodes...', value: 'multiplePasscodes', icon: LinkIcon },
    { label: 'If user arrives via a secret link...', value: 'singleSecretLink', icon: LinkIcon },
    { label: 'If user is visiting from a certain location', value: 'location', icon: GlobeIcon },
    { label: 'If user has a certain email address', value: 'specificEmail', icon: EmailIcon },
    { label: 'If user email address contains...', value: 'emailContains', icon: EmailIcon },
    { label: 'If user email is on a list...', value: 'emailFromList', icon: EmailIcon },
    { label: 'If user gives the passcode issued to their email...', value: 'pairedCredentials', icon: KeyIcon },
    { label: 'If user has a certain IP address', value: 'ip', icon: DesktopIcon },
    { label: 'If user confirms their age...', value: 'ageVerification', icon: PersonIcon },
];

// Condition types enforceable at checkout (see extensions/airo-lock-checkout-block
// and airo-lock-checkout-validation): buyer identity (sign-in, email), shipping
// address (location) and the checkout access-code field (passcodes). Tags, IP,
// secret links and age verification have no checkout signal — offering them
// would create locks that either block everyone or silently never enforce.
const CHECKOUT_CONDITION_TYPES = new Set(['signedIn', 'singlePasscode', 'multiplePasscodes', 'specificEmail', 'emailContains', 'emailFromList', 'pairedCredentials', 'location']);

// Conditions that require user input at runtime → use Form Widget
const FORM_BASED_CONDITIONS = new Set(['singlePasscode', 'multiplePasscodes', 'ageVerification', 'pairedCredentials']);

// Returns which widget types the current condition groups require
const getRequiredWidgetTypes = (groups = []) => {
    let needsForm = false;
    let needsText = false;
    for (const group of groups) {
        for (const cond of group?.conditions || []) {
            if (!cond?.type) continue;
            if (FORM_BASED_CONDITIONS.has(cond.type)) needsForm = true;
            else needsText = true;
        }
    }
    return { needsForm, needsText };
};

const USER_STATE_OPTIONS = [
    { label: 'Logged-in customers', value: 'loggedIn' },
    { label: 'Guests', value: 'guest' },
];

const COUNTRY_OPTIONS = [
    { label: 'Afghanistan', value: 'AF' },
    { label: 'Albania', value: 'AL' },
    { label: 'Algeria', value: 'DZ' },
    { label: 'Argentina', value: 'AR' },
    { label: 'Australia', value: 'AU' },
    { label: 'Austria', value: 'AT' },
    { label: 'Bangladesh', value: 'BD' },
    { label: 'Belgium', value: 'BE' },
    { label: 'Brazil', value: 'BR' },
    { label: 'Canada', value: 'CA' },
    { label: 'China', value: 'CN' },
    { label: 'Denmark', value: 'DK' },
    { label: 'Egypt', value: 'EG' },
    { label: 'Finland', value: 'FI' },
    { label: 'France', value: 'FR' },
    { label: 'Germany', value: 'DE' },
    { label: 'Greece', value: 'GR' },
    { label: 'India', value: 'IN' },
    { label: 'Indonesia', value: 'ID' },
    { label: 'Iran', value: 'IR' },
    { label: 'Iraq', value: 'IQ' },
    { label: 'Ireland', value: 'IE' },
    { label: 'Italy', value: 'IT' },
    { label: 'Japan', value: 'JP' },
    { label: 'Malaysia', value: 'MY' },
    { label: 'Mexico', value: 'MX' },
    { label: 'Netherlands', value: 'NL' },
    { label: 'New Zealand', value: 'NZ' },
    { label: 'Nigeria', value: 'NG' },
    { label: 'Norway', value: 'NO' },
    { label: 'Pakistan', value: 'PK' },
    { label: 'Philippines', value: 'PH' },
    { label: 'Poland', value: 'PL' },
    { label: 'Portugal', value: 'PT' },
    { label: 'Russia', value: 'RU' },
    { label: 'Saudi Arabia', value: 'SA' },
    { label: 'Singapore', value: 'SG' },
    { label: 'South Africa', value: 'ZA' },
    { label: 'South Korea', value: 'KR' },
    { label: 'Spain', value: 'ES' },
    { label: 'Sweden', value: 'SE' },
    { label: 'Switzerland', value: 'CH' },
    { label: 'Thailand', value: 'TH' },
    { label: 'Turkey', value: 'TR' },
    { label: 'United Arab Emirates', value: 'AE' },
    { label: 'United Kingdom', value: 'GB' },
    { label: 'United States', value: 'US' },
    { label: 'Vietnam', value: 'VN' },
    { label: 'Custom…', value: 'custom' },
];

// ===== HELPER COMPONENTS =====
function LocationConditionInput({ condition, onChange }) {
    const [inputValue, setInputValue] = useState('');
    const [options, setOptions] = useState(COUNTRY_OPTIONS);

    // Get selected country label
    const selectedCountry = COUNTRY_OPTIONS.find((c) => c.value === condition.value);
    const selectedLabel = selectedCountry ? selectedCountry.label : '';

    const updateText = useCallback(
        (value) => {
            setInputValue(value);

            if (value === '') {
                setOptions(COUNTRY_OPTIONS);
                return;
            }

            const filterRegex = new RegExp(value, 'i');
            const resultOptions = COUNTRY_OPTIONS.filter((option) => option.label.match(filterRegex));
            setOptions(resultOptions);
        },
        [],
    );

    const updateSelection = useCallback(
        (selected) => {
            const selectedValue = selected[0];
            const selectedOption = COUNTRY_OPTIONS.find((option) => option.value === selectedValue);
            
            if (selectedOption) {
                // Update the condition value to the country code
                onChange({ value: selectedValue });
                setInputValue(selectedOption.label);
            }
        },
        [onChange],
    );

    const textField = (
        <Autocomplete.TextField
            onChange={updateText}
            label="Country"
            value={inputValue || selectedLabel}
            placeholder="Search countries..."
            autoComplete="off"
        />
    );

    return (
        <BlockStack gap="200">
            <Autocomplete
                options={options}
                selected={condition.value ? [condition.value] : []}
                onSelect={updateSelection}
                textField={textField}
            />
            {condition.value === 'custom' && (
                <TextField
                    label="Custom location"
                    value={condition.custom || ''}
                    onChange={(v) => onChange({ custom: v })}
                    autoComplete="off"
                    placeholder="e.g., New York, London, EU"
                />
            )}
        </BlockStack>
    );
}

function ConditionRow({ condition, onChange, onRemove, index, usedTypes = [], checkoutMode = false }) {
    const setField = useCallback((key, value) => onChange({ ...condition, [key]: value }), [condition, onChange]);
    const { conditionTier } = usePlanGate();
    const { store, auth } = usePage().props;

    const ConditionIcon = CONDITION_TYPES.find((t) => t.value === condition.type)?.icon || InfoIcon;

    const selectOptions = useMemo(() => {
        // Plan-gated types stay visible (with their tier suffix) but can't be picked.
        const options = CONDITION_TYPES
            .filter(({ value }) => value === condition.type || (!usedTypes.includes(value) && (!checkoutMode || CHECKOUT_CONDITION_TYPES.has(value))))
            .map(({ label, value }) => {
                const tier = conditionTier(value);

                return { label: label + optionSuffix(tier), value, disabled: !!tier && value !== condition.type };
            });
        if (!condition.type) {
            options.unshift({ label: 'Select condition type...', value: '' });
        }
        return options;
    }, [condition.type, usedTypes, conditionTier, checkoutMode]);

    const conditionSpecificInput = useMemo(() => {
        switch (condition.type) {
            case 'tag':
                return (
                    <TextField
                        label="Customer tag"
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        autoComplete="off"
                        placeholder="e.g., VIP, B2B"
                        helpText="Customers must have this tag applied to their account"
                    />
                );
            case 'signedIn':
                return (
                    <Select
                        label="Customer state"
                        options={USER_STATE_OPTIONS}
                        value={condition.value || 'loggedIn'}
                        onChange={(v) => setField('value', v)}
                        helpText="Check if customer is signed in or not"
                    />
                );
            case 'singlePasscode':
                return (
                    <TextField
                        label="Passcode"
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        autoComplete="off"
                        placeholder='e.g., "123"'
                        helpText="The exact passcode customers must enter"
                    />
                );
            case 'multiplePasscodes':
                return (
                    <PasscodeListField
                        label="Multiple passcodes"
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        placeholder="e.g., 1234"
                        helpText='Customers can use any of these passcodes. Use "Add in bulk" to paste or upload a whole list at once.'
                    />
                );
            case 'singleSecretLink': {
                const secretCode = (condition.value || '').trim();
                // Store has no `domain` column — `url` holds the primary domain
                // (https://…); the shop's myshopify domain (users.name) is the fallback.
                const storefrontBase =
                    (store?.url || '').replace(/\/+$/, '') || (auth?.user?.name ? `https://${auth.user.name}` : '');
                const secretLink = secretCode && storefrontBase
                    ? `${storefrontBase}/?access=${encodeURIComponent(secretCode)}`
                    : '';
                return (
                    <FormLayout>
                        <TextField
                            label="Secret link code"
                            value={condition.value || ''}
                            onChange={(v) => setField('value', v)}
                            autoComplete="off"
                            placeholder="e.g., summer-sale-2024"
                            helpText="Customers must arrive via a link carrying this code"
                        />
                        {secretLink ? (
                            <TextField
                                label="Shareable secret link"
                                value={secretLink}
                                readOnly
                                autoComplete="off"
                                connectedRight={
                                    <Button onClick={() => navigator.clipboard?.writeText(secretLink)}>
                                        Copy
                                    </Button>
                                }
                                helpText="Send this to customers — opening it unlocks the locked content for their browsing session. You can also append ?access=CODE to any page or product link."
                            />
                        ) : null}
                    </FormLayout>
                );
            }
            case 'location':
                return (
                    <LocationConditionInput
                        condition={condition}
                        onChange={(updates) => onChange({ ...condition, ...updates })}
                    />
                );
            case 'specificEmail':
                return (
                    <TextField
                        label="Email address"
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        autoComplete="off"
                        placeholder="e.g., customer@example.com"
                        helpText="Exact email address required"
                    />
                );
            case 'emailContains':
                return (
                    <TextField
                        label="Email contains"
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        autoComplete="off"
                        placeholder="e.g., @company.com"
                        helpText="Email address must contain this text"
                    />
                );
            case 'pairedCredentials':
                return (
                    <CredentialPairField
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        helpText={'Each passcode works only for the email address next to it. A customer enters both, and a code issued to someone else will not let them in.'}
                    />
                );
            case 'emailFromList':
                return (
                    <PasscodeListField
                        label="Allowed email addresses"
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        kind="email"
                        itemLabel="Email"
                        addLabel="Add another email"
                        placeholder="e.g., customer@example.com"
                        helpText='Anyone on this list gets in. Use "Add in bulk" to paste or upload a whole customer list at once.'
                    />
                );
            case 'ip':
                return (
                    <TextField
                        label="IP address (IPv4/IPv6)"
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        autoComplete="off"
                        placeholder="e.g., 203.0.113.42"
                        helpText="Only allow access from specific IP addresses"
                    />
                );
            case 'ageVerification':
                return (
                    <BlockStack gap="200">
                        <Select
                            label="Minimum age required"
                            options={[
                                { label: '18 years old', value: '18' },
                                { label: '21 years old', value: '21' },
                                { label: '25 years old', value: '25' },
                            ]}
                            value={condition.value || '18'}
                            onChange={(v) => setField('value', v)}
                            helpText="Visitors must confirm they meet the minimum age requirement"
                        />
                    </BlockStack>
                );
            default:
                return <Text tone="subdued">Select a condition type to configure it.</Text>;
        }
    }, [condition, setField]);

    return (
        <Card padding="400">
            <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                        <Icon source={ConditionIcon} tone="subdued" />
                        <Text as="span" variant="bodyMd" fontWeight="medium">
                            Condition {index + 1}
                        </Text>
                        <Badge tone="info">Permit if</Badge>
                        <PlanBadge tier={conditionTier(condition.type)} />
                    </InlineStack>
                    <Button tone="critical" variant="plain" onClick={onRemove}>
                        Remove
                    </Button>
                </InlineStack>

                <FormLayout>
                    {/* Reset value/custom on type change — carrying them over saves e.g.
                        {type:'signedIn', value:'1234'} which no visitor can ever pass. */}
                    <Select
                        label="Condition type"
                        options={selectOptions}
                        value={condition.type}
                        onChange={(v) => onChange({ ...condition, type: v, value: '', custom: undefined })}
                    />
                    {conditionSpecificInput}
                </FormLayout>
            </BlockStack>
        </Card>
    );
}

function ConditionGroup({ group, onChange, onAddCondition, checkoutMode = false }) {
    const setGroupField = useCallback((key, value) => onChange({ ...group, [key]: value }), [group, onChange]);

    const updateCondition = useCallback(
        (idx, updated) => {
            const next = [...group.conditions];
            next[idx] = updated;
            setGroupField('conditions', next);
        },
        [group.conditions, setGroupField],
    );

    const removeCondition = useCallback(
        (idx) => {
            const next = group.conditions.filter((_, i) => i !== idx);
            setGroupField('conditions', next);
        },
        [group.conditions, setGroupField],
    );

    return (
        <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
                <Text as="span" tone="subdued">
                    {group.conditions.length} condition{group.conditions.length !== 1 ? 's' : ''}
                </Text>
                <Select
                    label="Operator"
                    labelHidden
                    options={[
                        { label: 'AND (all must match)', value: 'AND' },
                        { label: 'OR (any can match)', value: 'OR' },
                    ]}
                    value={group.operator}
                    onChange={(v) => setGroupField('operator', v)}
                />
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
                Customer must meet {group.operator === 'AND' ? 'all' : 'any'} of the conditions below to unlock access.
            </Text>
            {group.conditions.map((c, idx) => {
                const usedTypes = group.conditions
                    .filter((_, i) => i !== idx)
                    .map((cond) => cond.type)
                    .filter(Boolean);
                return (
                    <ConditionRow
                        key={idx}
                        condition={c}
                        onChange={(updated) => updateCondition(idx, updated)}
                        onRemove={() => removeCondition(idx)}
                        index={idx}
                        usedTypes={usedTypes}
                        checkoutMode={checkoutMode}
                    />
                );
            })}
            <Button
                onClick={onAddCondition}
                variant="plain"
                disabled={group.conditions.filter((c) => c.type).length >= CONDITION_TYPES.length}
            >
                + Add condition
            </Button>
        </BlockStack>
    );
}

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
    const [contentTypePopoverActive, setContentTypePopoverActive] = useState(false);
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

    const contentTypeIcons = {
        products: ProductIcon,
        collections: CollectionIcon,
        pages: PageIcon,
        blogs: BlogIcon,
        store: StoreIcon,
        themes: CodeIcon,
        variants: DuplicateIcon,
        checkout: StoreIcon,
    };

    const contentTypes = [
        { label: 'Products', value: 'products', icon: ProductIcon },
        { label: 'Collections', value: 'collections', icon: CollectionIcon },
        { label: 'Pages', value: 'pages', icon: PageIcon },
        { label: 'Blogs', value: 'blogs', icon: BlogIcon },
        { label: 'Liquid Theme', value: 'themes', icon: CodeIcon },
        { label: 'Store', value: 'store', icon: StoreIcon },
        // { label: 'Variants', value: 'variants', icon: DuplicateIcon },
        { label: 'Checkout (Plus)', value: 'checkout', icon: StoreIcon },
        { label: 'Hide Price Rule', value: 'price_hide', icon: ProductIcon },
    ];

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

                const navigationUrl = navigateAfterSave || '/';

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
                                // Success always redirects home; landing back on the
                                // form means the backend refused (e.g. plan gate) —
                                // the error flash can get lost in the embedded iframe,
                                // so never trust an empty error bag alone.
                                const path = (page.url || '').split('?')[0];
                                if (path !== '/') {
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
                                // Success always redirects home; landing back on the
                                // form page (URL keeps its ?shop=…&host=… query, so
                                // compare pathnames) means the backend refused. The
                                // error flash can get lost in the embedded iframe, so
                                // never trust an empty error bag alone.
                                const path = (page.url || '').split('?')[0];
                                if (path !== '/') {
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
            setPendingNavigationUrl('/');
            setShowLeaveConfirmation(true);
        } else {
            // No unsaved changes, navigate directly
            router.visit('/');
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

    const renderSelectedItemsPreview = () => {
        if (lockConfig.selectedItems.length === 0) return null;
        const dataMap = itemListsByType({ products, collections, pages, blogs, themes, variants, store });

        return (
            <Card>
                <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="medium">
                            Selected Items
                        </Text>
                        <InlineStack gap="200">
                            <Button onClick={() => setSelectionModalActive(true)} size="slim" variant="tertiary">
                                Change
                            </Button>
                            <Button onClick={() => updateLockConfig({ selectedItems: [] })} plain tone="critical" icon={XIcon} size="slim">
                                Clear all
                            </Button>
                        </InlineStack>
                    </InlineStack>
                    {selectedOverlaps.length > 0 && (
                        <Banner tone="warning" title="Another active lock already covers some of these items">
                            <p>
                                Only one lock is enforced per item — the one saved most recently (a custom widget design takes priority).
                                {' '}{selectedOverlaps.slice(0, 3).map((o) => `${o.title} is also locked by "${o.lockName}"`).join('; ')}
                                {selectedOverlaps.length > 3 ? `; and ${selectedOverlaps.length - 3} more` : ''}.
                            </p>
                        </Banner>
                    )}
                    <BlockStack gap="200">
                        {lockConfig.selectedItems.slice(0, 3).map((selId) => {
                            const [type, id] = selId.split('-');
                            const data = dataMap[type] || [];
                            const idFieldMap = {
                                products: 'shopify_product_id',
                                collections: 'shopify_collection_id',
                                pages: 'shopify_page_id',
                                blogs: 'shopify_blog_id',
                                themes: 'shopify_theme_id',
                                checkout: 'id',
                            };
                            const item = data.find((item) => `${type}-${item[idFieldMap[type]] || item.id}` === selId);
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
                                            </Text>
                                        </BlockStack>
                                    </InlineStack>
                                    <Button onClick={() => handleItemToggle(selId)} plain tone="critical" icon={XIcon} size="slim" />
                                </div>
                            );
                        })}
                        {lockConfig.selectedItems.length > 3 && (
                            <Text variant="bodySm" tone="subdued" alignment="center">
                                + {lockConfig.selectedItems.length - 3} more items
                            </Text>
                        )}
                    </BlockStack>
                </BlockStack>
            </Card>
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

    // Per-product variant picker (5.4). Lets the merchant lock only specific
    // variants. Leaving all unchecked keeps the rule product-wide.
    const renderVariantPicker = () => {
        if (lockConfig.selectedContentType !== 'products') return null;
        const productSelIds = lockConfig.selectedItems.filter((s) => s.startsWith('products-'));
        if (productSelIds.length === 0) return null;

        const rows = productSelIds
            .map((selId) => {
                const pid = selId.slice('products-'.length);
                const product = products.find((p) => String(p.shopify_product_id) === String(pid));
                const productVariants = variants.filter((v) => String(v.shopify_product_id) === String(pid));
                if (!product || productVariants.length <= 1) return null;
                const selected = (lockConfig.variantSelections && lockConfig.variantSelections[selId]) || [];
                const open = expandedVariantProduct === selId;
                return (
                    <Box key={selId} padding="200" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="200">
                            <Button
                                disclosure={open ? 'up' : 'down'}
                                onClick={() => setExpandedVariantProduct(open ? null : selId)}
                                fullWidth
                                textAlign="left"
                                variant="tertiary"
                            >
                                {`${product.title} — ${selected.length > 0 ? `${selected.length} variant(s) locked` : 'entire product'}`}
                            </Button>
                            <Collapsible open={open} id={`variant-picker-${selId}`}>
                                <BlockStack gap="100">
                                    {productVariants.map((v) => {
                                        const vid = variantNumericId(v);
                                        return (
                                            <Checkbox
                                                key={vid}
                                                label={v.title}
                                                checked={selected.includes(vid)}
                                                onChange={(checked) => toggleVariant(selId, vid, checked)}
                                            />
                                        );
                                    })}
                                </BlockStack>
                            </Collapsible>
                        </BlockStack>
                    </Box>
                );
            })
            .filter(Boolean);

        if (rows.length === 0) return null;

        return (
            <Card>
                <BlockStack gap="300">
                    <Text variant="headingMd" as="h2">Lock specific variants (optional)</Text>
                    <Text as="p" tone="subdued">
                        Leave a product's variants unchecked to lock the whole product. Check variants to lock only those; behavior is controlled by the "Variant behavior" settings.
                    </Text>
                    <Divider />
                    {rows}
                </BlockStack>
            </Card>
        );
    };

    // ===== MAIN RENDER =====
    return (
        <Frame>
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

            <div style={{ marginBottom: '15px' }}>
                <Page
                    title={lockConfig.name || 'Add lock'}
                    backAction={{
                        content: 'Dashboard',
                        onAction: handleBackAction,
                    }}
                    primaryAction={{
                        content: isSubmitting ? 'Creating...' : 'Create Lock',
                        onAction: () => handleSave(),
                        loading: isSubmitting,
                        disabled: isSubmitting || !lockConfig.name.trim() || lockConfig.selectedItems.length === 0,
                    }}
                >
                    <Layout>
                        <Layout.Section>
                            <InlineGrid columns={{ xs: '1fr', md: '1fr 340px' }} gap="400">
                                {/* ===== LEFT COLUMN - Main Content ===== */}
                                <BlockStack gap="400">
                                    {/* Lock Information */}
                                    <Card>
                                        <BlockStack gap="400">
                                            <InlineStack align="space-between" blockAlign="center">
                                                <Text variant="headingMd" as="h2">
                                                    Lock information
                                                </Text>
                                                <Badge tone={enabled ? 'success' : 'attention'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
                                            </InlineStack>
                                            <TextField
                                                label="Name"
                                                value={lockConfig.name}
                                                onChange={(value) => updateLockConfig({ name: value })}
                                                autoComplete="off"
                                                placeholder="Enter lock name"
                                            />
                                        </BlockStack>
                                    </Card>

                                    {/* Content to lock */}
                                    <Card>
                                        <BlockStack gap="400">
                                            <InlineStack align="space-between" blockAlign="center">
                                                <Text variant="headingMd" as="h2">
                                                    Content to lock
                                                </Text>
                                                {lockConfig.selectedItems.length > 0 && (
                                                    <Badge tone="success">{lockConfig.selectedItems.length} selected</Badge>
                                                )}
                                            </InlineStack>

                                            <Popover
                                                active={contentTypePopoverActive}
                                                activator={
                                                    <Button onClick={() => setContentTypePopoverActive(true)} disclosure fullWidth textAlign="left">
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
                                                                        ? 'Hide Price Rule'
                                                                        : contentTypes.find((c) => c.value === lockConfig.selectedContentType)?.label
                                                                    : 'Begin typing to search – or select a resource type'}
                                                            </span>
                                                        </InlineStack>
                                                    </Button>
                                                }
                                                onClose={() => setContentTypePopoverActive(false)}
                                                preferredAlignment="left"
                                                fullWidth
                                            >
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
                                            </Popover>

                                            {renderSelectedItemsPreview()}
                                        </BlockStack>
                                    </Card>

                                    {renderVariantPicker()}

                                    {/* Lock Conditions - Only for standard locks */}
                                    {lockConfig.lockType !== 'price_hide' && lockConfig.selectedItems.length > 0 && (
                                        <Card>
                                            <BlockStack gap="400">
                                                <Text variant="headingMd" as="h2">
                                                    Lock Conditions
                                                </Text>
                                                <Text as="p" tone="subdued">
                                                    Select condition to apply the lock
                                                </Text>
                                                <Divider />
                                                <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                                                    <Select
                                                        label="When locked, do this"
                                                        options={lockActionOptions}
                                                        value={lockConfig.lockAction}
                                                        onChange={applyLockAction}
                                                        helpText={LOCK_ACTION_HELP[lockConfig.lockAction] || ''}
                                                    />
                                                </Box>

                                                <Divider />

                                                {groups.length > 0 && (
                                                    <ConditionGroup
                                                        group={groups[0]}
                                                        checkoutMode={lockConfig.selectedContentType === 'checkout'}
                                                        onChange={(updated) => updateGroup(0, updated)}
                                                        onAddCondition={() => addConditionToGroup(0)}
                                                    />
                                                )}
                                            </BlockStack>
                                        </Card>
                                    )}

                                    {/* Hide Price Settings - Only for price_hide locks */}
                                    {lockConfig.lockType === 'price_hide' && lockConfig.selectedItems.length > 0 && (
                                        <Card>
                                            <BlockStack gap="400">
                                                <Text variant="headingMd" as="h2">
                                                    Price Visibility Settings
                                                </Text>
                                                <Divider />
                                                <TextField
                                                    label="Price Hidden Message"
                                                    value={lockConfig.priceMessage}
                                                    onChange={(value) => updateLockConfig({ priceMessage: value })}
                                                    helpText="Message to display in place of the price"
                                                    autoComplete="off"
                                                    placeholder="Sign in to see price"
                                                />
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
                                        </Card>
                                    )}

                                </BlockStack>

                                {/* ===== RIGHT COLUMN - Settings ===== */}
                                <BlockStack gap="400">
                                    {/* Settings */}
                                    <Card>
                                        <BlockStack gap="400">
                                            <InlineStack align="space-between" blockAlign="center">
                                                <Text variant="headingMd" as="h2">
                                                    Settings
                                                </Text>
                                                <KnobToggle checked={enabled} onChange={setEnabled} />
                                            </InlineStack>
                                            {lockConfig.lockType !== 'price_hide' && lockConfig.selectedItems.length > 0 && (
                                                <>
                                                    <Divider />
                                                    <TextField
                                                        label="Redirect URL (optional)"
                                                        value={redirectUrl}
                                                        onChange={setRedirectUrl}
                                                        placeholder="https://example.com/access-granted"
                                                        autoComplete="off"
                                                        helpText="Where to redirect customers after successful authentication"
                                                    />
                                                    <Checkbox
                                                        label="Hide from search engines"
                                                        checked={lockConfig.seoBlock}
                                                        onChange={(checked) => updateLockConfig({ seoBlock: checked })}
                                                        helpText="Adds a noindex meta tag so Googlebot won't index the locked page. Recommended for wholesale catalogs and confidential content."
                                                    />
                                                    <Divider />
                                                    <Text variant="headingSm" as="h3">
                                                        How long access lasts
                                                    </Text>
                                                    <Select
                                                        label="After a customer unlocks this"
                                                        options={[
                                                            { label: 'Stay unlocked on this device', value: 'remember' },
                                                            { label: 'Ask again on their next visit', value: 'session' },
                                                            { label: 'Ask again on every page', value: 'always' },
                                                        ]}
                                                        value={lockConfig.reprompt || 'remember'}
                                                        onChange={(value) => updateLockConfig({ reprompt: value })}
                                                        helpText={
                                                            lockConfig.reprompt === 'always'
                                                                ? 'Customers re-enter their details on every page, including a refresh. Use for sensitive content; it is deliberate friction.'
                                                                : lockConfig.reprompt === 'session'
                                                                  ? 'Customers browse freely once unlocked, but are asked again when they come back later.'
                                                                  : 'Customers unlock once and are not asked again on that browser.'
                                                        }
                                                    />
                                                    <Divider />
                                                    <Text variant="headingSm" as="h3">
                                                        Variant behavior (product locks only)
                                                    </Text>
                                                    <Select
                                                        label="When a variant is locked"
                                                        options={[
                                                            { label: 'Hide the variant option entirely', value: 'hide' },
                                                            { label: 'Show but disable the variant option', value: 'disable' },
                                                        ]}
                                                        value={lockConfig.lockedVariantDisplay}
                                                        onChange={(value) => updateLockConfig({ lockedVariantDisplay: value })}
                                                    />
                                                    <Select
                                                        label="When all variants of a product are locked"
                                                        options={[
                                                            { label: 'Hide the product entirely', value: 'hide_product' },
                                                            { label: 'Show product but disable purchasing', value: 'show_disabled' },
                                                        ]}
                                                        value={lockConfig.allVariantsLockedBehavior}
                                                        onChange={(value) => updateLockConfig({ allVariantsLockedBehavior: value })}
                                                    />
                                                </>
                                            )}
                                            {lockConfig.lockType !== 'price_hide' && lockConfig.selectedItems.length > 0 && (
                                                <BlockStack gap="400">
                                                    <Divider />
                                                    <InlineStack gap="200" blockAlign="center">
                                                        <Text variant="headingSm" as="h3">
                                                            Schedule (optional)
                                                        </Text>
                                                        <PlanBadge tier={schedulingTier()} />
                                                    </InlineStack>
                                                    <Box>
                                                        <InlineGrid columns={2} gap="400">
                                                            <TextField
                                                                label="Activate on"
                                                                type="date"
                                                                value={startDate}
                                                                onChange={setStartDate}
                                                                autoComplete="off"
                                                                prefix={<Icon source={CalendarIcon} />}
                                                                disabled={!!schedulingTier()}
                                                            />
                                                            <TextField
                                                                label="Time"
                                                                type="time"
                                                                value={startTime}
                                                                onChange={setStartTime}
                                                                autoComplete="off"
                                                                prefix={<Icon source={ClockIcon} />}
                                                                disabled={!!schedulingTier() || !startDate}
                                                            />
                                                        </InlineGrid>
                                                        <Box paddingBlockStart="100">
                                                            <Text tone="subdued" variant="bodySm">
                                                                Leave blank to activate immediately.
                                                            </Text>
                                                        </Box>
                                                    </Box>

                                                    <Box>
                                                        <InlineGrid columns={2} gap="400">
                                                            <TextField
                                                                label="Expire on"
                                                                type="date"
                                                                value={endDate}
                                                                onChange={setEndDate}
                                                                autoComplete="off"
                                                                prefix={<Icon source={CalendarIcon} />}
                                                                disabled={!!schedulingTier()}
                                                            />
                                                            <TextField
                                                                label="Time"
                                                                type="time"
                                                                value={endTime}
                                                                onChange={setEndTime}
                                                                autoComplete="off"
                                                                prefix={<Icon source={ClockIcon} />}
                                                                disabled={!!schedulingTier() || !endDate}
                                                            />
                                                        </InlineGrid>
                                                        <Box paddingBlockStart="100">
                                                            <Text tone="subdued" variant="bodySm">
                                                                Leave blank for no expiration.
                                                            </Text>
                                                        </Box>
                                                    </Box>
                                                </BlockStack>
                                            )}
                                        </BlockStack>
                                    </Card>

                                    {/* Widget Selection */}
                                    <Card>
                                        <BlockStack gap="400">
                                            <InlineStack align="space-between" blockAlign="center">
                                                <Text variant="headingMd" as="h2">
                                                    Widgets
                                                </Text>
                                                <InlineStack gap="100">
                                                    {requiredWidgetTypes.needsForm && <Badge tone="info">Form</Badge>}
                                                    {requiredWidgetTypes.needsText && <Badge tone="success">Text</Badge>}
                                                </InlineStack>
                                            </InlineStack>
                                            <Divider />

                                            {!requiredWidgetTypes.needsForm && !requiredWidgetTypes.needsText && (
                                                <Box
                                                    background="bg-surface-secondary"
                                                    padding="300"
                                                    borderRadius="200"
                                                    borderColor="border"
                                                    borderWidth="025"
                                                >
                                                    <InlineStack gap="200" blockAlign="start" wrap={false}>
                                                        <Icon source={InfoIcon} tone="subdued" />
                                                        <Text as="p" variant="bodySm" tone="subdued">
                                                            Add a condition to choose a widget design.
                                                        </Text>
                                                    </InlineStack>
                                                </Box>
                                            )}

                                            {requiredWidgetTypes.needsForm && (
                                                <BlockStack gap="200">
                                                    <Box
                                                        background="bg-surface-info"
                                                        padding="300"
                                                        borderRadius="200"
                                                        borderColor="border-info"
                                                        borderWidth="025"
                                                    >
                                                        <InlineStack gap="200" blockAlign="start" wrap={false}>
                                                            <Icon source={KeyIcon} tone="info" />
                                                            <BlockStack gap="050">
                                                                <Text as="span" variant="bodySm" fontWeight="medium">
                                                                    Form widget applies to this lock
                                                                </Text>
                                                                <Text as="p" variant="bodySm" tone="subdued">
                                                                    Used for conditions that need user input (passcode, age verification).
                                                                </Text>
                                                            </BlockStack>
                                                        </InlineStack>
                                                    </Box>
                                                    <Select
                                                        label="Form widget design"
                                                        options={[
                                                            { label: 'None (use default design)', value: '' },
                                                            ...formWidgets.map((w) => ({ label: w.name, value: String(w.id) })),
                                                        ]}
                                                        value={lockConfig.widget_id ? String(lockConfig.widget_id) : ''}
                                                        onChange={(value) => updateLockConfig({ widget_id: value })}
                                                    />
                                                    <CreateWidgetButton
                                                        type="form"
                                                        widgets={formWidgets}
                                                        storeLocales={storeLocales}
                                                        primaryLocale={primaryLocale}
                                                        onCreated={(id) => updateLockConfig({ widget_id: id })}
                                                    />
                                                </BlockStack>
                                            )}

                                            {requiredWidgetTypes.needsText && (
                                                <BlockStack gap="200">
                                                    <Box
                                                        background="bg-surface-success"
                                                        padding="300"
                                                        borderRadius="200"
                                                        borderColor="border-success"
                                                        borderWidth="025"
                                                    >
                                                        <InlineStack gap="200" blockAlign="start" wrap={false}>
                                                            <Icon source={InfoIcon} tone="success" />
                                                            <BlockStack gap="050">
                                                                <Text as="span" variant="bodySm" fontWeight="medium">
                                                                    Text widget applies to this lock
                                                                </Text>
                                                                <Text as="p" variant="bodySm" tone="subdued">
                                                                    Used for conditions that don't need input (tag, signed in, location).
                                                                </Text>
                                                            </BlockStack>
                                                        </InlineStack>
                                                    </Box>
                                                    <Select
                                                        label="Text widget design"
                                                        options={[
                                                            { label: 'None (use default design)', value: '' },
                                                            ...textWidgets.map((w) => ({ label: w.name, value: String(w.id) })),
                                                        ]}
                                                        value={lockConfig.text_widget_id ? String(lockConfig.text_widget_id) : ''}
                                                        onChange={(value) => updateLockConfig({ text_widget_id: value })}
                                                    />
                                                    <CreateWidgetButton
                                                        type="text"
                                                        widgets={textWidgets}
                                                        storeLocales={storeLocales}
                                                        primaryLocale={primaryLocale}
                                                        onCreated={(id) => updateLockConfig({ text_widget_id: id })}
                                                    />
                                                </BlockStack>
                                            )}

                                        <Divider />

                                        {/* Wording sits beside the design it words, not in a card of its own. */}
                                        <PopupTextModal
                                            popupText={lockConfig.popupText}
                                            description={lockConfig.description}
                                            onChange={(popupText) => updateLockConfig({ popupText })}
                                            onDescriptionChange={(description) => updateLockConfig({ description })}
                                            groups={groups}
                                            widget={[...formWidgets, ...textWidgets].find(
                                                (w) => String(w.id) === String(lockConfig.widget_id || lockConfig.text_widget_id),
                                            )}
                                            storeLocales={storeLocales}
                                            primaryLocale={primaryLocale}
                                        />
                                        </BlockStack>
                                    </Card>

                                </BlockStack>
                            </InlineGrid>
                        </Layout.Section>
                    </Layout>

                    {/* ===== CONTENT SELECTION MODAL ===== */}
                    <Modal
                        open={selectionModalActive}
                        onClose={() => setSelectionModalActive(false)}
                        title={`Select ${lockConfig.selectedContentType || 'Content'}`}
                        large
                        primaryAction={{ content: 'Add Selected', onAction: () => setSelectionModalActive(false) }}
                        secondaryActions={[{ content: 'Cancel', onAction: () => setSelectionModalActive(false) }]}
                    >
                        <Modal.Section>
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

                            <div className="mt-4">
                                <InlineStack align="space-between" blockAlign="center">
                                    <InlineStack gap="200" blockAlign="center">
                                        <Text variant="bodySm" tone="subdued">
                                            Showing {Math.min(filteredData.length, itemsPerPage)} of {filteredData.length} items
                                        </Text>
                                        {/* Pages, blogs and themes have no Shopify webhooks, so this
                                            list goes stale after install until it is re-read. */}
                                        <Button
                                            variant="plain"
                                            icon={RefreshIcon}
                                            loading={refreshingCatalog}
                                            onClick={refreshCatalog}
                                        >
                                            Refresh from Shopify
                                        </Button>
                                    </InlineStack>
                                    {paginatedData.length > 0 && (
                                        <Button onClick={handleSelectAllOnPage} size="slim">
                                            {filteredData.every((item) => {
                                                const idFieldMap = {
                                                    products: 'shopify_product_id',
                                                    collections: 'shopify_collection_id',
                                                    pages: 'shopify_page_id',
                                                    blogs: 'shopify_blog_id',
                                                    themes: 'shopify_theme_id',
                                                };
                                                const selId = `${lockConfig.selectedContentType}-${item[idFieldMap[lockConfig.selectedContentType]] || item.id}`;
                                                return lockConfig.selectedItems.includes(selId);
                                            })
                                                ? 'Deselect all'
                                                : 'Select all'}
                                        </Button>
                                    )}
                                </InlineStack>

                                <div className="mt-4 max-h-[400px] min-h-[400px] overflow-y-auto">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-10">
                                            <Spinner size="large" />
                                        </div>
                                    ) : paginatedData.length > 0 ? (
                                        paginatedData.map((item) => {
                                            const idFieldMap = {
                                                products: 'shopify_product_id',
                                                collections: 'shopify_collection_id',
                                                pages: 'shopify_page_id',
                                                blogs: 'shopify_blog_id',
                                                themes: 'shopify_theme_id',
                                            };
                                            const idField = idFieldMap[lockConfig.selectedContentType] || 'id';
                                            const selId = `${lockConfig.selectedContentType}-${item[idField] || item.id}`;
                                            const isSelected = lockConfig.selectedItems.includes(selId);
                                            const IconComponent = contentTypeIcons[lockConfig.selectedContentType];
                                            const otherLockName = otherLockNameFor(lockConfig.selectedContentType, item.handle);

                                            return (
                                                <div
                                                    key={selId}
                                                    onClick={() => handleItemToggle(selId)}
                                                    className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 p-3 px-4 transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                                                >
                                                    <span className="pointer-events-none"><Checkbox checked={isSelected} onChange={() => { }} label="" /></span>
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
                                                            className={`flex h-10 w-10 items-center justify-center rounded ${isSelected ? 'bg-[#008060]' : 'bg-gray-200'}`}
                                                        >
                                                            <Icon source={IconComponent} tone={isSelected ? 'textInverse' : 'subdued'} />
                                                        </div>
                                                    )}
                                                    <div className="flex-1">
                                                        <InlineStack gap="200" blockAlign="center">
                                                            <Text variant="bodyMd" fontWeight="medium">
                                                                {item.title || item.name}
                                                            </Text>
                                                            {otherLockName ? <Badge tone="warning">{`Locked by "${otherLockName}"`}</Badge> : null}
                                                        </InlineStack>
                                                        <Text variant="bodySm" tone="subdued">
                                                            {lockConfig.selectedContentType === 'products' && item.vendor && `Vendor: ${item.vendor}`}
                                                            {lockConfig.selectedContentType === 'collections' &&
                                                                item.products_count &&
                                                                `Products: ${item.products_count}`}
                                                        </Text>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-10 text-center">
                                            <Icon source={SearchIcon} tone="subdued" />
                                            <Text variant="bodyMd" tone="subdued">
                                                No items found
                                            </Text>
                                        </div>
                                    )}
                                </div>

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

                                {/* Overlap warning — only ONE lock is enforced per item */}
                                {selectedOverlaps.length > 0 && (
                                    <Box paddingBlockEnd="300">
                                        <Banner tone="warning" title="Some selected items are already covered by another active lock">
                                            <p>
                                                Only one lock is enforced per item — the one saved most recently (a custom widget design takes priority).
                                                {' '}Overlapping: {selectedOverlaps.slice(0, 3).map((o) => `${o.title} (locked by "${o.lockName}")`).join(', ')}
                                                {selectedOverlaps.length > 3 ? ` and ${selectedOverlaps.length - 3} more` : ''}.
                                                {' '}Consider editing the existing lock instead, or remove the item from one of them.
                                            </p>
                                        </Banner>
                                    </Box>
                                )}

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
                </Page>
            </div>
        </Frame>
    );
};

export default LockCreationFlow;
