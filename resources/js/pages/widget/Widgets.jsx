import { useForm } from '@inertiajs/react';
import { Badge, Banner, BlockStack, Box, Button, Card, ColorPicker, Divider, Icon, InlineStack, Modal, Popover, PortalsManager, Select, Text, TextField } from '@shopify/polaris';
import {
    DeleteIcon,
    ResetIcon,
    SettingsIcon,
    ViewIcon,
} from '@shopify/polaris-icons';
import '@shopify/polaris/build/esm/styles.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LanguageSettings from '../../components/widget/LanguageSettings';
import {
    DEFAULT_LANGUAGE_SETTINGS,
    applyLanguageForPreview,
    isRTLLocale,
    normalizeLocale,
    preferredEditingLocale,
    pruneTranslations,
    translate,
} from '../../lib/widgetLanguages';

// Color conversion utilities
const hsbToHex = (hsb) => {
    const rgb = hsbToRgb(hsb);
    const toHex = (c) => {
        const hex = Math.round(c * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(rgb.red)}${toHex(rgb.green)}${toHex(rgb.blue)}`;
};

const hexToHsb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
        return rgbToHsb({
            red: parseInt(result[1], 16) / 255,
            green: parseInt(result[2], 16) / 255,
            blue: parseInt(result[3], 16) / 255,
        });
    }
    return { hue: 0, saturation: 0, brightness: 1 };
};

const hsbToRgb = (hsb) => {
    const { hue, saturation, brightness } = hsb;
    const hi = Math.floor(hue / 60) % 6;
    const f = hue / 60 - Math.floor(hue / 60);
    const p = brightness * (1 - saturation);
    const q = brightness * (1 - f * saturation);
    const t = brightness * (1 - (1 - f) * saturation);

    let red, green, blue;
    switch (hi) {
        case 0:
            red = brightness;
            green = t;
            blue = p;
            break;
        case 1:
            red = q;
            green = brightness;
            blue = p;
            break;
        case 2:
            red = p;
            green = brightness;
            blue = t;
            break;
        case 3:
            red = p;
            green = q;
            blue = brightness;
            break;
        case 4:
            red = t;
            green = p;
            blue = brightness;
            break;
        case 5:
            red = brightness;
            green = p;
            blue = q;
            break;
        default:
            red = 0;
            green = 0;
            blue = 0;
    }
    return { red, green, blue };
};

const rgbToHsb = ({ red, green, blue }) => {
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const brightness = max;
    const saturation = max === 0 ? 0 : (max - min) / max;
    let hue = 0;

    if (max !== min) {
        switch (max) {
            case red:
                hue = ((green - blue) / (max - min)) * 60;
                if (hue < 0) hue += 360;
                break;
            case green:
                hue = ((blue - red) / (max - min)) * 60 + 120;
                break;
            case blue:
                hue = ((red - green) / (max - min)) * 60 + 240;
                break;
        }
    }
    return { hue, saturation, brightness };
};

// Naive CSS scoping helper for preview (handles top-level rules and simple @media blocks)
const scopeCss = (css, scope) => {
    if (!css || typeof css !== 'string') return '';
    const prefixSelectors = (src) =>
        src.replace(/(^|})(\s*[^@}{][^{}]*)\{/g, (m, brace, selectors) => {
            const scoped = selectors
                .split(',')
                .map((s) => `${scope} ${s.trim()}`)
                .join(', ');
            return `${brace} ${scoped}{`;
        });
    // Handle @media blocks by prefixing their inner rules
    return css.replace(/@media[^{]+\{([\s\S]*?)\}/g, (full, inner) => {
        const scopedInner = prefixSelectors(inner);
        return full.replace(inner, scopedInner);
    }).replace(/(^|})(\s*[^@}{][^{}]*)\{/g, (m, b, s) => {
        const scoped = s.split(',').map((sel) => `${scope} ${sel.trim()}`).join(', ');
        return `${b} ${scoped}{`;
    });
};

// Constants
const ALIGNMENT_OPTIONS = [
    { label: 'Left', value: 'left' },
    { label: 'Center', value: 'center' },
    { label: 'Right', value: 'right' },
];

const VERTICAL_ALIGNMENT_OPTIONS = [
    { label: 'Top', value: 'top' },
    { label: 'Middle', value: 'middle' },
    { label: 'Bottom', value: 'bottom' },
];

const BACKGROUND_POSITION_OPTIONS = [
    { label: 'Center', value: 'center' },
    { label: 'Top', value: 'top' },
    { label: 'Bottom', value: 'bottom' },
];

const BACKGROUND_SIZE_OPTIONS = [
    { label: 'Cover', value: 'cover' },
    { label: 'Contain', value: 'contain' },
];

const defaultDesignOptions = {
    colors: {
        text: { hue: 0, saturation: 0, brightness: 0.2 },
        card: { hue: 0, saturation: 0, brightness: 1 },
        buttonBg: { hue: 210, saturation: 0.85, brightness: 0.55 },
        buttonText: { hue: 0, saturation: 0, brightness: 1 },
    },
    layout: {
        textAlignment: 'center',
        verticalAlignment: 'top',
        formPadding: '10',
        borderRadius: '16',
        cardPadding: '10',
        cardBorderRadius: '12',
        // Left empty on purpose: an empty button label falls through to the
        // translated default, so the button reads correctly in every
        // storefront language. Typing here pins one word for all languages.
        buttonText: '',
    },
};

// Preset color palettes (text, card, buttonBg, buttonText)
const COLOR_PALETTES = [
    {
        key: 'classic-dark',
        label: 'Classic Dark',
        colors: { text: '#FFFFFF', card: '#6B7280', buttonBg: '#000000', buttonText: '#FFFFFF' },
    },
    {
        key: 'midnight-orchid',
        label: 'Midnight Orchid',
        colors: { text: '#15173D', card: '#E491C9', buttonBg: '#982598', buttonText: '#F1E9E9' },
    },
    {
        key: 'minimal-light',
        label: 'Minimal Light',
        colors: { text: '#222222', card: '#FFFFFF', buttonBg: '#3B82F6', buttonText: '#FFFFFF' },
    },
    {
        key: 'sunset',
        label: 'Vibrant Sunset',
        colors: { text: '#2D1B69', card: '#FFF2E5', buttonBg: '#FF6B00', buttonText: '#FFFFFF' },
    },
    {
        key: 'emerald',
        label: 'Emerald',
        colors: { text: '#0F3D2E', card: '#E8FFF5', buttonBg: '#10B981', buttonText: '#FFFFFF' },
    },
    {
        key: 'ocean-blue',
        label: 'Ocean Blue',
        colors: { text: '#0A2540', card: '#E6F4FF', buttonBg: '#1E88E5', buttonText: '#FFFFFF' },
    },
];

// Dummy preview fields — shown in Live Preview to demonstrate design
// Sample fields for the preview. Labels/placeholders come from the same
// translation catalog the storefront uses, so switching preview language
// shows what customers in that language will actually read.
const dummyPreviewFields = (text) => [
    { id: 'dummy-1', label: text.codeLabel, placeholder: text.codePlaceholder, type: 'text', required: true },
    { id: 'dummy-2', label: text.emailLabel, placeholder: text.emailPlaceholder, type: 'email', required: false },
];

// Color Input Component
const ColorInput = ({ label, colorKey, value, onChange, active, onToggle, onClose }) => {
    const activator = (
        <div className="inline-block">
            <Button onClick={onToggle} disclosure={active ? 'up' : 'down'} size="slim">
                <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded border border-gray-300 shadow-sm" style={{ backgroundColor: hsbToHex(value) }} />
                    <span className="text-xs font-medium">{label}</span>
                </div>
            </Button>
        </div>
    );

    return (
        <Popover
            active={active}
            activator={activator}
            onClose={onClose}
            autofocusTarget="first-node"
            preferredAlignment="left"
            preferredPosition="below"
            zIndexOverride={60000}
        >
            <div className="p-2">
                <BlockStack gap="200">
                    <Text variant="bodySm" fontWeight="semibold">
                        {label} Color
                    </Text>
                    <ColorPicker color={value} onChange={onChange} />
                    <TextField
                        label="Hex"
                        labelHidden
                        value={hsbToHex(value)}
                        onChange={(newValue) => {
                            if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
                                onChange(hexToHsb(newValue));
                            }
                        }}
                        autoComplete="off"
                        prefix="#"
                        maxLength={7}
                    />
                </BlockStack>
            </div>
        </Popover>
    );
};

const Widgets = ({
    onSubmit,
    onCancel,
    initialFormData = null,
    submitRoute = '/forms/save',
    formTitle = 'Dynamic Form Builder',
    isCreating = false,
    storeLocales = [],
    primaryLocale = '',
    onRefreshStoreLocales,
    refreshingLocales = false,
}) => {
    const [designOptions, setDesignOptions] = useState(() => {
        if (initialFormData?.designOptions) {
            const initialColors = initialFormData.designOptions.colors;
            const convertedColors = {};

            // Iterate and convert if string
            if (initialColors) {
                Object.keys(initialColors).forEach((key) => {
                    const color = initialColors[key];
                    convertedColors[key] = typeof color === 'string' ? hexToHsb(color) : color;
                });
            }

            return {
                ...initialFormData.designOptions,
                colors: {
                    ...initialFormData.designOptions.colors,
                    ...convertedColors,
                },
            };
        }
        return defaultDesignOptions;
    });
    const [customCss, setCustomCss] = useState(initialFormData?.customCss || '');
    const [colorPopovers, setColorPopovers] = useState({
        text: false,
        background: false,
        card: false,
        buttonBg: false,
        buttonText: false,
    });
    const [resetModalOpen, setResetModalOpen] = useState(false);
    const [selectedPalette, setSelectedPalette] = useState('');
    const [language, setLanguage] = useState(() => ({
        ...DEFAULT_LANGUAGE_SETTINGS,
        ...(initialFormData?.language || {}),
    }));
    const [previewLocale, setPreviewLocale] = useState(() =>
        preferredEditingLocale(initialFormData?.language, storeLocales, primaryLocale),
    );
    const portalContainerRef = useRef(null);
    const [portalContainer, setPortalContainer] = useState(null);

    useEffect(() => {
        if (portalContainerRef.current) {
            setPortalContainer(portalContainerRef.current);
        }
    }, []);

    const colorsToHex = useCallback(
        (colors) => ({
            text: hsbToHex(colors.text),
            card: hsbToHex(colors.card),
            buttonBg: hsbToHex(colors.buttonBg),
            buttonText: hsbToHex(colors.buttonText),
        }),
        [],
    );

    const getSubmitData = useCallback(
        () => ({
            designOptions: {
                colors: colorsToHex(designOptions.colors),
                layout: designOptions.layout,
            },
            customCss: customCss || '',
            language: {
                mode: language.mode === 'fixed' ? 'fixed' : 'auto',
                locale: language.mode === 'fixed' ? normalizeLocale(language.locale) : '',
                translations: pruneTranslations(language.translations),
            },
        }),
        [designOptions, colorsToHex, customCss, language],
    );

    const { data, setData, post, processing, errors } = useForm({
        designOptions: designOptions,
    });

    useEffect(() => {
        setData(getSubmitData());
    }, [getSubmitData]);

    // Design options functions
    const updateColor = useCallback((colorKey, value) => {
        setDesignOptions((prev) => ({
            ...prev,
            colors: { ...prev.colors, [colorKey]: value },
        }));
    }, []);

    const updateLayout = useCallback((key, value) => {
        setDesignOptions((prev) => ({
            ...prev,
            layout: { ...prev.layout, [key]: value },
        }));
    }, []);

    const toggleColorPopover = useCallback((colorKey) => {
        setColorPopovers((prev) => {
            const newState = { text: false, background: false, card: false, buttonBg: false, buttonText: false };
            newState[colorKey] = !prev[colorKey];
            return newState;
        });
    }, []);

    const closeColorPopover = useCallback((colorKey) => {
        setColorPopovers((prev) => ({
            ...prev,
            [colorKey]: false,
        }));
    }, []);

    const handleImageUpload = useCallback(() => { }, []);
    const removeBackgroundImage = useCallback(() => { }, []);

    const handleReset = useCallback(() => {
        setDesignOptions(defaultDesignOptions);
        setResetModalOpen(false);
        setSelectedPalette('');
        setCustomCss('');
        setLanguage({ ...DEFAULT_LANGUAGE_SETTINGS });
    }, []);

    const handleSubmit = useCallback(() => {
        if (onSubmit) {
            onSubmit(getSubmitData());
        } else {
            post(submitRoute);
        }
    }, [getSubmitData, onSubmit, post, submitRoute]);

    // Preview copy runs through the same translation runtime the storefront
    // uses, with this widget's overrides applied, so the preview matches.
    const previewText = useMemo(() => {
        applyLanguageForPreview({ ...language, mode: 'auto' });
        const tr = (key, vars) => translate(key, previewLocale, vars);
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

    const previewStyles = useMemo(
        () => ({
            colors: colorsToHex(designOptions.colors),
            layout: {
                cardPadding: designOptions.layout.cardPadding,
                cardBorderRadius: designOptions.layout.cardBorderRadius,
                buttonText: designOptions.layout.buttonText || previewText.submit,
            },
        }),
        [designOptions, colorsToHex, previewText],
    );

    const getAlignmentClasses = () => {
        return 'items-center justify-center';
    };

    return (
        <div ref={portalContainerRef} className="flex h-full flex-col bg-gray-100">
            <PortalsManager container={portalContainer}>
                {/* Sticky Header */}
                <div className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
                    <Box padding="400">
                        <InlineStack align="space-between" blockAlign="center" wrap={false}>
                            <InlineStack gap="400" blockAlign="center">
                                <Text variant="headingLg" as="h1">
                                    {formTitle}
                                </Text>
                                <Badge tone="info">Design Only</Badge>
                            </InlineStack>
                            <InlineStack gap="300">
                                {/* <Button onClick={onCancel} variant="secondary" disabled={processing || isCreating}>
                                    Cancel
                                </Button> */}
                                <Button onClick={() => setResetModalOpen(true)} icon={ResetIcon} tone="critical" variant="secondary" disabled={processing || isCreating}>
                                    Reset
                                </Button>
                                <Button variant="primary" onClick={handleSubmit} loading={processing || isCreating}>
                                    Save Form
                                </Button>
                            </InlineStack>
                        </InlineStack>
                    </Box>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-auto">
                    <Box padding="400">
                        <div className="grid grid-cols-12 gap-4 pb-8">
                            {/* Left Column: Design Options */}
                            <div className="col-span-12 lg:col-span-8">
                                <div className="flex h-full flex-col">
                                    {/* <BlockStack gap="300">
                                        <div className="flex items-center justify-between">
                                            <Text variant="headingSm" as="h2">
                                                <div className="flex gap-2">
                                                    <Icon source={SettingsIcon} />
                                                    Design Options
                                                </div>
                                            </Text>
                                        </div>
                                        <Divider />
                                    </BlockStack> */}

                                    <Card>
                                        <BlockStack gap="300">
                                            {/* Color Palettes */}
                                            <BlockStack gap="200">
                                                <InlineStack gap="200" blockAlign="center">
                                                    <Text variant="headingXs" as="h4">Color Palettes</Text>
                                                    <Badge tone="info" size="small">Basic</Badge>
                                                </InlineStack>
                                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                                    {COLOR_PALETTES.map((p) => (
                                                        <button
                                                            key={p.key}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedPalette(p.key);
                                                                const { text, card, buttonBg, buttonText } = p.colors;
                                                                updateColor('text', hexToHsb(text));
                                                                updateColor('card', hexToHsb(card));
                                                                updateColor('buttonBg', hexToHsb(buttonBg));
                                                                updateColor('buttonText', hexToHsb(buttonText));
                                                            }}
                                                            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition hover:border-blue-400 ${selectedPalette === p.key ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-200'}`}
                                                        >
                                                            <span className="text-sm font-medium">{p.label}</span>
                                                            <span className="flex items-center gap-1">
                                                                <span className="h-4 w-4 rounded border border-gray-300" style={{ backgroundColor: p.colors.text }} />
                                                                <span className="h-4 w-4 rounded border border-gray-300" style={{ backgroundColor: p.colors.card }} />
                                                                <span className="h-4 w-4 rounded border border-gray-300" style={{ backgroundColor: p.colors.buttonBg }} />
                                                                <span className="h-4 w-4 rounded border border-gray-300" style={{ backgroundColor: p.colors.buttonText }} />
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </BlockStack>
                                            <Divider />
                                            {/* Colors */}
                                            <BlockStack gap="200">
                                                <InlineStack gap="200" blockAlign="center">
                                                    <Text variant="headingXs" as="h4">Colors</Text>
                                                    <Badge tone="info" size="small">Basic</Badge>
                                                </InlineStack>
                                                <div className="flex flex-wrap gap-2">
                                                    <ColorInput
                                                        label="Text"
                                                        colorKey="text"
                                                        value={designOptions.colors.text}
                                                        onChange={(color) => updateColor('text', color)}
                                                        active={colorPopovers.text}
                                                        onToggle={() => toggleColorPopover('text')}
                                                        onClose={() => closeColorPopover('text')}
                                                    />
                                                    <ColorInput
                                                        label="Card"
                                                        colorKey="card"
                                                        value={designOptions.colors.card}
                                                        onChange={(color) => updateColor('card', color)}
                                                        active={colorPopovers.card}
                                                        onToggle={() => toggleColorPopover('card')}
                                                        onClose={() => closeColorPopover('card')}
                                                    />
                                                    <ColorInput
                                                        label="Button BG"
                                                        colorKey="buttonBg"
                                                        value={designOptions.colors.buttonBg}
                                                        onChange={(color) => updateColor('buttonBg', color)}
                                                        active={colorPopovers.buttonBg}
                                                        onToggle={() => toggleColorPopover('buttonBg')}
                                                        onClose={() => closeColorPopover('buttonBg')}
                                                    />
                                                    <ColorInput
                                                        label="Button Text"
                                                        colorKey="buttonText"
                                                        value={designOptions.colors.buttonText}
                                                        onChange={(color) => updateColor('buttonText', color)}
                                                        active={colorPopovers.buttonText}
                                                        onToggle={() => toggleColorPopover('buttonText')}
                                                        onClose={() => closeColorPopover('buttonText')}
                                                    />
                                                </div>
                                            </BlockStack>
                                            <Divider />
                                            {/* Style */}
                                            <BlockStack gap="200">
                                                <InlineStack gap="200" blockAlign="center">
                                                    <Text variant="headingXs" as="h4">Style</Text>
                                                </InlineStack>
                                                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                                                    <Box>
                                                        <Text variant="bodySm" tone="subdued">
                                                            Card Pad
                                                        </Text>
                                                        <div className="mt-1">
                                                            <TextField label="Card padding" labelHidden type="number" value={designOptions.layout.cardPadding} onChange={(value) => updateLayout('cardPadding', value)} autoComplete="off" min="8" max="48" suffix="px" />
                                                        </div>
                                                    </Box>
                                                    <Box>
                                                        <Text variant="bodySm" tone="subdued">
                                                            Card Rad
                                                        </Text>
                                                        <div className="mt-1">
                                                            <TextField type="number" label="Card border radius" labelHidden value={designOptions.layout.cardBorderRadius} onChange={(value) => updateLayout('cardBorderRadius', value)} autoComplete="off" min="0" max="24" suffix="px" />
                                                        </div>
                                                    </Box>
                                                    <Box>
                                                        <Text variant="bodySm" tone="subdued">
                                                            Button Text
                                                        </Text>
                                                        <div className="mt-1">
                                                            <TextField label="Button Text" labelHidden value={designOptions.layout.buttonText || ''} onChange={(value) => updateLayout('buttonText', value)} autoComplete="off" placeholder={previewText.submit} helpText="Leave blank to use the translated default." />
                                                        </div>
                                                    </Box>
                                                </div>
                                            </BlockStack>
                                            <Divider />
                                            {/* Language */}
                                            <LanguageSettings
                                                language={language}
                                                onChange={setLanguage}
                                                storeLocales={storeLocales}
                                                primaryLocale={primaryLocale}
                                                previewLocale={previewLocale}
                                                onPreviewLocaleChange={setPreviewLocale}
                                                onRefreshStoreLocales={onRefreshStoreLocales}
                                                refreshing={refreshingLocales}
                                            />
                                            <Divider />
                                            {/* Custom CSS */}
                                            <BlockStack gap="200">
                                                <InlineStack gap="200" blockAlign="center">
                                                    <Text variant="headingXs" as="h4">Custom CSS</Text>
                                                </InlineStack>
                                                <div>
                                                    <textarea
                                                        value={customCss}
                                                        onChange={(e) => setCustomCss(e.target.value)}
                                                        placeholder=".access-lock-modal { /* your css */ }"
                                                        className="w-full min-h-40 rounded border border-gray-300 p-2 font-mono text-xs"
                                                    />
                                                </div>
                                            </BlockStack>
                                        </BlockStack>
                                    </Card>

                                </div>
                            </div>

                            {/* Right Column: Live Preview */}
                            <div className="col-span-12 lg:sticky lg:top-0 lg:col-span-4 lg:self-start">
                                <Card>
                                    <BlockStack gap="300">
                                        <div className="flex items-center justify-between">
                                            <Text variant="headingSm" as="h2">
                                                <div className="flex items-center gap-2">
                                                    <Icon source={ViewIcon} />
                                                    Live Preview
                                                </div>
                                            </Text>
                                            <InlineStack gap="200">
                                                <Badge tone="attention" size="small">
                                                    Sample Fields
                                                </Badge>
                                                <Badge tone="success" size="small">
                                                    Live
                                                </Badge>
                                            </InlineStack>
                                        </div>

                                        <Text variant="bodySm" tone="subdued">
                                            Actual fields will be auto-generated from lock conditions
                                        </Text>

                                        <Divider />

                                        {/* Preview Container */}
                                        <div
                                            className={`p-4 bg-gray-100 rounded-md relative flex min-h-80 flex-col overflow-hidden transition-all duration-300 ${getAlignmentClasses()}`}
                                            id="access-widget-preview"
                                        >
                                            <style>{scopeCss(customCss, '#access-widget-preview')}</style>
                                            <div
                                                className="relative z-10 w-full max-w-md shadow-2xl access-widget-card"
                                                dir={previewText.rtl ? 'rtl' : 'ltr'}
                                                lang={previewLocale}
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
                                                                type={field.type}
                                                                className="access-widget-input"
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
                                                                borderRadius: '8px',
                                                            }}
                                                        >
                                                            {previewStyles.layout.buttonText}
                                                        </button>
                                                    </div>
                                                </BlockStack>
                                            </div>
                                        </div>

                                        {/* Design Summary */}
                                        <div className="rounded-lg bg-gray-100 p-4">
                                            <Text variant="headingXs" as="h4">
                                                Design Summary
                                            </Text>
                                            <div className="mt-3 space-y-3">
                                                <div>
                                                    <Text variant="bodySm" tone="subdued">
                                                        Color Palette
                                                    </Text>
                                                    <div className="mt-2 flex gap-2">
                                                        {Object.entries(previewStyles.colors).map(([key, color]) => (
                                                            <div key={key} className="group relative">
                                                                <div
                                                                    className="h-6 w-6 cursor-pointer rounded-md border-2 border-white shadow-md transition-transform hover:scale-110"
                                                                    style={{ backgroundColor: color }}
                                                                    title={`${key}: ${color}`}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                            </div>
                                        </div>
                                    </BlockStack>
                                </Card>
                            </div>
                        </div>
                    </Box>
                </div>

                {/* Reset Confirmation Modal */}
                <Modal
                    open={resetModalOpen}
                    onClose={() => setResetModalOpen(false)}
                    title="Reset Design?"
                    primaryAction={{
                        content: 'Reset All',
                        destructive: true,
                        onAction: handleReset,
                    }}
                    secondaryActions={[
                        {
                            content: 'Cancel',
                            onAction: () => setResetModalOpen(false),
                        },
                    ]}
                >
                    <Modal.Section>
                        <BlockStack gap="400">
                            <Banner tone="warning">This action will reset all design options to their default values.</Banner>
                            <Text>
                                All your current changes including colors and layout settings will be permanently lost. This action
                                cannot be undone.
                            </Text>
                        </BlockStack>
                    </Modal.Section>
                </Modal>
            </PortalsManager>
        </div>
    );
};

export default Widgets;
