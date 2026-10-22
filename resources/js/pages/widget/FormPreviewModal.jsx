import { BlockStack, Box, Select, Text, TextField } from '@shopify/polaris';
import { useCallback, useMemo, useState } from 'react';
import {
    applyLanguageForPreview,
    isRTLLocale,
    localeLabel,
    normalizeLocale,
    preferredEditingLocale,
    translate,
} from '../../lib/widgetLanguages';

// Helper function to convert HSB to Hex
const hsbToHex = (color) => {
    if (!color) return '#000000';
    // If it's already a string, return it
    if (typeof color === 'string') return color;

    const { hue = 0, saturation = 0, brightness = 0 } = color;

    const h = hue / 360;
    const s = saturation;
    const v = brightness;

    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;
        case 1:
            r = q;
            g = v;
            b = p;
            break;
        case 2:
            r = p;
            g = v;
            b = t;
            break;
        case 3:
            r = p;
            g = q;
            b = v;
            break;
        case 4:
            r = t;
            g = p;
            b = v;
            break;
        case 5:
            r = v;
            g = p;
            b = q;
            break;
        default:
            r = 0;
            g = 0;
            b = 0;
    }

    const toHex = (x) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Dummy preview fields to demonstrate the widget design. Labels come from
// the shared translation catalog so the preview matches the storefront.
const dummyPreviewFields = (text) => [
    { id: 'dummy-1', label: text.codeLabel, placeholder: text.codePlaceholder, type: 'text', required: true },
    { id: 'dummy-2', label: text.emailLabel, placeholder: text.emailPlaceholder, type: 'email', required: false },
];

