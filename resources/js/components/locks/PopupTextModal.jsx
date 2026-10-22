import {
    BlockStack,
    Box,
    Button,
    FormLayout,
    Icon,
    InlineGrid,
    InlineStack,
    Select,
    Text,
    TextField,
} from '@shopify/polaris';
import { EditIcon, TextIcon } from '@shopify/polaris-icons';
import { Modal, TitleBar } from '@shopify/app-bridge-react';
import { useMemo, useState } from 'react';
import {
    applyLanguageForPreview,
    isRTLLocale,
    localeLabel,
    normalizeLocale,
    preferredEditingLocale,
    translate,
} from '../../lib/widgetLanguages';
import { previewFields, resolvePopupCopy } from '../../lib/popupPreview';

/**
 * Per-lock popup wording, edited in a modal beside a live preview.
 *
 * The title, button and placeholders live on the WIDGET, which is shared by
 * every lock pointing at it — so wording one lock differently used to mean
 * cloning the whole design. These fields override that for this lock only.
 *
 * Blank means "leave it alone": the popup falls back to the widget's wording,
 * then to the translated default for the shopper's language. The placeholders
 * below therefore show what each field would say if left empty, so a merchant
 * can see what they are replacing.
 *
 * The preview resolves text exactly as the storefront does — override, then
 * widget, then catalog — and draws it with the selected widget's real colours,
 * so what it shows is what a shopper sees.
 */
const FIELDS = [
    {
        key: 'header',
        label: 'Title',
        short: 'title',
        translationKey: 'header.locked',
        helpText: 'The big heading at the top of the popup.',
    },
    {
        key: 'button',
        label: 'Button',
        short: 'button',
        translationKey: 'button.submit',
        helpText: 'The button a customer presses to submit.',
    },
    {
        key: 'passcode_label',
        label: 'Passcode box — label',
        short: 'passcode label',
        translationKey: 'label.passcode',
        helpText: 'Shown above the passcode box.',
    },
    {
        key: 'passcode_placeholder',
        label: 'Passcode box — hint inside',
        short: 'passcode hint',
        translationKey: 'placeholder.code',
        helpText: 'The grey example text inside the empty box.',
    },
    {
        key: 'email_label',
        label: 'Email box — label',
        short: 'email label',
        translationKey: 'label.email',
        helpText: 'Shown above the email box.',
    },
    {
        key: 'email_placeholder',
        label: 'Email box — hint inside',
        short: 'email hint',
        translationKey: 'placeholder.email',
        helpText: 'The grey example text inside the empty box.',
    },
];

