import {
    Badge,
    Banner,
    BlockStack,
    Box,
    Button,
    Card,
    Checkbox,
    Divider,
    FormLayout,
    Icon,
    InlineGrid,
    InlineStack,
    Select,
    Text,
    TextField,
} from '@shopify/polaris';
import { DesktopIcon, EmailIcon, GlobeIcon, HashtagIcon, InfoIcon, KeyIcon, LinkIcon, PersonIcon } from '@shopify/polaris-icons';
import { useCallback, useMemo, useState } from 'react';

const CONDITION_TYPES = [
    { label: 'If user is tagged with...', value: 'tag', icon: HashtagIcon },
    { label: 'If user is signed in', value: 'signedIn', icon: PersonIcon },
    { label: 'If user gives the passcode...', value: 'singlePasscode', icon: KeyIcon },
    { label: 'If user gives one of many passcodes...', value: 'multiplePasscodes', icon: LinkIcon },
    { label: 'If user gives a passcode from an input list', value: 'passcodeFromList', icon: HashtagIcon },
    { label: 'If user arrives via a secret link...', value: 'singleSecretLink', icon: LinkIcon },
    { label: 'If user arrives using a secret link code from an input list', value: 'secretLinkFromList', icon: LinkIcon },
    { label: 'If user is visiting from a certain location (city, country, etc)', value: 'location', icon: GlobeIcon },
    { label: 'If user has a certain email address', value: 'specificEmail', icon: EmailIcon },
    { label: "If user's email address contains...", value: 'emailContains', icon: EmailIcon },
    { label: 'If user has an email address from an input list', value: 'emailFromList', icon: LinkIcon },
    { label: 'If user has a certain IP address', value: 'ip', icon: DesktopIcon },
];

const USER_STATE_OPTIONS = [
    { label: 'Logged-in customers', value: 'loggedIn' },
    { label: 'Guests', value: 'guest' },
];

const COUNTRY_OPTIONS = [
    { label: 'United States', value: 'US' },
    { label: 'Pakistan', value: 'PK' },
    { label: 'United Kingdom', value: 'GB' },
    { label: 'Canada', value: 'CA' },
    { label: 'Custom…', value: 'custom' },
];

// Helper component for multi-line input
function MultiTextField({ label, value, onChange, placeholder, helpText, rows = 3 }) {
    return (
        <FormLayout>
            <TextField
                label={label}
                value={value || ''}
                onChange={onChange}
                multiline={rows}
                autoComplete="off"
                placeholder={placeholder}
                helpText={helpText}
            />
        </FormLayout>
    );
}

function ConditionRow({ condition, onChange, onRemove, index }) {
    const setField = useCallback((key, value) => onChange({ ...condition, [key]: value }), [condition, onChange]);

    const ConditionIcon = CONDITION_TYPES.find((t) => t.value === condition.type)?.icon || InfoIcon;

    const selectOptions = useMemo(() => {
        return CONDITION_TYPES.map(({ label, value }) => ({
            label,
            value,
        }));
    }, []);

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
                    <MultiTextField
                        label="Multiple passcodes (one per line)"
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        placeholder={'passcode1\npasscode2\npasscode3'}
                        helpText="Customers can use any of these passcodes (enter one per line)"
                        rows={4}
                    />
                );
            case 'passcodeFromList':
                return (
                    <TextField
                        label="List name or ID"
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        autoComplete="off"
                        placeholder="e.g., vip-passcodes"
                        helpText="Reference to a list of passcodes stored elsewhere"
                    />
                );
            case 'singleSecretLink':
                return (
                    <TextField
                        label="Secret link code"
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        autoComplete="off"
                        placeholder="e.g., summer-sale-2024"
                        helpText="Customers must arrive via a specific secret link"
                    />
                );
            case 'secretLinkFromList':
                return (
                    <TextField
                        label="Secret link list name or ID"
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        autoComplete="off"
                        placeholder="e.g., influencer-links"
                        helpText="Reference to a list of secret links stored elsewhere"
                    />
                );
            case 'location':
                return (
                    <BlockStack gap="200">
                        <Select label="Country" options={COUNTRY_OPTIONS} value={condition.country || ''} onChange={(v) => setField('country', v)} />
                        {condition.country === 'custom' && (
                            <TextField
                                label="Custom location"
                                value={condition.custom || ''}
                                onChange={(v) => setField('custom', v)}
                                autoComplete="off"
                                placeholder="e.g., New York, London, EU"
                                helpText="Enter a specific city, region, or custom location"
                            />
                        )}
                    </BlockStack>
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
            case 'emailFromList':
                return (
                    <MultiTextField
                        label="Email list (one per line)"
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        placeholder={'customer1@example.com\ncustomer2@example.com'}
                        helpText="Customers must have one of these email addresses"
                        rows={4}
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
                    </InlineStack>
                    <Button tone="critical" variant="plain" onClick={onRemove}>
                        Remove
                    </Button>
                </InlineStack>

                <FormLayout>
                    <Select label="Condition type" options={selectOptions} value={condition.type} onChange={(v) => setField('type', v)} />

                    {conditionSpecificInput}

                    <Checkbox
                        label="Invert condition (deny if this matches)"
                        checked={Boolean(condition.invert)}
                        onChange={(checked) => setField('invert', checked)}
                        helpText="Flip the logic to deny access when this condition matches"
                    />
                </FormLayout>
            </BlockStack>
        </Card>
    );
}

