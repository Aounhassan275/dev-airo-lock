import { Icon, Badge, BlockStack, Box, Button, ColorPicker, Divider, InlineStack, Text, TextField, Card } from '@shopify/polaris';
import {
    DeleteIcon,
    ResetIcon,
    SettingsIcon,
    ViewIcon
} from '@shopify/polaris-icons';
import { useCallback, useMemo, useState, useEffect } from 'react';
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

// Helper function to convert HSB to Hex
const hsbToHex = (hsb) => {
    if (!hsb || typeof hsb !== 'object') return '#ffffff';

    const { hue = 0, saturation = 0, brightness = 1 } = hsb;
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

const hexToHsb = (hex) => {
    const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!res) return { hue: 0, saturation: 0, brightness: 1 };
    const r = parseInt(res[1], 16) / 255;
    const g = parseInt(res[2], 16) / 255;
    const b = parseInt(res[3], 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const brightness = max;
    const saturation = max === 0 ? 0 : (max - min) / max;
    let hue = 0;
    if (max !== min) {
        switch (max) {
            case r:
                hue = ((g - b) / (max - min)) * 60;
                if (hue < 0) hue += 360;
                break;
            case g:
                hue = ((b - r) / (max - min)) * 60 + 120;
                break;
            case b:
                hue = ((r - g) / (max - min)) * 60 + 240;
                break;
        }
    }
    return { hue, saturation, brightness };
};

const COLOR_PALETTES = [
    { key: 'classic-dark', label: 'Classic Dark', colors: { text: '#FFFFFF', card: '#000000' } },
    { key: 'minimal-light', label: 'Minimal Light', colors: { text: '#222222', card: '#FFFFFF' } },
    { key: 'vibrant-sunset', label: 'Vibrant Sunset', colors: { text: '#2D1B69', card: '#FFF2E5' } },
    { key: 'emerald', label: 'Emerald', colors: { text: '#0F3D2E', card: '#E8FFF5' } },
    { key: 'ocean-blue', label: 'Ocean Blue', colors: { text: '#0A2540', card: '#E6F4FF' } },
    { key: 'midnight-orchid', label: 'Midnight Orchid', colors: { text: '#15173D', card: '#E491C9' } },
];

const ColorPickerButton = ({ label, color, onChange, active, onToggle, onClose }) => (
    <div className="flex flex-col gap-2">
        <button
            type="button"
            onClick={onToggle}
            className={`flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${active ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:border-gray-300'
                } bg-white`}
        >
            <div className="h-8 w-8 shrink-0 rounded-md border border-gray-300 shadow-sm" style={{ backgroundColor: hsbToHex(color) }} />
            <div className="flex flex-col items-start">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <span className="text-xs text-gray-500">{hsbToHex(color).toUpperCase()}</span>
            </div>
        </button>
        {active && (
            <div className="animate-in fade-in zoom-in-95 rounded-lg border border-gray-200 bg-gray-50 p-4 duration-200">
                <ColorPicker onChange={onChange} color={color} />
            </div>
        )}
    </div>
);

export default function TextWidget({
    onSubmit,
    onCancel,
    initialData,
    isCreating = false,
    widgetName = 'Text Widget',
    storeLocales = [],
    primaryLocale = '',
    onRefreshStoreLocales,
    refreshingLocales = false,
}) {
    // Design-only state — no content field (system auto-generates text based on conditions)
    const [borderRadius, setBorderRadius] = useState(initialData?.borderRadius || 12);
    const [cardPadding, setCardPadding] = useState(initialData?.cardPadding || 24);
    const [textColor, setTextColor] = useState(initialData?.textColor || { hue: 0, saturation: 0, brightness: 0.2 });
    const [backgroundColor, setBackgroundColor] = useState(initialData?.backgroundColor || { hue: 0, saturation: 0, brightness: 0.96 });
    const [customCss, setCustomCss] = useState(initialData?.customCss || '');
    const [selectedPalette, setSelectedPalette] = useState('');
    const [language, setLanguage] = useState(() => ({
        ...DEFAULT_LANGUAGE_SETTINGS,
        ...(initialData?.language || {}),
    }));
    const [previewLocale, setPreviewLocale] = useState(() =>
        preferredEditingLocale(initialData?.language, storeLocales, primaryLocale),
    );

    // Preview strings resolve through the same runtime the storefront uses,
    // with this widget's overrides applied, so what's shown here is what
    // ships.
    const previewText = useMemo(() => {
        applyLanguageForPreview({ ...language, mode: 'auto' });
        return {
            title: translate('header.locked', previewLocale),
            description: translate('prompt.contact', previewLocale),
            rtl: isRTLLocale(previewLocale),
        };
    }, [language, previewLocale]);

    // Color picker popover state
    const [activeColorPicker, setActiveColorPicker] = useState(null);

    const toggleColorPicker = useCallback((picker) => {
        setActiveColorPicker((current) => (current === picker ? null : picker));
    }, []);

    const closeColorPicker = useCallback(() => {
        setActiveColorPicker(null);
    }, []);

    // Preview styles
    const previewStyles = useMemo(
        () => ({
            container: {
                backgroundColor: hsbToHex(backgroundColor),
                padding: `${cardPadding}px`,
                borderRadius: `${borderRadius}px`,
                minHeight: '200px',
            },
            content: {
                color: hsbToHex(textColor),
                fontSize: '16px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
            },
            colors: {
                text: hsbToHex(textColor),
                card: hsbToHex(backgroundColor),
            },
        }),
        [borderRadius, cardPadding, textColor, backgroundColor],
    );

    const handleSubmit = useCallback(() => {
        const widgetData = {
            borderRadius,
            cardPadding,
            textColor,
            backgroundColor,
            customCss,
            language: {
                mode: language.mode === 'fixed' ? 'fixed' : 'auto',
                locale: language.mode === 'fixed' ? normalizeLocale(language.locale) : '',
                translations: pruneTranslations(language.translations),
            },
        };
        onSubmit(widgetData);
    }, [borderRadius, cardPadding, textColor, backgroundColor, customCss, language, onSubmit]);

    const handleReset = useCallback(() => {
        setTextColor({ hue: 0, saturation: 0, brightness: 0 });
        setBackgroundColor({ hue: 0, saturation: 0, brightness: 1 });
        setBorderRadius(12);
        setCardPadding(24);
        setCustomCss('');
        setSelectedPalette('');
        setActiveColorPicker(null);
        setLanguage({ ...DEFAULT_LANGUAGE_SETTINGS });
    }, []);

    return (
        <div className="h-full bg-gray-100 flex flex-col">
            {/* Sticky Header to match Form editor */}
            <div className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
                <Box padding="400">
                    <InlineStack align="space-between" blockAlign="center" wrap={false}>
                        <InlineStack gap="400" blockAlign="center">
                            <Text variant="headingLg" as="h1">
                                Edit: {widgetName}
                            </Text>
                            <Badge tone="info">Design Only</Badge>
                        </InlineStack>
                        <InlineStack gap="300">
                            {/* <Button onClick={onCancel} variant="secondary" disabled={isCreating}>
                                Cancel
                            </Button> */}
                            <Button onClick={handleReset} icon={ResetIcon} tone="critical" variant="secondary" disabled={isCreating}>
                                Reset
                            </Button>
                            <Button variant="primary" onClick={handleSubmit} disabled={isCreating} loading={isCreating}>
                                Save Widget
                            </Button>
                        </InlineStack>
                    </InlineStack>
                </Box>
            </div>

            <div className="p-4">
                <div className="flex h-full gap-4">
                    {/* Left Panel - Design Settings */}
                    <div className="w-2/3 shrink-0 overflow-y-auto">
                        <Card>
                            <BlockStack gap="300">
                                {/* Color Palettes */}
                                <BlockStack gap="300">
                                    <Text variant="headingMd" as="h2">
                                        Color Palettes <Badge tone="info" size="small">Basic</Badge>
                                    </Text>
                                    <Divider />
                                    <div className="grid grid-cols-3 gap-2">
                                        {COLOR_PALETTES.map((p) => (
                                            <button
                                                key={p.key}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedPalette(p.key);
                                                    const { text, card } = p.colors;
                                                    setTextColor(hexToHsb(text));
                                                    setBackgroundColor(hexToHsb(card));
                                                }}
                                                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition hover:border-blue-400 ${selectedPalette === p.key ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-200'}`}
                                            >
                                                <span className="text-sm font-medium">{p.label}</span>
                                                <span className="flex items-center gap-1">
                                                    <span className="h-4 w-4 rounded border border-gray-300" style={{ backgroundColor: p.colors.text }} />
                                                    <span className="h-4 w-4 rounded border border-gray-300" style={{ backgroundColor: p.colors.card }} />
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </BlockStack>
                                <Divider />
                                {/* Colors Section */}
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">
                                        Colors <Badge tone="info" size="small">Basic</Badge>
                                    </Text>
                                    <Divider />
                                    <div className="grid grid-cols-2 gap-2">
                                        <ColorPickerButton
                                            label="Text Color"
                                            color={textColor}
                                            onChange={setTextColor}
                                            active={activeColorPicker === 'text'}
                                            onToggle={() => toggleColorPicker('text')}
                                            onClose={closeColorPicker}
                                        />
                                        <ColorPickerButton
                                            label="Background Color"
                                            color={backgroundColor}
                                            onChange={setBackgroundColor}
                                            active={activeColorPicker === 'bg'}
                                            onToggle={() => toggleColorPicker('bg')}
                                            onClose={closeColorPicker}
                                        />
                                    </div>
                                </BlockStack>

                                {/* Layout Section */}
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">
                                        Style
                                    </Text>
                                    <Divider />
                                    <div className="grid grid-cols-2 gap-2">
                                        <TextField
                                            label="Card Padding"
                                            type="number"
                                            value={String(cardPadding)}
                                            onChange={(v) => setCardPadding(Number(v))}
                                            suffix="px"
                                            min={0}
                                            max={48}
                                            autoComplete="off"
                                        />
                                        <TextField
                                            label="Card Radius"
                                            type="number"
                                            value={String(borderRadius)}
                                            onChange={(v) => setBorderRadius(Number(v))}
                                            suffix="px"
                                            min={0}
                                            max={40}
                                            autoComplete="off"
                                        />
                                    </div>
                                </BlockStack>

                                {/* Language */}
                                <BlockStack gap="400">
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
                                </BlockStack>

                                {/* Custom CSS */}
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">
                                        Custom CSS
                                    </Text>
                                    <Divider />
                                    <textarea
                                        value={customCss}
                                        onChange={(e) => setCustomCss(e.target.value)}
                                        placeholder=".access-lock-modal { /* your css */ }"
                                        className="w-full min-h-40 rounded border border-gray-300 p-2 font-mono text-xs"
                                    />
                                </BlockStack>

                                {/* Actions moved to sticky header */}
                            </BlockStack>
                        </Card>
                    </div>

                    {/* Right Panel - Preview */}
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
                                <div className="flex-1 overflow-auto p-4 bg-gray-100 rounded-md">
                                    <div className="mx-auto max-w-lg" id="access-widget-preview-text">
                                        <style>{(function scopeCss(css, scope) { if (!css || typeof css !== 'string') return ''; const prefix = (src) => src.replace(/(^|})(\\s*[^@}{][^{}]*)\\{/g, (m, b, sel) => { const scoped = sel.split(',').map(s => `${scope} ${s.trim()}`).join(', '); return `${b} ${scoped}{`; }); return css.replace(/@media[^\\{]+\\{([\\s\\S]*?)\\}/g, (full, inner) => full.replace(inner, prefix(inner))).replace(/(^|})(\\s*[^@}{][^{}]*)\\{/g, (m, b, sel) => { const scoped = sel.split(',').map(s => `${scope} ${s.trim()}`).join(', '); return `${b} ${scoped}{`; }); })(customCss, '#access-widget-preview-text')}</style>

                                        {/* Preview Container with sample auto-generated text */}
                                        <div
                                            style={previewStyles.container}
                                            className="access-widget-card shadow-2xl"
                                            dir={previewText.rtl ? 'rtl' : 'ltr'}
                                            lang={previewLocale}
                                        >
                                            <div className="access-widget-title"
                                                style={{
                                                    ...previewStyles.content,
                                                    textAlign: 'center',
                                                    fontSize: '20px',
                                                    fontWeight: 600,
                                                    marginBottom: '5px'
                                                }}
                                            >
                                                {previewText.title}
                                            </div>
                                            <div className="access-widget-description"
                                                style={{
                                                    ...previewStyles.content,
                                                    textAlign: 'center',
                                                    opacity: 0.85,
                                                    marginBottom: '20px',
                                                    fontSize: '15px',
                                                }}
                                            >
                                                {previewText.description}
                                            </div>
                                        </div>

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
            </div>


        </div>
    );
}

