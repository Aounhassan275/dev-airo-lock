import { Badge, BlockStack, Button, Card, FormLayout, Icon, InlineStack, Select, Text, TextField } from '@shopify/polaris';
import { InfoIcon } from '@shopify/polaris-icons';
import { useCallback, useMemo } from 'react';
import { CONDITION_TYPES, COUNTRY_OPTIONS, USER_STATE_OPTIONS } from './constants';
import { optionSuffix, PlanBadge, usePlanGate } from './planGate';
import CredentialPairField from './CredentialPairField';
import PasscodeListField from './PasscodeListField';

export default function ConditionRow({ condition, onChange, onRemove, index }) {
    const setField = useCallback((key, value) => onChange({ ...condition, [key]: value }), [condition, onChange]);
    const { conditionTier } = usePlanGate();

    const ConditionIcon = CONDITION_TYPES.find((t) => t.value === condition.type)?.icon || InfoIcon;

    const selectOptions = useMemo(() => {
        // Plan-gated types stay visible (with their tier suffix) but can't be picked.
        return CONDITION_TYPES.map(({ label, value }) => {
            const tier = conditionTier(value);

            return { label: label + optionSuffix(tier), value, disabled: !!tier && value !== condition.type };
        });
    }, [conditionTier, condition.type]);

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
                        helpText="Customers can use any of these passcodes. Use “Add in bulk” to paste or upload a whole list at once."
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
            case 'pairedCredentials':
                return (
                    <CredentialPairField
                        value={condition.value || ''}
                        onChange={(v) => setField('value', v)}
                        helpText="Each passcode works only for the email address next to it. A customer enters both, and a code issued to someone else will not let them in."
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
                        helpText="Anyone on this list gets in. Use “Add in bulk” to paste or upload a whole customer list at once."
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
                        <PlanBadge tier={conditionTier(condition.type)} />
                    </InlineStack>
                    <Button tone="critical" variant="plain" onClick={onRemove}>
                        Remove
                    </Button>
                </InlineStack>

                <FormLayout>
                    <Select label="Condition type" options={selectOptions} value={condition.type} onChange={(v) => setField('type', v)} />
                    {conditionSpecificInput}
                </FormLayout>
            </BlockStack>
        </Card>
    );
}