/** "title and button", "title, button and email label" — for the summary line. */
function joinNames(names) {
    if (names.length <= 1) return names[0] || '';
    if (names.length === 2) return `${names[0]} and ${names[1]}`;

    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export default function PopupTextModal({
    popupText = {},
    description = '',
    onChange,
    onDescriptionChange,
    groups = [],
    widget = null,
    storeLocales = [],
    primaryLocale = '',
}) {
    const [open, setOpen] = useState(false);
    const text = popupText || {};

    // Name what was changed rather than counting it: "you changed the title"
    // tells a merchant something, "1 field customised" does not.
    const changed = [
        ...(description.trim() ? ['message'] : []),
        ...FIELDS.filter((f) => (text[f.key] || '').trim() !== '').map((f) => f.short),
    ];

    // The design this lock is pointing at. Naming it is what makes the link
    // between the two sections visible.
    const widgetName = widget?.name ? String(widget.name).trim() : '';

    const setField = (key, value) => onChange({ ...text, [key]: value });

    return (
        <>
            {/* Matches the widget notice above it, so the pair reads as one
                idea: that one sets how the popup LOOKS, this one what it SAYS. */}
            <Box
                background="bg-surface-info"
                padding="300"
                borderRadius="200"
                borderColor="border-info"
                borderWidth="025"
            >
                <InlineStack gap="200" blockAlign="start" wrap={false}>
                    <Icon source={TextIcon} tone="info" />
                    <BlockStack gap="100">
                        <Text as="span" variant="bodySm" fontWeight="medium">
                            What the popup says
                        </Text>

                        {/* Name the design rather than saying "the design above":
                            the link between the two is the thing merchants miss,
                            and a name makes it concrete. */}
                        <Text as="p" variant="bodySm" tone="subdued">
                            {widgetName ? (
                                <>
                                    <Text as="span" variant="bodySm" fontWeight="medium" tone="base">
                                        {widgetName}
                                    </Text>{' '}
                                    above decides how this popup <em>looks</em>. Below you set what it <em>says</em> —
                                    for this lock only, without changing that design.
                                </>
                            ) : (
                                <>
                                    No design is selected, so the popup uses the default look. Below you set what it{' '}
                                    <em>says</em> — for this lock only.
                                </>
                            )}
                        </Text>

                        {widgetName ? (
                            <Text as="p" variant="bodySm" tone="subdued">
                                Other locks using {widgetName} keep their own wording.
                            </Text>
                        ) : null}
                    </BlockStack>
                </InlineStack>
            </Box>

            <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone={changed.length > 0 ? 'base' : 'subdued'}>
                    {changed.length > 0
                        ? `You changed the ${joinNames(changed)} on this lock.`
                        : 'Right now it uses the standard wording, translated into each customer’s language.'}
                </Text>
                <Button icon={EditIcon} onClick={() => setOpen(true)} fullWidth>
                    Edit wording and preview
                </Button>
            </BlockStack>

            <Modal id="lock-popup-text" open={open} variant="large">
                <TitleBar title="What the popup says">
                    {/* Plain button: TitleBar passes attributes straight to the
                        DOM, so `variant` warns. Matches Widgetsdashboard. */}
                    <button onClick={() => setOpen(false)}>
                        Done
                    </button>
                </TitleBar>

                <Box padding="400">
                    <InlineGrid columns={{ xs: 1, md: ['oneHalf', 'oneHalf'] }} gap="400">
                        <BlockStack gap="300">
                            <Text as="p" variant="bodySm" tone="subdued">
                                {widgetName
                                    ? `These words apply to this lock only. The colours and layout come from the ${widgetName} design and are not changed here.`
                                    : 'These words apply to this lock only.'}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                                Leave a box empty to keep the standard wording, which is translated into each
                                customer’s language automatically. Anything you type is shown to everyone exactly as
                                written, in every language.
                            </Text>
                            <FormLayout>
                                <TextField
                                    label="Message"
                                    value={description}
                                    onChange={onDescriptionChange}
                                    autoComplete="off"
                                    multiline={2}
                                    placeholder="Access restricted."
                                    helpText="The line under the title telling customers why this is locked."
                                />
                                {FIELDS.map((field) => (
                                    <TextField
                                        key={field.key}
                                        label={field.label}
                                        value={text[field.key] || ''}
                                        onChange={(v) => setField(field.key, v)}
                                        autoComplete="off"
                                        placeholder={translate(field.translationKey, 'en')}
                                        helpText={field.helpText}
                                    />
                                ))}
                            </FormLayout>

                            {changed.length > 0 ? (
                                <div>
                                    <Button
                                        variant="plain"
                                        tone="critical"
                                        onClick={() => {
                                            onChange({});
                                            onDescriptionChange('');
                                        }}
                                    >
                                        Undo my changes
                                    </Button>
                                </div>
                            ) : null}
                        </BlockStack>

                        <PopupPreview
                            text={text}
                            description={description}
                            groups={groups}
                            widget={widget}
                            storeLocales={storeLocales}
                            primaryLocale={primaryLocale}
                        />
                    </InlineGrid>
                </Box>
            </Modal>
        </>
    );
}

/**
 * What the shopper sees. Resolution mirrors the storefront exactly:
 * lock override → widget value → translated default.
 */
function PopupPreview({ text, description, groups, widget, storeLocales, primaryLocale }) {
    const widgetName = widget?.name ? String(widget.name).trim() : '';
    const design = widget?.configuration?.designOptions || {};
    const language = widget?.configuration?.language || null;

    const localeOptions = useMemo(() => {
        const codes = new Set(storeLocales.map((l) => normalizeLocale(l.locale)).filter(Boolean));
        if (codes.size === 0) codes.add('en');

        return Array.from(codes).map((code) => ({
            value: code,
            label: localeLabel(code, storeLocales.find((l) => normalizeLocale(l.locale) === code)?.name),
        }));
    }, [storeLocales]);

    const [locale, setLocale] = useState(() => preferredEditingLocale(language, storeLocales, primaryLocale));

    const copy = useMemo(() => {
        applyLanguageForPreview({ ...(language || {}), mode: 'auto' });

        return {
            ...resolvePopupCopy({ text, description, design, translate: (key) => translate(key, locale) }),
            rtl: isRTLLocale(locale),
        };
    }, [text, description, design, language, locale]);

    // Only the boxes this lock's conditions actually render, in order.
    const fields = useMemo(() => previewFields(groups), [groups]);

    const colors = design.colors || {};
    const cardColor = typeof colors.card === 'string' ? colors.card : '#ffffff';
    const textColor = typeof colors.text === 'string' ? colors.text : '#333333';
    const buttonBg = typeof colors.buttonBg === 'string' ? colors.buttonBg : '#15518C';
    const buttonText = typeof colors.buttonText === 'string' ? colors.buttonText : '#ffffff';
    const radius = `${design.layout?.cardBorderRadius || 12}px`;

    return (
        <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
                <Text as="span" variant="bodyMd" fontWeight="medium">
                    What customers will see
                </Text>
                {localeOptions.length > 1 ? (
                    <div style={{ minWidth: 180 }}>
                        <Select label="Language" labelHidden options={localeOptions} value={locale} onChange={setLocale} />
                    </div>
                ) : null}
            </InlineStack>

            <div
                style={{
                    background: '#5c5f62',
                    padding: '28px 20px',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'center',
                }}
            >
                <div
                    dir={copy.rtl ? 'rtl' : 'ltr'}
                    style={{
                        background: cardColor,
                        color: textColor,
                        borderRadius: radius,
                        padding: '28px 24px',
                        width: '100%',
                        maxWidth: 360,
                        fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
                        textAlign: copy.rtl ? 'right' : 'left',
                    }}
                >
                    <div style={{ fontSize: 20, fontWeight: 600, textAlign: 'center', marginBottom: 8 }}>
                        {copy.title}
                    </div>
                    <div style={{ fontSize: 14, opacity: 0.8, textAlign: 'center', marginBottom: 20 }}>
                        {copy.description}
                    </div>

                    {fields.length === 0 ? (
                        <div style={{ fontSize: 13, opacity: 0.7, textAlign: 'center', marginBottom: 16 }}>
                            Your conditions ask customers for nothing, so the popup shows no boxes — just the
                            message above.
                        </div>
                    ) : (
                        fields.map((field, i) => {
                            const label =
                                field.label ||
                                (field.kind === 'email'
                                    ? copy.emailLabel
                                    : field.kind === 'dob'
                                      ? copy.dobLabel
                                      : copy.passcodeLabel);
                            const placeholder =
                                field.kind === 'email'
                                    ? copy.emailPlaceholder
                                    : field.kind === 'dob'
                                      ? ''
                                      : copy.passcodePlaceholder;

                            return (
                                <div key={i} style={{ marginBottom: 14 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.85, marginBottom: 5 }}>
                                        {label}
                                    </div>
                                    <div
                                        style={{
                                            border: '2px solid #ddd',
                                            borderRadius: 8,
                                            padding: '12px 14px',
                                            fontSize: 14,
                                            color: '#8a8a8a',
                                            background: '#fff',
                                        }}
                                    >
                                        {placeholder || 'YYYY-MM-DD'}
                                    </div>
                                </div>
                            );
                        })
                    )}

                    <div
                        style={{
                            background: buttonBg,
                            color: buttonText,
                            borderRadius: 8,
                            padding: '14px',
                            textAlign: 'center',
                            fontWeight: 600,
                            marginTop: 4,
                        }}
                    >
                        {copy.button}
                    </div>
                </div>
            </div>

            <Text as="p" variant="bodySm" tone="subdued">
                {widgetName
                    ? `Boxes come from your conditions; colours and layout from the ${widgetName} design.`
                    : 'Boxes come from your conditions. No design is selected, so this shows the default look.'}
            </Text>
        </BlockStack>
    );
}