function ConditionGroup({ group, onChange, onRemove, onAddCondition, index }) {
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
        <Card padding="0">
            <Box padding="400">
                <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200" blockAlign="center">
                            <Badge tone={group.operator === 'AND' ? 'success' : 'attention'}>
                                {group.operator === 'AND' ? 'All must match' : 'Any can match'}
                            </Badge>
                            <Text as="span" tone="subdued">
                                Key {index + 1} • {group.conditions.length} condition{group.conditions.length !== 1 ? 's' : ''}
                            </Text>
                        </InlineStack>
                        <InlineStack gap="200">
                            <Select
                                label="Operator"
                                labelHidden
                                options={[
                                    { label: 'AND (all conditions must match)', value: 'AND' },
                                    { label: 'OR (any condition can match)', value: 'OR' },
                                ]}
                                value={group.operator}
                                onChange={(v) => setGroupField('operator', v)}
                            />
                            <Button tone="critical" onClick={onRemove}>
                                Remove key
                            </Button>
                        </InlineStack>
                    </InlineStack>

                    <Text as="p" tone="subdued">
                        To use this key, a customer must meet {group.operator === 'AND' ? 'all' : 'any'} of its conditions.
                    </Text>
                </BlockStack>
            </Box>

            <Divider />

            <Box padding="400">
                <BlockStack gap="400">
                    {group.conditions.map((c, idx) => (
                        <ConditionRow
                            key={idx}
                            condition={c}
                            onChange={(updated) => updateCondition(idx, updated)}
                            onRemove={() => removeCondition(idx)}
                            index={idx}
                        />
                    ))}

                    <Button onClick={onAddCondition} variant="plain">
                        + Add condition to this key
                    </Button>
                </BlockStack>
            </Box>
        </Card>
    );
}

