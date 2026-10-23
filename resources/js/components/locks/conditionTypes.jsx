import { usePage } from '@inertiajs/react';
import { Autocomplete, BlockStack, Button, FormLayout, Select, Text, TextField } from '@shopify/polaris';
import {
    DesktopIcon,
    EmailIcon,
    GlobeIcon,
    HashtagIcon,
    KeyIcon,
    LinkIcon,
    PersonIcon,
} from '@shopify/polaris-icons';
import { useCallback, useMemo, useState } from 'react';
import { splitListValue } from '../../lib/listValue';
import { splitPairs } from '../../lib/pairList';
import CredentialPairField from './CredentialPairField';
import PasscodeListField from './PasscodeListField';
import { optionSuffix, usePlanGate } from './planGate';

/*
 * The condition model shared by /lock/create and /lock/{lock}/configure.
 * Moved out of LockCreationFlow.jsx and LockCreationEdit.jsx, where it was
 * duplicated byte for byte — the values, labels, help text and the per-type
 * inputs are exactly what those two files carried.
 */

// ===== CONDITION TYPES =====
export const CONDITION_TYPES = [
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
export const CHECKOUT_CONDITION_TYPES = new Set(['signedIn', 'singlePasscode', 'multiplePasscodes', 'specificEmail', 'emailContains', 'emailFromList', 'pairedCredentials', 'location']);

// Conditions that require user input at runtime → use Form Widget
export const FORM_BASED_CONDITIONS = new Set(['singlePasscode', 'multiplePasscodes', 'ageVerification', 'pairedCredentials']);

// Returns which widget types the current condition groups require
export const getRequiredWidgetTypes = (groups = []) => {
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

export const USER_STATE_OPTIONS = [
    { label: 'Logged-in customers', value: 'loggedIn' },
    { label: 'Guests', value: 'guest' },
];

export const COUNTRY_OPTIONS = [
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

/** The short name a summary uses for one condition ("A passcode"). */
const CONDITION_SUMMARY = {
    tag: 'Customer tag',
    signedIn: 'Signed-in customers',
    singlePasscode: 'A passcode',
    multiplePasscodes: 'One of many passcodes',
    singleSecretLink: 'A secret link',
    location: 'A location',
    specificEmail: 'A specific email',
    emailContains: 'An email domain',
    emailFromList: 'An email list',
    pairedCredentials: 'Email + its own passcode',
    ip: 'An IP address',
    ageVerification: 'Age confirmation',
};

export const conditionShortName = (type) => CONDITION_SUMMARY[type] || 'A condition';

export const conditionLabel = (type) =>
    CONDITION_TYPES.find((t) => t.value === type)?.label || 'Choose a condition type';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * What a condition is set to, in a line — so a row is worth reading without
 * opening it. Empty string when nothing has been entered yet.
 */
export function conditionValueSummary(condition) {
    const value = condition?.value;
    switch (condition?.type) {
        case 'signedIn':
            return USER_STATE_OPTIONS.find((o) => o.value === (value || 'loggedIn'))?.label || '';
        case 'location': {
            if (value === 'custom') return (condition.custom || '').trim();
            return COUNTRY_OPTIONS.find((c) => c.value === value)?.label || '';
        }
        case 'multiplePasscodes': {
            const n = splitListValue(value).filter((s) => s.trim() !== '').length;
            return n ? plural(n, 'passcode') : '';
        }
        case 'emailFromList': {
            const n = splitListValue(value).filter((s) => s.trim() !== '').length;
            return n ? `${n} email address${n === 1 ? '' : 'es'}` : '';
        }
        case 'pairedCredentials': {
            const n = String(value ?? '').trim() === ''
                ? 0
                : splitPairs(value).filter((p) => p.email || p.passcode).length;
            return n ? plural(n, 'email and passcode pair') : '';
        }
        case 'ageVerification':
            return `${value || '18'} or older`;
        default:
            return String(value ?? '').trim();
    }
}

// ===== HELPER COMPONENTS =====
export function LocationConditionInput({ condition, onChange }) {
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

/**
 * The form for one condition — its type and whatever that type needs. This is
 * the body the builder used to draw inside a card per condition; it now opens
 * in a modal from the condition's row.
 */
export function ConditionFields({ condition, onChange, usedTypes = [], checkoutMode = false }) {
    const setField = useCallback((key, value) => onChange({ ...condition, [key]: value }), [condition, onChange]);
    const { conditionTier } = usePlanGate();
    const { store, auth } = usePage().props;

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
    }, [condition, setField, onChange, store, auth]);

    return (
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
    );
}