// Scope CSS helper
const scopeCss = (css, scope) => {
    if (!css || typeof css !== 'string') return '';
    const prefix = (src) =>
        src.replace(/(^|})(\s*[^@}{][^{}]*)\{/g, (m, b, sel) => {
            const scoped = sel
                .split(',')
                .map((s) => `${scope} ${s.trim()}`)
                .join(', ');
            return `${b} ${scoped}{`;
        });
    return css
        .replace(/@media[^{]+\{([\s\S]*?)\}/g, (full, inner) => full.replace(inner, prefix(inner)))
        .replace(/(^|})(\s*[^@}{][^{}]*)\{/g, (m, b, sel) => {
            const scoped = sel
                .split(',')
                .map((s) => `${scope} ${s.trim()}`)
                .join(', ');
            return `${b} ${scoped}{`;
        });
};

const FormPreviewModal = ({
    formData,
    textData,
    formName,
    widgetType,
    onEdit,
    onClose,
    storeLocales = [],
    primaryLocale = '',
}) => {
    const language = (widgetType === 'text' ? textData?.language : formData?.language) || null;

    // Languages worth previewing: whatever the store publishes, plus any the
    // merchant wrote custom text for.
    const previewOptions = useMemo(() => {
        const codes = new Set(storeLocales.map((l) => normalizeLocale(l.locale)));
        Object.keys(language?.translations || {}).forEach((c) => codes.add(normalizeLocale(c)));
        if (language?.mode === 'fixed' && language.locale) codes.add(normalizeLocale(language.locale));
        if (codes.size === 0) codes.add('en');
        return Array.from(codes).map((code) => ({
            value: code,
            label: localeLabel(code, storeLocales.find((l) => normalizeLocale(l.locale) === code)?.name),
        }));
    }, [storeLocales, language]);

    const [previewLocale, setPreviewLocale] = useState(() =>
        preferredEditingLocale(language, storeLocales, primaryLocale),
    );

    const previewText = useMemo(() => {
        applyLanguageForPreview({ ...(language || {}), mode: 'auto' });
        const tr = (key) => translate(key, previewLocale);
        return {
            title: tr('header.locked'),
            description: tr('prompt.contact'),
            codeLabel: tr('label.passcode'),
            codePlaceholder: tr('placeholder.code'),
            emailLabel: tr('label.email'),
            emailPlaceholder: tr('placeholder.email'),
            submit: tr('button.submit'),
            rtl: isRTLLocale(previewLocale),
        };
    }, [language, previewLocale]);

    const localePicker =
        previewOptions.length > 1 ? (
            <div className="w-56">
                <Select
                    label="Preview language"
                    labelInline
                    options={previewOptions}
                    value={previewLocale}
                    onChange={setPreviewLocale}
                />
            </div>
        ) : null;

    // Get preview styles for Form Widget
    const getPreviewStyles = () => {
        if (!formData?.designOptions) {
            return {
                colors: {
                    text: '#333333',
                    card: '#ffffff',
                    buttonBg: '#3b82f6',
                    buttonText: '#ffffff',
                },
                layout: {
                    textAlignment: 'center',
                    verticalAlignment: 'top',
                    formPadding: '20',
                    borderRadius: '16',
                    cardPadding: '24',
                    cardBorderRadius: '12',
                    buttonText: 'Submit',
                },
            };
        }

        const { colors } = formData.designOptions;

        return {
            colors: {
                text: hsbToHex(colors.text),
                card: hsbToHex(colors.card),
                buttonBg: hsbToHex(colors.buttonBg),
                buttonText: hsbToHex(colors.buttonText),
            },
            layout: formData.designOptions.layout,
        };
    };

    const previewStyles = widgetType === 'text' ? {} : getPreviewStyles();

    const getAlignmentClasses = () => {
        return 'items-center justify-center';
    };

    // Render Logic
    if (widgetType === 'text') {
        const customCss = textData?.customCss || '';
        const textColor = hsbToHex(textData?.textColor);
        const bgColor = hsbToHex(textData?.backgroundColor);
        const borderRadius = textData?.borderRadius || 12;

        return (
            <Box padding="400">
                <div className="flex min-h-[400px] items-center justify-center bg-gray-50 p-4">
                    <div className="w-full max-w-2xl" id="access-widget-preview-modal">
                        <style>{scopeCss(customCss, '#access-widget-preview-modal')}</style>
                        <div className="mb-6">
                            <Text variant="headingLg" as="h1" className="access-widget-title">
                                {formName || 'Text Widget Preview'}
                            </Text>
                            <Text variant="bodyMd" tone="subdued" className="access-widget-description">
                                This is how your text widget will appear
                            </Text>
                            {localePicker && <div className="mt-3">{localePicker}</div>}
                        </div>

                        <div
                            className="shadow-2xl"
                            style={{
                                backgroundColor: bgColor,
                                padding: '24px',
                                borderRadius: `${borderRadius}px`,
                                minHeight: '200px',
                            }}
                        >
                            <div
                                style={{
                                    color: textColor,
                                    fontSize: '20px',
                                    lineHeight: '1.6',
                                    whiteSpace: 'pre-wrap',
                                    textAlign: 'center',
                                    fontWeight: '600',
                                    marginBottom: '12px',
                                }}
                            >
                                {previewText.title}
                            </div>
                            <div
                                style={{
                                    color: textColor,
                                    fontSize: '16px',
                                    lineHeight: '1.6',
                                    whiteSpace: 'pre-wrap',
                                    textAlign: 'center',
                                    opacity: 0.8,
                                }}
                            >
                                {previewText.description}
                            </div>
                        </div>
                    </div>
                </div>
            </Box>
        );
    }

    // Default: Form Widget Render — showing dummy fields with widget design
    const customCss = formData?.customCss || '';
    const buttonText = previewStyles.layout?.buttonText || previewText.submit;

    return (
        <Box padding="400">
            <div className="bg-gray-50 p-4">
                <div className="mx-auto max-w-4xl">
                    {/* Header */}
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <Text variant="headingLg" as="h1">
                                {formName || 'Widget Preview'}
                            </Text>
                            <Text variant="bodyMd" tone="subdued">
                                This is the widget design preview. Actual fields will be generated from lock conditions.
                            </Text>
                        </div>
                        {localePicker}
                    </div>

                    {/* Preview Container */}
                    <div
                        className={`relative flex min-h-96 flex-col overflow-hidden transition-all duration-300 ${getAlignmentClasses()}`}
                        id="access-widget-preview-modal"
                        style={{
                            padding: `${previewStyles.layout.cardPadding}px`,
                            borderRadius: `${previewStyles.layout.cardBorderRadius}px`,
                        }}
                    >
                        <style>{scopeCss(customCss, '#access-widget-preview-modal')}</style>
                        <div
                            className="relative z-10 w-full max-w-2xl shadow-xl access-widget-card"
                            style={{
                                backgroundColor: previewStyles.colors.card,
                                padding: `${previewStyles.layout.cardPadding}px`,
                                borderRadius: `${previewStyles.layout.cardBorderRadius}px`,
                            }}
                        >
                            <BlockStack gap="400">
                                <div
                                    className="access-widget-title"
                                    style={{
                                        color: previewStyles.colors.text,
                                        textAlign: 'center',
                                        fontSize: '20px',
                                        fontWeight: 600,
                                        marginBottom: '5px',
                                    }}
                                >
                                    {previewText.title}
                                </div>
                                <div
                                    className="access-widget-description"
                                    style={{
                                        color: previewStyles.colors.text,
                                        textAlign: 'center',
                                        opacity: 0.85,
                                        marginBottom: '20px',
                                        fontSize: '15px',
                                    }}
                                >
                                    {previewText.description}
                                </div>
                                {/* Dummy Preview Fields */}
                                {dummyPreviewFields(previewText).map((field) => (
                                    <div key={field.id}>
                                        <label
                                            className="access-widget-label"
                                            style={{
                                                color: previewStyles.colors.text,
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                display: 'block',
                                                marginBottom: '4px',
                                            }}
                                        >
                                            {field.label}
                                            {field.required && <span className="ml-1 text-red-500">*</span>}
                                        </label>
                                        <input
                                            className="access-widget-input"
                                            type={field.type}
                                            placeholder={field.placeholder}
                                            disabled
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                border: '1px solid #ccc',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                backgroundColor: '#fafafa',
                                                color: previewStyles.colors.text,
                                                boxSizing: 'border-box',
                                            }}
                                        />
                                    </div>
                                ))}

                                <div className="pt-2">
                                    <button
                                        className="w-full cursor-pointer border-0 py-3 text-sm font-semibold shadow-md transition-all duration-200 hover:opacity-90 hover:shadow-lg access-widget-button"
                                        style={{
                                            backgroundColor: previewStyles.colors.buttonBg,
                                            color: previewStyles.colors.buttonText,
                                            borderRadius: `${Math.min(parseInt(previewStyles.layout.cardBorderRadius), 8)}px`,
                                        }}
                                    >
                                        {buttonText}
                                    </button>
                                </div>
                            </BlockStack>
                        </div>
                    </div>
                </div>
            </div>
        </Box>
    );
};

export default FormPreviewModal;
