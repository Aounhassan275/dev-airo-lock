/**
 * Admin-side view of the storefront translation catalog.
 *
 * The catalog itself lives with the theme extension (access_i18n.js) so the
 * storefront and this editor can never drift apart — importing it here for
 * its side effect registers the same dictionary the customer will see.
 */
import '../../../extensions/access-controll/assets/access_i18n.js';

const runtime = (typeof window !== 'undefined' ? window : globalThis).AccessI18n;

/** Every locale the app ships built-in translations for. */
export const BUILT_IN_LOCALES = runtime ? runtime.supportedLocales() : ['en'];

/**
 * Translate for the editor's preview pane. Passing an explicit locale is
 * what lets a merchant preview German while their admin is in English.
 */
export function translate(key, locale, vars) {
    if (!runtime) return key;
    return runtime.t(key, vars, locale);
}

export function isRTLLocale(locale) {
    return runtime ? runtime.isRTL(locale) : false;
}

export function normalizeLocale(locale) {
    return runtime ? runtime.normalize(locale) : String(locale || '').toLowerCase();
}

/**
 * Apply a widget's language settings to the shared runtime, so preview
 * rendering resolves overrides exactly the way the storefront will.
 * Call this before reading translations for a preview.
 */
export function applyLanguageForPreview(language) {
    if (runtime) runtime.configure(language);
}

/**
 * Display names for locales, used when the store hasn't told us a name.
 * Only covers what we ship translations for; anything else falls back to
 * the raw code, which is still perfectly usable.
 */
export const LOCALE_NAMES = {
    en: 'English',
    es: 'Spanish (Español)',
    fr: 'French (Français)',
    de: 'German (Deutsch)',
    it: 'Italian (Italiano)',
    pt: 'Portuguese (Português)',
    'pt-br': 'Portuguese – Brazil (Português)',
    'pt-pt': 'Portuguese – Portugal (Português)',
    nl: 'Dutch (Nederlands)',
    sv: 'Swedish (Svenska)',
    da: 'Danish (Dansk)',
    nb: 'Norwegian (Norsk)',
    no: 'Norwegian (Norsk)',
    fi: 'Finnish (Suomi)',
    pl: 'Polish (Polski)',
    cs: 'Czech (Čeština)',
    tr: 'Turkish (Türkçe)',
    ru: 'Russian (Русский)',
    uk: 'Ukrainian (Українська)',
    el: 'Greek (Ελληνικά)',
    ja: 'Japanese (日本語)',
    ko: 'Korean (한국어)',
    'zh-cn': 'Chinese Simplified (简体中文)',
    'zh-tw': 'Chinese Traditional (繁體中文)',
    ar: 'Arabic (العربية)',
    he: 'Hebrew (עברית)',
    hi: 'Hindi (हिन्दी)',
    th: 'Thai (ไทย)',
    vi: 'Vietnamese (Tiếng Việt)',
    id: 'Indonesian (Bahasa Indonesia)',
    ro: 'Romanian (Română)',
    hu: 'Hungarian (Magyar)',
    bg: 'Bulgarian (Български)',
    hr: 'Croatian (Hrvatski)',
    sk: 'Slovak (Slovenčina)',
    sl: 'Slovenian (Slovenščina)',
    lt: 'Lithuanian (Lietuvių)',
    lv: 'Latvian (Latviešu)',
    et: 'Estonian (Eesti)',
    sr: 'Serbian (Српски)',
    ca: 'Catalan (Català)',
    ms: 'Malay (Bahasa Melayu)',
};

/**
 * Which language the preview should open on: a locale this widget already
 * has wording saved for, then a pinned locale, then the store primary.
 */
export function preferredEditingLocale(language, storeLocales = [], primaryLocale = '') {
    const customized = Object.entries(language?.translations || {}).find(
        ([, strings]) => strings && Object.values(strings).some((v) => typeof v === 'string' && v.trim() !== ''),
    );
    if (customized) return normalizeLocale(customized[0]);

    if (language?.mode === 'fixed' && language.locale) return normalizeLocale(language.locale);

    return normalizeLocale(primaryLocale) || normalizeLocale(storeLocales[0]?.locale) || 'en';
}

/** Locales with at least one non-empty custom string. */
export function customizedLocales(language) {
    return Object.entries(language?.translations || {})
        .filter(([, strings]) => strings && Object.values(strings).some((v) => typeof v === 'string' && v.trim() !== ''))
        .map(([locale]) => normalizeLocale(locale));
}

export function localeLabel(locale, storeName) {
    if (storeName) return storeName;
    const key = normalizeLocale(locale);
    return LOCALE_NAMES[key] || LOCALE_NAMES[key.split('-')[0]] || locale;
}

export const DEFAULT_LANGUAGE_SETTINGS = {
    mode: 'auto',
    locale: '',
    translations: {},
};

/**
 * Drop empty overrides so a widget's configuration only carries text the
 * merchant actually typed — everything else stays on the built-in catalog
 * and keeps improving as we ship translation updates.
 */
export function pruneTranslations(translations) {
    const out = {};
    Object.entries(translations || {}).forEach(([locale, strings]) => {
        const kept = {};
        Object.entries(strings || {}).forEach(([key, value]) => {
            if (typeof value === 'string' && value.trim() !== '') kept[key] = value;
        });
        if (Object.keys(kept).length > 0) out[locale] = kept;
    });
    return out;
}