const Lockmethod = ({ initialData, lock_id, onBack, onSubmit, isSubmitting = false, isEmbedded = false }) => {
    // Initialize state from initialData
    const [enabled, setEnabled] = useState(initialData ? initialData.status === 'Active' : true);
    const [prompt, setPrompt] = useState(initialData?.description || 'Please enter the passcode to continue:');
    const [redirectUrl, setRedirectUrl] = useState('');
    const [expiresAt, setExpiresAt] = useState('');

    // Get resource info
    const resourceType = initialData?.selectedItems?.[0]?.resource_type || 'collection';
    const handle = initialData?.selectedItems?.[0]?.handle || '';
    const isMultiple = initialData?.selectedItems?.length > 1;

    // Initial condition groups
    const initialGroups = useMemo(() => {
        return [
            {
                operator: 'AND',
                conditions: [{ type: 'singlePasscode', value: '123', invert: false }],
            },
        ];
    }, []);

    const [groups, setGroups] = useState(initialGroups);

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
                conditions: [...next[groupIndex].conditions, { type: 'singlePasscode', value: '', invert: false }],
            };
            return next;
        });
    }, []);

    const saveDisabled = useMemo(() => groups.length === 0, [groups.length]);

    const handleSave = useCallback(() => {
        const finalConfig = {
            lock_id,
            rules: groups,
            status: enabled ? 'Active' : 'Draft',
            description: prompt,
            expires_at: expiresAt,
            redirect_url: redirectUrl,
        };

        if (onSubmit) {
            onSubmit(finalConfig);
        }
    }, [groups, enabled, prompt, expiresAt, redirectUrl, lock_id, onSubmit]);

    const pageTitle = isMultiple ? `${initialData?.selectedItems?.length} items (${initialData?.name})` : handle || 'Configure Lock';

    return (
        <BlockStack gap="400">
            {/* Back Button and Header */}
            {isEmbedded && (
                <InlineStack align="end">
                    {/* <Button 
                        onClick={onBack} 
                        icon={ArrowLeftIcon}
                        variant="plain"
                    >
                        Back to Content Selection
                    </Button> */}
                    <Button variant="primary" onClick={handleSave} loading={isSubmitting} disabled={saveDisabled || (!handle && !isMultiple)}>
                        Save Lock
                    </Button>
                </InlineStack>
            )}

            {/* Info Banner */}
            <Banner title="Lock settings information" tone="info">
                <BlockStack gap="200">
                    <Text as="p" variant="bodyMd">
                        {isMultiple
                            ? `These lock settings will be applied to ${initialData?.selectedItems?.length} selected items.`
                            : `Locks will be applied on ${resourceType}.`}
                    </Text>
                </BlockStack>
            </Banner>

            <InlineGrid columns={{ xs: '1fr', md: '2fr 1fr' }} gap="400">
                {/* Left Column - Main Content */}
                <BlockStack gap="500">
                    <Card roundedAbove="sm">
                        <Box padding="400">
                            <BlockStack gap="400">
                                <InlineStack align="space-between" blockAlign="center">
                                    <Text variant="headingLg" as="h2">
                                        Access rules
                                    </Text>
                                </InlineStack>

                                <Text as="p" tone="subdued">
                                    Define how customers can access this content. Each key is a way for customers to open your locked content.
                                </Text>
                            </BlockStack>
                        </Box>

                        <Divider />

                        <Box padding="400">
                            <BlockStack gap="500">
                                {groups.map((group, idx) => (
                                    <ConditionGroup
                                        key={idx}
                                        group={group}
                                        onChange={(updated) => updateGroup(idx, updated)}
                                        onRemove={() => removeGroup(idx)}
                                        onAddCondition={() => addConditionToGroup(idx)}
                                        index={idx}
                                    />
                                ))}

                                <Button onClick={addGroup} variant="plain">
                                    + Add key
                                </Button>
                            </BlockStack>
                        </Box>
                    </Card>

                    <Card roundedAbove="sm">
                        <Box padding="400">
                            <Text variant="headingLg" as="h3">
                                Behavior
                            </Text>
                        </Box>
                        <Divider />
                        <Box padding="400">
                            <FormLayout>
                                <TextField
                                    label="Redirect URL (optional)"
                                    value={redirectUrl}
                                    onChange={setRedirectUrl}
                                    placeholder="https://example.com/access-granted"
                                    autoComplete="off"
                                    helpText="Where to redirect customers after successful authentication"
                                />
                            </FormLayout>
                        </Box>
                    </Card>
                </BlockStack>

                {/* Right Column - Sidebar */}
                <BlockStack gap="400">
                    <Card roundedAbove="sm">
                        <Box padding="400">
                            <Text variant="headingLg" as="h3">
                                Settings
                            </Text>
                        </Box>
                        <Divider />
                        <Box padding="400">
                            <BlockStack gap="400">
                                <BlockStack gap="200">
                                    <Checkbox
                                        label="Enable this lock"
                                        checked={enabled}
                                        onChange={setEnabled}
                                        helpText="The most important part. :)"
                                    />
                                    <TextField
                                        label="Schedule expiration"
                                        type="datetime-local"
                                        value={expiresAt}
                                        onChange={setExpiresAt}
                                        autoComplete="off"
                                        helpText="Lock will be automatically deleted after this time."
                                    />
                                </BlockStack>
                            </BlockStack>
                        </Box>
                    </Card>

                    <Card roundedAbove="sm">
                        <Box padding="200">
                            <InlineStack gap="200" blockAlign="center">
                                <Icon source={InfoIcon} tone="subdued" />
                                <Text as="span" tone="subdued">
                                    Tip: Use AND/OR to combine conditions like "email domain AND country" or "logged-in OR VIP".
                                </Text>
                            </InlineStack>
                        </Box>
                    </Card>

                    {/* Save Button for Sidebar */}
                    <Card>
                        <Box padding="400">
                            <BlockStack gap="300">
                                <Button
                                    variant="primary"
                                    size="large"
                                    fullWidth
                                    onClick={handleSave}
                                    loading={isSubmitting}
                                    disabled={saveDisabled || (!handle && !isMultiple)}
                                >
                                    Save Lock
                                </Button>
                                <Text variant="bodySm" tone="subdued" alignment="center">
                                    {groups.length} access rule{groups.length !== 1 ? 's' : ''} configured
                                </Text>
                            </BlockStack>
                        </Box>
                    </Card>
                </BlockStack>
            </InlineGrid>
        </BlockStack>
    );
};

export default Lockmethod;
