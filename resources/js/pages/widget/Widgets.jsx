import { router } from '@inertiajs/react';
import { Modal, TitleBar, useAppBridge } from '@shopify/app-bridge-react';
import { Box, Button, InlineStack, Text } from '@shopify/polaris';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../../css/pages/widget-builder.css';
import FormWidgetEditor from '../../components/widget/FormWidgetEditor';
import {
    COLOUR_KEYS,
    COLOUR_LABELS,
    countLabel,
    hexToHsb,
    hsbToHex,
    paletteFor,
    palettesFor,
    scopeCss,
    toHex,
    widgetColours,
} from '../../components/widget/widgetDesign';
import {
    BUILT_IN_LOCALES,
    DEFAULT_LANGUAGE_SETTINGS,
    LOCALE_NAMES,
    applyLanguageForPreview,
    customizedLocales,
    isRTLLocale,
    localeLabel,
    normalizeLocale,
    preferredEditingLocale,
    pruneTranslations,
    translate,
} from '../../lib/widgetLanguages';

/* ---------------------------------------------------------------------------
   /widgets (create) and /widgets?id={widget} (edit) — one page.

   A widget is a handful of settings you opened on purpose, so it is the same
   one-page form the lock uses: what it is, its colours, its shape, and — when
   editing — the locks relying on it. The preview rides in the rail.

   The file is also imported as a component (the lock builder's "Create
   widget" modal renders it with an onSubmit). That use gets the embedded
   editor it always had; see FormWidgetEditor.
--------------------------------------------------------------------------- */

// The form editor's defaults (Widgets.jsx defaultDesignOptions), as hex.
const FORM_DEFAULT_COLOURS = {
    text: hsbToHex({ hue: 0, saturation: 0, brightness: 0.2 }),
    card: hsbToHex({ hue: 0, saturation: 0, brightness: 1 }),
    buttonBg: hsbToHex({ hue: 210, saturation: 0.85, brightness: 0.55 }),
    buttonText: hsbToHex({ hue: 0, saturation: 0, brightness: 1 }),
};
const FORM_DEFAULT_LAYOUT = {
    textAlignment: 'center',
    verticalAlignment: 'top',
    formPadding: '10',
    borderRadius: '16',
    cardPadding: '10',
    cardBorderRadius: '12',
    // Empty on purpose: a blank label falls through to the translated default.
    buttonText: '',
};
// The text editor's defaults (TextWidget.jsx).
const TEXT_DEFAULTS = {
    text: hsbToHex({ hue: 0, saturation: 0, brightness: 0.2 }),
    card: hsbToHex({ hue: 0, saturation: 0, brightness: 0.96 }),
    pad: '24',
    rad: '12',
};

function useShopifyToast() {
    const app = useAppBridge();
    return useCallback(
        (message, { isError = false, duration = 3000 } = {}) => {
            try {
                const Toast = app?.toast ?? window?.shopify?.toast;
                if (Toast?.show) Toast.show(message, { duration, isError });
            } catch {
                /* a toast is never worth failing over */
            }
        },
        [app],
    );
}

/** Where the page starts: the saved widget, or the defaults for a new one. */
function initialState(widget) {
    const config = widget?.configuration || {};
    const kind = widget?.type === 'text' ? 'text' : 'form';

    if (!widget) {
        return {
            kind,
            name: '',
            colours: { ...FORM_DEFAULT_COLOURS },
            pad: FORM_DEFAULT_LAYOUT.cardPadding,
            rad: FORM_DEFAULT_LAYOUT.cardBorderRadius,
            btnText: '',
            customCss: '',
            language: { ...DEFAULT_LANGUAGE_SETTINGS },
        };
    }

    const colours = { ...FORM_DEFAULT_COLOURS, ...widgetColours({ type: kind, configuration: config }) };
    const layout = config?.designOptions?.layout || {};

    return {
        kind,
        name: widget.name || '',
        colours,
        pad: String(kind === 'text' ? config.cardPadding || TEXT_DEFAULTS.pad : layout.cardPadding ?? FORM_DEFAULT_LAYOUT.cardPadding),
        rad: String(kind === 'text' ? config.borderRadius || TEXT_DEFAULTS.rad : layout.cardBorderRadius ?? FORM_DEFAULT_LAYOUT.cardBorderRadius),
        btnText: kind === 'form' ? layout.buttonText || '' : '',
        customCss: config.customCss || '',
        language: { ...DEFAULT_LANGUAGE_SETTINGS, ...(config.language || {}) },
    };
}

