import { Badge, Banner, BlockStack, Button, Divider, InlineStack, Select, Text } from '@shopify/polaris';
import { RefreshIcon } from '@shopify/polaris-icons';
import { useCallback, useMemo } from 'react';
import {
    BUILT_IN_LOCALES,
    LOCALE_NAMES,
    customizedLocales,
    localeLabel,
    normalizeLocale,
} from '../../lib/widgetLanguages';

/**
 * Language panel shared by the form and text widget editors.
 *
 * The popup ships translated for every language we support, so the only
 * decision a merchant makes here is where the language comes from:
 * follow the storefront (each visitor gets their own), or pin one for
 * everyone.
 */
export default function LanguageSettings({
    language,
    onChange,
    storeLocales = [],
    primaryLocale = '',
    previewLocale,
    onPreviewLocaleChange,
    onRefreshStoreLocales,
    refreshing = false,
}) {
    const mode = language?.mode === 'fixed' ? 'fixed' : 'auto';
    const translations = language?.translations || {};

    const storeCodes = useMemo(() => storeLocales.map((l) => normalizeLocale(l.locale)), [storeLocales]);

    const setLanguage = useCallback(
        // translations are carried through untouched — they are no longer
        // editable here, but any wording saved previously still applies.
        (patch) => onChange({ mode, locale: language?.locale || '', translations, ...patch }),
        [onChange, mode, language, translations],
    );

    // Every locale worth offering: the built-in catalog, anything the store
    // publishes, and anything this widget already has wording for.
    const allLocaleOptions = useMemo(() => {
        const codes = new Set([
            ...BUILT_IN_LOCALES,
            ...Object.keys(LOCALE_NAMES),
            ...storeCodes,
            ...customizedLocales(language),
        ]);
        return Array.from(codes)
            .map((code) => ({
                value: code,
                label: `${localeLabel(code)}${BUILT_IN_LOCALES.includes(code) ? '' : ' — not translated'}`,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [storeCodes, language]);

    // Preview only needs the languages this shop can actually show.
    const previewOptions = useMemo(() => {
        const codes = new Set([...storeCodes, ...customizedLocales(language)]);
        if (mode === 'fixed' && language?.locale) codes.add(normalizeLocale(language.locale));
        if (codes.size === 0) codes.add('en');
        return Array.from(codes).map((code) => ({
            value: code,
            label: localeLabel(code, storeLocales.find((l) => normalizeLocale(l.locale) === code)?.name),
        }));
    }, [storeCodes, storeLocales, language, mode]);

    const pinnedLocale = normalizeLocale(language?.locale) || normalizeLocale(primaryLocale) || 'en';

    return (
        <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <Text variant="headingMd" as="h2">
                    Language{' '}
                    <Badge tone="info" size="small">
                        Multi-language
                    </Badge>
                </Text>
                {onRefreshStoreLocales && (
                    <Button icon={RefreshIcon} onClick={onRefreshStoreLocales} loading={refreshing} variant="tertiary">
                        Sync store languages
                    </Button>
                )}
            </InlineStack>
            <Divider />

            <Select
                label="Popup language"
                options={[
                    { label: 'Follow the storefront language (recommended)', value: 'auto' },
                    { label: 'Always use one language', value: 'fixed' },
                ]}
                value={mode}
                onChange={(value) =>
                    setLanguage({
                        mode: value,
                        locale: value === 'fixed' ? pinnedLocale : '',
                    })
                }
                helpText={
                    mode === 'auto'
                        ? 'Each visitor sees the popup in the language they are browsing your store in.'
                        : 'Every visitor sees the popup in this one language, whatever the storefront is set to.'
                }
            />

            {mode === 'fixed' && (
                <Select
                    label="Language to use"
                    options={allLocaleOptions}
                    value={pinnedLocale}
                    onChange={(value) => setLanguage({ mode: 'fixed', locale: value })}
                />
            )}

            {storeLocales.length > 0 ? (
                <Banner tone="info">
                    <p>
                        Pulled from your store:{' '}
                        <strong>{storeLocales.map((l) => localeLabel(l.locale, l.name)).join(', ')}</strong>. The popup
                        is already translated for every language we ship — nothing else to set up.
                    </p>
                </Banner>
            ) : (
                <Banner tone="warning">
                    <p>
                        We could not read your store&apos;s languages yet. Use “Sync store languages”, or pin one with
                        “Always use one language”.
                    </p>
                </Banner>
            )}

            {mode === 'auto' && storeCodes.length === 1 && (
                <Banner tone="warning">
                    <p>
                        Your store publishes only{' '}
                        <strong>{localeLabel(storeLocales[0].locale, storeLocales[0].name)}</strong>, so every visitor
                        will see that language. To show a different one, publish it in Shopify (Settings → Languages),
                        or switch to “Always use one language” above.
                    </p>
                </Banner>
            )}

            {onPreviewLocaleChange && (
                <Select
                    label="Preview language"
                    options={previewOptions}
                    value={normalizeLocale(previewLocale) || previewOptions[0]?.value}
                    onChange={onPreviewLocaleChange}
                    helpText="Only changes the preview on the right — it does not affect what customers see."
                />
            )}
        </BlockStack>
    );
}