const LockIcon = ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
        <path d="M8 10.5V7.5a4 4 0 018 0v3" />
    </svg>
);

function WidgetBuilder({ widget = null, storeLocales = [], primaryLocale = '' }) {
    const showToast = useShopifyToast();
    const edit = !!widget;
    const usedBy = useMemo(() => (Array.isArray(widget?.usedBy) ? widget.usedBy : []), [widget]);

    const start = useMemo(() => initialState(widget), [widget]);
    const [kind, setKind] = useState(start.kind);
    const [name, setName] = useState(start.name);
    const [nameError, setNameError] = useState('');
    const [colours, setColours] = useState(start.colours);
    const [pad, setPad] = useState(start.pad);
    const [rad, setRad] = useState(start.rad);
    const [btnText, setBtnText] = useState(start.btnText);
    const [customCss, setCustomCss] = useState(start.customCss);
    const [cssOpen, setCssOpen] = useState(!!start.customCss);
    const [language, setLanguage] = useState(start.language);
    const [previewLocale, setPreviewLocale] = useState(() =>
        preferredEditingLocale(widget?.configuration?.language, storeLocales, primaryLocale),
    );

    const [dirty, setDirty] = useState(false);
    const dirtyRef = useRef(false);
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);

    const touch = useCallback(() => {
        dirtyRef.current = true;
        setDirty(true);
    }, []);
    const clean = useCallback(() => {
        dirtyRef.current = false;
        setDirty(false);
    }, []);

    // Leaving with unsaved changes asks first — for a reload, and for any
    // in-app page visit. Saving is a POST/PUT, so it is never stopped.
    useEffect(() => {
        const onUnload = (e) => {
            if (!dirtyRef.current) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onUnload);
        const off = router.on('before', (event) => {
            if (!dirtyRef.current) return;
            const method = String(event?.detail?.visit?.method || 'get').toLowerCase();
            if (method !== 'get') return;
            if (!window.confirm('Leave this page? Your changes to this widget have not been saved.')) {
                event.preventDefault();
            }
        });
        return () => {
            window.removeEventListener('beforeunload', onUnload);
            if (typeof off === 'function') off();
        };
    }, []);

    const leave = useCallback(() => {
        clean();
        router.visit('/widgetdashboard');
    }, [clean]);

    // ------------------------------------------------------------- palette --
    const keys = COLOUR_KEYS[kind];
    const palettes = palettesFor(kind);
    const palette = useMemo(() => paletteFor(kind, colours), [kind, colours]);

    const applyPalette = (p) => {
        setColours((prev) => {
            const next = { ...prev };
            COLOUR_KEYS[kind].forEach((k) => {
                next[k] = toHex(p.colors[k]);
            });
            return next;
        });
        touch();
    };

    const setColour = (k, v) => {
        setColours((prev) => ({ ...prev, [k]: toHex(v, prev[k]) }));
        touch();
    };

    // ------------------------------------------------------------ language --
    const storeCodes = useMemo(() => storeLocales.map((l) => normalizeLocale(l.locale)), [storeLocales]);
    const languageValue = language?.mode === 'fixed' ? normalizeLocale(language.locale) || 'auto' : 'auto';

    // Every locale worth offering: what the store publishes first, then the
    // built-in catalog and anything this widget already has wording for.
    const otherLocaleOptions = useMemo(() => {
        const codes = new Set([...BUILT_IN_LOCALES, ...Object.keys(LOCALE_NAMES), ...customizedLocales(language)]);
        if (languageValue !== 'auto') codes.add(languageValue);
        storeCodes.forEach((c) => codes.delete(c));
        return Array.from(codes)
            .map((code) => ({
                value: code,
                label: `${localeLabel(code)}${BUILT_IN_LOCALES.includes(code) ? '' : ' — not translated'}`,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [language, languageValue, storeCodes]);

    const onLanguageChange = (value) => {
        // Translations are carried through untouched: they are not editable
        // here, but any wording saved previously still applies.
        setLanguage((prev) => ({
            ...prev,
            mode: value === 'auto' ? 'auto' : 'fixed',
            locale: value === 'auto' ? '' : value,
        }));
        touch();
    };

    const previewOptions = useMemo(() => {
        const codes = new Set([...storeCodes, ...customizedLocales(language)]);
        if (languageValue !== 'auto') codes.add(languageValue);
        if (codes.size === 0) codes.add('en');
        return Array.from(codes).map((code) => ({
            value: code,
            label: localeLabel(code, storeLocales.find((l) => normalizeLocale(l.locale) === code)?.name),
        }));
    }, [storeCodes, storeLocales, language, languageValue]);

    const syncLanguages = () => {
        if (syncing) return;
        setSyncing(true);
        router.post(
            '/widgets/refresh-locales',
            {},
            {
                preserveScroll: true,
                preserveState: true,
                onFinish: () => setSyncing(false),
            },
        );
    };

    // ------------------------------------------------------------- preview --
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

    const padN = Math.max(0, Number(pad) || 0);
    const radN = Math.max(0, Number(rad) || 0);

    // -------------------------------------------------------------- saving --
    const buildConfiguration = () => {
        const lang = {
            mode: language.mode === 'fixed' ? 'fixed' : 'auto',
            locale: language.mode === 'fixed' ? normalizeLocale(language.locale) : '',
            translations: pruneTranslations(language.translations),
        };

        if (kind === 'text') {
            // TextWidget.jsx's payload: numbers, and colours as HSB.
            return {
                borderRadius: Number(rad) || 0,
                cardPadding: Number(pad) || 0,
                textColor: hexToHsb(colours.text),
                backgroundColor: hexToHsb(colours.card),
                customCss: customCss || '',
                language: lang,
            };
        }

        // Widgets.jsx getSubmitData's payload: hex colours plus the layout.
        const savedLayout = widget?.type === 'form' ? widget?.configuration?.designOptions?.layout || {} : {};
        return {
            designOptions: {
                colors: {
                    text: colours.text,
                    card: colours.card,
                    buttonBg: colours.buttonBg,
                    buttonText: colours.buttonText,
                },
                layout: {
                    ...FORM_DEFAULT_LAYOUT,
                    ...savedLayout,
                    cardPadding: pad,
                    cardBorderRadius: rad,
                    buttonText: btnText,
                },
            },
            customCss: customCss || '',
            language: lang,
        };
    };

    const save = () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setNameError('Name the widget first.');
            return;
        }
        if (saving) return;
        setSaving(true);
        const configuration = buildConfiguration();

        if (edit) {
            const payload = { configuration };
            if (trimmed !== widget.name) payload.name = trimmed;
            router.put(`/widgets/${widget.id}`, payload, {
                onBefore: () => clean(),
                onSuccess: () => showToast(`"${trimmed}" updated successfully!`),
                onError: () => {
                    touch();
                    showToast('Failed to update widget.', { isError: true });
                },
                onFinish: () => setSaving(false),
            });
            return;
        }

        router.post(
            '/widgets/store',
            { name: trimmed, type: kind, configuration },
            {
                preserveScroll: true,
                onBefore: () => clean(),
                onSuccess: () => showToast(`"${trimmed}" created successfully!`),
                onError: (errors) => {
                    touch();
                    showToast(Object.values(errors || {}).flat().join(', ') || 'Failed to create widget.', { isError: true });
                },
                onFinish: () => setSaving(false),
            },
        );
    };

    const confirmDelete = () => {
        if (!edit || deleting) return;
        setDeleting(true);
        clean();
        router.delete(`/widgets/${widget.id}`, {
            onSuccess: () => {
                setDeleteOpen(false);
                showToast(`"${widget.name}" deleted successfully.`);
            },
            onError: () => showToast('Failed to delete widget.', { isError: true }),
            onFinish: () => setDeleting(false),
        });
    };

    const reset = () => {
        if (kind === 'text') {
            setColours((prev) => ({ ...prev, text: TEXT_DEFAULTS.text, card: TEXT_DEFAULTS.card }));
            setPad(TEXT_DEFAULTS.pad);
            setRad(TEXT_DEFAULTS.rad);
        } else {
            setColours({ ...FORM_DEFAULT_COLOURS });
            setPad(FORM_DEFAULT_LAYOUT.cardPadding);
            setRad(FORM_DEFAULT_LAYOUT.cardBorderRadius);
        }
        setBtnText('');
        setCustomCss('');
        setLanguage({ ...DEFAULT_LANGUAGE_SETTINGS });
        setResetOpen(false);
        touch();
    };

    const canSave = name.trim() !== '' && !saving;
    const saveLabel = edit ? 'Save' : 'Create widget';
    const title = edit ? name.trim() || 'Untitled widget' : 'Create a widget';
    const usedLabel = usedBy.length ? `Used by ${countLabel(usedBy.length, 'locks')}` : 'Not used by any lock';

    const kindOpt = (value, label, desc, icon) => {
        const on = kind === value;
        const locked = edit && !on;
        return (
            <button
                type="button"
                className={`opt${on ? ' on' : ''}${locked ? ' off' : ''}`}
                aria-pressed={on}
                disabled={locked}
                onClick={() => {
                    if (edit || on) return;
                    setKind(value);
                    touch();
                }}
            >
                <span className="opt-ic" aria-hidden="true">
                    {icon}
                </span>
                <span>
                    <span className="opt-t">{label}</span>
                    <span className="opt-d">{desc}</span>
                </span>
                <span className="opt-tick" />
            </button>
        );
    };

    return (
        <div className="airo pg-widget-builder">
            <main className="page full">
                <div className="pg-head">
                    <div className="grow" style={{ minWidth: 0 }}>
                        <a
                            className="back-l"
                            href="/widgetdashboard"
                            onClick={(e) => {
                                e.preventDefault();
                                router.visit('/widgetdashboard');
                            }}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M15 5l-7 7 7 7" />
                            </svg>
                            Widgets
                        </a>
                        <div className="row g8 wrap" style={{ marginTop: 2 }}>
                            <h1 className="pg-t">{title}</h1>
                            {edit && <span className={`tag ${kind}`}>{kind === 'form' ? 'Form' : 'Text'}</span>}
                            {edit && <span className="xs sub">{usedLabel}</span>}
                        </div>
                    </div>
                    <div className="row g8 wrap">
                        {edit && (
                            <button type="button" className="btn" onClick={() => setDeleteOpen(true)} disabled={saving || deleting}>
                                Delete
                            </button>
                        )}
                        <button type="button" className="btn" onClick={leave} disabled={saving}>
                            Cancel
                        </button>
                        <button type="button" className="btn primary" onClick={save} disabled={!canSave}>
                            {saving ? 'Saving…' : saveLabel}
                        </button>
                    </div>
                </div>

                <div className="one">
                    <div className="one-main">
                        {/* ===================================== 1. what */}
                        <section className="sec-c">
                            <div className="sec-hd">
                                <span className="sec-n">1</span>
                                <div className="grow">
                                    <h2 className="sec-t2">What it is</h2>
                                    <p className="sec-d2">
                                        A name you will recognise in a lock&rsquo;s design list, and whether the popup asks for anything.
                                    </p>
                                </div>
                            </div>
                            <div className="sec-b">
                                <div className="fields2">
                                    <div className="field">
                                        <label className="label" htmlFor="wName">
                                            Widget name <span className="req" aria-hidden="true">*</span>
                                        </label>
                                        <input
                                            className="input"
                                            id="wName"
                                            aria-required="true"
                                            aria-invalid={!!nameError}
                                            placeholder="e.g. Trade gate"
                                            value={name}
                                            autoComplete="off"
                                            maxLength={255}
                                            onChange={(e) => {
                                                setName(e.target.value);
                                                if (nameError) setNameError('');
                                                touch();
                                            }}
                                        />
                                        {nameError ? (
                                            <span className="help wb-err">{nameError}</span>
                                        ) : (
                                            <span className="help">Only you see this. It appears when a lock picks a design.</span>
                                        )}
                                    </div>
                                    <div className="field">
                                        <div className="between">
                                            <label className="label" htmlFor="wLang">
                                                Popup language
                                            </label>
                                            <button
                                                type="button"
                                                className={`btn plain xs${syncing ? ' syncing' : ''}`}
                                                onClick={syncLanguages}
                                                disabled={syncing}
                                            >
                                                <span className="pick-sync">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                        <path d="M20 11a8 8 0 0 0-14-4.5L4 9" />
                                                        <path d="M4 13a8 8 0 0 0 14 4.5L20 15" />
                                                        <path d="M4 5v4h4M20 19v-4h-4" />
                                                    </svg>
                                                    Sync languages
                                                </span>
                                            </button>
                                        </div>
                                        <select className="select" id="wLang" value={languageValue} onChange={(e) => onLanguageChange(e.target.value)}>
                                            <option value="auto">Follow the storefront language (recommended)</option>
                                            {storeLocales.length > 0 && (
                                                <optgroup label="Always use one of your store's languages">
                                                    {storeLocales.map((l) => {
                                                        const code = normalizeLocale(l.locale);
                                                        return (
                                                            <option key={code} value={code}>
                                                                {localeLabel(l.locale, l.name)}
                                                                {BUILT_IN_LOCALES.includes(code) ? '' : ' — not translated'}
                                                            </option>
                                                        );
                                                    })}
                                                </optgroup>
                                            )}
                                            <optgroup label={storeLocales.length > 0 ? 'Always use another language' : 'Always use one language'}>
                                                {otherLocaleOptions.map((o) => (
                                                    <option key={o.value} value={o.value}>
                                                        {o.label}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </select>
                                        <span className="help">
                                            {languageValue === 'auto'
                                                ? 'Each visitor sees the popup in the language they are browsing your store in.'
                                                : 'Every visitor sees the popup in this one language, whatever the storefront is set to.'}
                                        </span>
                                        {storeLocales.length > 0 ? (
                                            <span className="help">
                                                Shopify decides which languages your store publishes:{' '}
                                                {storeLocales.map((l) => localeLabel(l.locale, l.name)).join(', ')}.
                                            </span>
                                        ) : (
                                            <span className="help wb-warn">
                                                We could not read your store&rsquo;s languages yet. Use Sync languages, or pick one language to always use.
                                            </span>
                                        )}
                                        {languageValue === 'auto' && storeLocales.length === 1 && (
                                            <span className="help wb-warn">
                                                Your store publishes only {localeLabel(storeLocales[0].locale, storeLocales[0].name)}, so every visitor
                                                sees that language. Publish another in Shopify (Settings → Languages) to show more.
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="divider" style={{ margin: '16px 0' }} />

                                <span className="sec-l" style={{ display: 'block', marginBottom: 7 }}>
                                    Kind
                                </span>
                                <div className="opts2" role="group" aria-label="Kind">
                                    {kindOpt(
                                        'form',
                                        'Form widget',
                                        'Asks for something. Passcode, paired credential and age conditions use this.',
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="5" width="18" height="6" rx="1.6" />
                                            <rect x="3" y="15" width="11" height="4" rx="1.6" />
                                        </svg>,
                                    )}
                                    {kindOpt(
                                        'text',
                                        'Text widget',
                                        'Says something. Tag, sign-in, email list, location and secret-link conditions use this.',
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 6h16M4 11h16M4 16h9" />
                                        </svg>,
                                    )}
                                </div>
                                {edit && (
                                    <p className="help mt8">
                                        The kind is fixed once a widget is saved: locks pick form and text widgets from separate lists.
                                    </p>
                                )}
                            </div>
                        </section>

                        {/* =================================== 2. colours */}
                        <section className="sec-c">
                            <div className="sec-hd">
                                <span className="sec-n">2</span>
                                <div className="grow">
                                    <h2 className="sec-t2">Colours</h2>
                                    <p className="sec-d2">
                                        Start from a palette, then change any of the {kind === 'form' ? 'four' : 'two'}. The preview is the
                                        storefront popup, not an approximation of it.
                                    </p>
                                </div>
                                <button type="button" className="btn plain xs" onClick={() => setResetOpen(true)}>
                                    Reset design
                                </button>
                            </div>
                            <div className="sec-b">
                                <div className="row g8" style={{ marginBottom: 9 }}>
                                    <span className="sec-l">Palettes</span>
                                    <span className="tag">Basic</span>
                                </div>
                                <div className="palettes">
                                    {palettes.map((p) => (
                                        <button
                                            type="button"
                                            key={p.key}
                                            className={`pal${palette?.key === p.key ? ' on' : ''}`}
                                            aria-pressed={palette?.key === p.key}
                                            onClick={() => applyPalette(p)}
                                        >
                                            {p.label}
                                            <span className="pal-sw">
                                                {keys.map((k) => (
                                                    <i key={k} style={{ background: p.colors[k] }} />
                                                ))}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                <div className="row g8" style={{ margin: '16px 0 9px' }}>
                                    <span className="sec-l">Colours</span>
                                    <span className="xs sub">{palette ? palette.label : 'Custom'}</span>
                                </div>
                                <div className="wb-colours">
                                    {keys.map((k) => (
                                        <label className="swatch" key={k}>
                                            <input type="color" value={colours[k]} onChange={(e) => setColour(k, e.target.value)} aria-label={`${COLOUR_LABELS[k]} colour`} />
                                            <span>{COLOUR_LABELS[k]}</span>
                                            <span className="wb-hex">{colours[k].toUpperCase()}</span>
                                        </label>
                                    ))}
                                </div>
                                {kind === 'text' && <p className="help mt8">A text widget has no button, so it carries two colours.</p>}
                            </div>
                        </section>

                        {/* ===================================== 3. shape */}
                        <section className="sec-c">
                            <div className="sec-hd">
                                <span className="sec-n">3</span>
                                <div className="grow">
                                    <h2 className="sec-t2">Shape and wording</h2>
                                    <p className="sec-d2">
                                        How the card sits{kind === 'form' ? ', and the one word the button carries' : ''}. What the popup{' '}
                                        <em>says</em> stays with each lock.
                                    </p>
                                </div>
                            </div>
                            <div className="sec-b">
                                <div className="fields2">
                                    <div className="field">
                                        <label className="label" htmlFor="wPad">
                                            Card padding
                                        </label>
                                        <div className="row g8">
                                            <input
                                                className="input"
                                                id="wPad"
                                                type="number"
                                                min={kind === 'text' ? 0 : 8}
                                                max={48}
                                                value={pad}
                                                onChange={(e) => {
                                                    setPad(e.target.value);
                                                    touch();
                                                }}
                                            />
                                            <span className="sm sub">px</span>
                                        </div>
                                    </div>
                                    <div className="field">
                                        <label className="label" htmlFor="wRad">
                                            Card radius
                                        </label>
                                        <div className="row g8">
                                            <input
                                                className="input"
                                                id="wRad"
                                                type="number"
                                                min={0}
                                                max={kind === 'text' ? 40 : 24}
                                                value={rad}
                                                onChange={(e) => {
                                                    setRad(e.target.value);
                                                    touch();
                                                }}
                                            />
                                            <span className="sm sub">px</span>
                                        </div>
                                    </div>
                                    {kind === 'form' && (
                                        <div className="field">
                                            <label className="label" htmlFor="wBtnText">
                                                Button text
                                            </label>
                                            <input
                                                className="input"
                                                id="wBtnText"
                                                placeholder={previewText.submit}
                                                value={btnText}
                                                onChange={(e) => {
                                                    setBtnText(e.target.value);
                                                    touch();
                                                }}
                                            />
                                            <span className="help">Leave blank to use the translated default.</span>
                                        </div>
                                    )}
                                </div>

                                <div className="divider" style={{ margin: '16px 0 12px' }} />
                                <button type="button" className="btn plain xs wb-css-t" aria-expanded={cssOpen} onClick={() => setCssOpen((o) => !o)}>
                                    {cssOpen ? 'Hide custom CSS' : customCss ? 'Custom CSS (in use)' : 'Add custom CSS'}
                                </button>
                                {cssOpen && (
                                    <div className="field mt8">
                                        <label className="label" htmlFor="wCss">
                                            Custom CSS
                                        </label>
                                        <textarea
                                            className="textarea wb-css"
                                            id="wCss"
                                            value={customCss}
                                            placeholder=".access-lock-modal { /* your css */ }"
                                            onChange={(e) => {
                                                setCustomCss(e.target.value);
                                                touch();
                                            }}
                                        />
                                        <span className="help">Applied on the storefront after the colours above.</span>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* ================================== 4. used by */}
                        {edit && usedBy.length > 0 && (
                            <section className="sec-c">
                                <div className="sec-hd">
                                    <span className="sec-n">4</span>
                                    <div className="grow">
                                        <h2 className="sec-t2">Locks using this design</h2>
                                        <p className="sec-d2">A widget is shared. Saving a colour here changes it on every lock below.</p>
                                    </div>
                                </div>
                                <div className="sec-b">
                                    {usedBy.map((lock) => (
                                        <div className="uses-l2" key={lock.id}>
                                            <LockIcon size={14} />
                                            <a
                                                href={`/lock/${lock.id}/configure`}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    router.visit(`/lock/${lock.id}/configure`);
                                                }}
                                            >
                                                {lock.name || 'Untitled lock'}
                                            </a>
                                            <span className="xs sub">#{lock.id}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* ------------------------------------------------ rail */}
                    <aside className="one-rail">
                        <div className="rail-c">
                            <div className="stage">
                                <div className="device">
                                    <div className="sk" aria-hidden="true">
                                        <i style={{ width: '46%', height: 12 }} />
                                        <i className="gap" />
                                        <i />
                                        <i style={{ width: '88%' }} />
                                        <i style={{ width: '70%' }} />
                                        <i className="gap" />
                                        <i style={{ width: '40%', height: 11 }} />
                                        <i />
                                        <i style={{ width: '80%' }} />
                                    </div>
                                    <div className="veil" id="access-widget-preview">
                                        <style>{scopeCss(customCss, '#access-widget-preview')}</style>
                                        <div
                                            className="lk access-widget-card"
                                            dir={previewText.rtl ? 'rtl' : 'ltr'}
                                            lang={previewLocale}
                                            style={{
                                                background: colours.card,
                                                color: colours.text,
                                                padding: `${padN}px ${padN + 6}px`,
                                                borderRadius: `${radN}px`,
                                            }}
                                        >
                                            <div className="lk-ico">
                                                <LockIcon />
                                            </div>
                                            <div className="lk-t access-widget-title">{previewText.title}</div>
                                            <div className="lk-m access-widget-description">{previewText.description}</div>
                                            {kind === 'form' && (
                                                <>
                                                    <div className="lk-l access-widget-label">{previewText.codeLabel}</div>
                                                    <div className="lk-f access-widget-input">{previewText.codePlaceholder}</div>
                                                    <div className="lk-l access-widget-label">{previewText.emailLabel}</div>
                                                    <div className="lk-f access-widget-input">{previewText.emailPlaceholder}</div>
                                                    <div className="lk-b access-widget-button" style={{ background: colours.buttonBg, color: colours.buttonText }}>
                                                        {btnText.trim() || previewText.submit}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <span className="stage-cap">What shoppers see</span>
                                {previewOptions.length > 1 && (
                                    <label className="wb-plang">
                                        <span className="xs sub">Preview in</span>
                                        <select
                                            className="select"
                                            value={normalizeLocale(previewLocale) || previewOptions[0]?.value}
                                            onChange={(e) => setPreviewLocale(e.target.value)}
                                            aria-label="Preview language"
                                        >
                                            {previewOptions.map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}
                            </div>

                            <ol className="osums">
                                <li className="sum set">
                                    <span className="sum-k">Kind</span>
                                    <span className="sum-v">{kind === 'form' ? 'Form widget' : 'Text widget'}</span>
                                </li>
                                <li className={`sum${palette ? ' set' : ''}`}>
                                    <span className="sum-k">Palette</span>
                                    <span className="sum-v">{palette ? palette.label : 'Custom'}</span>
                                </li>
                                <li className={`sum${usedBy.length ? ' set' : ''}`}>
                                    <span className="sum-k">Used by</span>
                                    <span className="sum-v">{usedBy.length ? countLabel(usedBy.length, 'locks') : 'No locks yet'}</span>
                                </li>
                            </ol>
                        </div>
                    </aside>
                </div>

                <div className={`savebar${dirty ? ' on' : ''}`} aria-hidden={!dirty}>
                    <div className="grow" style={{ minWidth: 0 }}>
                        <span className="sb-t">Unsaved changes</span>
                        <span className="sb-d" style={{ display: 'block' }}>
                            {name.trim() ? 'Nothing is saved until you press Save.' : 'Name the widget first.'}
                        </span>
                    </div>
                    <button type="button" className="btn" onClick={leave} disabled={saving} tabIndex={dirty ? 0 : -1}>
                        Discard
                    </button>
                    <button type="button" className="btn primary" onClick={save} disabled={!canSave} tabIndex={dirty ? 0 : -1}>
                        {saving ? 'Saving…' : saveLabel}
                    </button>
                </div>
            </main>

            {/* Delete — says what happens to the locks relying on it. */}
            {edit && (
                <Modal id="delete-widget-modal" open={deleteOpen} onHide={() => setDeleteOpen(false)}>
                    <Box padding="400">
                        <Text as="p" variant="bodyMd" tone="subdued">
                            {usedBy.length
                                ? `${countLabel(usedBy.length, 'locks')} use${usedBy.length === 1 ? 's' : ''} it. They fall back to the default look, and keep working.`
                                : 'Nothing is using it, so nothing changes on your storefront.'}
                        </Text>
                    </Box>
                    <Box padding="400" borderBlockStartWidth="025" borderColor="border" background="bg-surface-secondary">
                        <InlineStack align="end" gap="200">
                            <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
                                Cancel
                            </Button>
                            <Button variant="primary" tone="critical" onClick={confirmDelete} loading={deleting}>
                                Delete widget
                            </Button>
                        </InlineStack>
                    </Box>
                    <TitleBar title="Delete this widget?" />
                </Modal>
            )}

            {/* Reset — the editors' own confirmation, kept. */}
            <Modal id="reset-widget-modal" open={resetOpen} onHide={() => setResetOpen(false)}>
                <Box padding="400">
                    <Text as="p" variant="bodyMd" tone="subdued">
                        This resets the colours, shape, custom CSS and language to their defaults. Nothing is saved until you press{' '}
                        {saveLabel}.
                    </Text>
                </Box>
                <Box padding="400" borderBlockStartWidth="025" borderColor="border" background="bg-surface-secondary">
                    <InlineStack align="end" gap="200">
                        <Button onClick={() => setResetOpen(false)}>Cancel</Button>
                        <Button variant="primary" tone="critical" onClick={reset}>
                            Reset all
                        </Button>
                    </InlineStack>
                </Box>
                <TitleBar title="Reset design?" />
            </Modal>
        </div>
    );
}

/**
 * As a page (no onSubmit) this is the widget page. As a component — the lock
 * builder's "Create widget" modal passes onSubmit — it is the embedded form
 * editor, unchanged.
 */
export default function Widgets(props) {
    if (typeof props.onSubmit === 'function') {
        return <FormWidgetEditor {...props} />;
    }
    return <WidgetBuilder widget={props.widget} storeLocales={props.storeLocales} primaryLocale={props.primaryLocale} />;
}
