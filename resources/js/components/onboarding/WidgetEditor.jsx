import { router } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { localeLabel, normalizeLocale } from '../../lib/widgetLanguages';
import { PALETTES, PALETTE_KEYS, countLabel } from './constants';
import { SyncGlyph } from './icons';

const FLOW_HEADERS = { 'X-Airo-Onboarding': '1' };

/** What the editor reads back to the preview while it is open. */
export function readDraft(colors, pad, rad, btnText) {
    return { ...colors, pad: Number(pad) || 10, rad: Number(rad) || 12, btnText: String(btnText || '').trim() };
}

/**
 * Making a widget, in the step rather than over it. The device beside the
 * form is the preview, and it repaints as you choose.
 *
 * It asks what the app's widget editor asks — a palette, the four colours,
 * card padding and radius, button text, and the popup language — and saves
 * through the same quick-create endpoint the lock builder uses, which
 * redirects back so the half-built lock survives.
 */
export default function WidgetEditor({
    kind,
    widgets = [],
    storeLocales = [],
    primaryLocale = '',
    onDraft,
    onCancel,
    onCreated,
    onError,
}) {
    const [name, setName] = useState('');
    const [palette, setPalette] = useState(PALETTES[0].key);
    const [colors, setColors] = useState({ ...PALETTES[0].colors });
    const [pad, setPad] = useState('10');
    const [rad, setRad] = useState('12');
    const [btnText, setBtnText] = useState('');
    const [language, setLanguage] = useState('');
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [synced, setSynced] = useState(false);
    const [nameError, setNameError] = useState('');

    useEffect(() => {
        onDraft(readDraft(colors, pad, rad, btnText));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colors, pad, rad, btnText]);

    const pickPalette = (p) => {
        setPalette(p.key);
        setColors({ ...p.colors });
    };

    // Changing a colour by hand means it no longer matches a named palette.
    const setColor = (k, v) => {
        setPalette('');
        setColors((c) => ({ ...c, [k]: v }));
    };

    const syncLanguages = () => {
        if (syncing) return;
        setSyncing(true);
        router.post('/widgets/refresh-locales', {}, {
            preserveState: true,
            preserveScroll: true,
            headers: FLOW_HEADERS,
            onSuccess: () => setSynced(true),
            onFinish: () => setSyncing(false),
        });
    };

    const save = () => {
        const trimmed = name.trim() || PALETTES.find((p) => p.key === palette)?.label || '';
        if (!trimmed) {
            setNameError('Give the design a name so you can find it later.');
            return;
        }
        setNameError('');
        setSaving(true);
        const knownIds = new Set(widgets.map((w) => String(w.id)));
        const configuration = {
            designOptions: {
                colors: { ...colors },
                layout: {
                    textAlignment: 'center',
                    verticalAlignment: 'top',
                    formPadding: '10',
                    borderRadius: '16',
                    cardPadding: String(Number(pad) || 10),
                    cardBorderRadius: String(Number(rad) || 12),
                    // Blank falls through to the translated default.
                    buttonText: btnText.trim(),
                },
            },
            customCss: '',
            language: language
                ? { mode: 'fixed', locale: normalizeLocale(language), translations: {} }
                : { mode: 'auto', locale: '', translations: {} },
        };

        router.post('/widgets/quick-create', { name: trimmed, type: kind, configuration }, {
            preserveState: true,
            preserveScroll: true,
            headers: FLOW_HEADERS,
            onSuccess: (page) => {
                const list = page.props[kind === 'text' ? 'textWidgets' : 'formWidgets'] || [];
                const created = list.find((w) => !knownIds.has(String(w.id)));
                if (created) onCreated(String(created.id));
                else onError('The widget was not created. Please try again.');
            },
            onError: (errors) => onError(Object.values(errors || {}).flat().join(', ') || 'Could not create the widget.'),
            onFinish: () => setSaving(false),
        });
    };

    const primary = storeLocales.find((l) => l.primary) || storeLocales[0];

    return (
        <div id="newWidget">
            <div className="between" style={{ flex: 'none', marginBottom: 9 }}>
                <span className="sec-l" style={{ margin: 0 }}>New {kind === 'text' ? 'text' : 'form'} widget</span>
                <span className="row g4">
                    <button type="button" className={`btn plain xs${syncing ? ' syncing' : ''}`} onClick={syncLanguages} disabled={syncing}>
                        <span className="pick-sync"><SyncGlyph /> Sync languages</span>
                    </button>
                </span>
            </div>

            <div className="fields2" style={{ flex: 'none' }}>
                <div className="field">
                    <label className="label" htmlFor="wNameIn">Widget name</label>
                    <input className="input" id="wNameIn" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Trade gate" autoFocus />
                    {nameError ? <span className="help ob-err">{nameError}</span> : null}
                </div>
                <div className="field">
                    <label className="label" htmlFor="wLang">Popup language</label>
                    <select className="select" id="wLang" value={language} onChange={(e) => setLanguage(e.target.value)}>
                        <option value="">Follow the storefront language (recommended)</option>
                        {storeLocales.map((l) => (
                            <option key={l.locale} value={l.locale}>{localeLabel(l.locale, l.name)}</option>
                        ))}
                    </select>
                    <span className="help" id="wLangNote">
                        {synced && storeLocales.length
                            ? `Synced — your store publishes ${countLabel(storeLocales.length, 'languages')}, ${localeLabel(primary?.locale || primaryLocale, primary?.name)} first.`
                            : 'Each visitor sees their own. Shopify decides which languages your store publishes.'}
                    </span>
                </div>
            </div>

            <div className="row g8 new-h" style={{ flex: 'none' }}>
                <span className="sec-l">Colour palettes</span><span className="tag">Basic</span>
            </div>
            <div className="palettes">
                {PALETTES.map((p) => (
                    <button type="button" key={p.key} className={`pal${palette === p.key ? ' on' : ''}`} onClick={() => pickPalette(p)}>
                        {p.label}
                        <span className="pal-sw">
                            {PALETTE_KEYS.map((k) => <i key={k} style={{ background: p.colors[k] }} />)}
                        </span>
                    </button>
                ))}
            </div>

            <div className="row g8 new-h" style={{ flex: 'none' }}>
                <span className="sec-l">Colours</span><span className="tag">Basic</span>
            </div>
            <div className="row g8 wrap" style={{ flex: 'none' }}>
                {[['text', 'Text'], ['card', 'Card'], ['buttonBg', 'Button BG'], ['buttonText', 'Button text']].map(([k, label]) => (
                    <label className="swatch" key={k}>
                        <input type="color" value={colors[k]} onChange={(e) => setColor(k, e.target.value)} />
                        <span>{label}</span>
                    </label>
                ))}
            </div>

            <div id="wStyle" style={{ flex: 'none' }}>
                <span className="sec-l new-h" style={{ display: 'block' }}>Style</span>
                <div className="wstyle">
                    <div className="field">
                        <label className="label" htmlFor="wPad">Card pad</label>
                        <div className="row g8"><input className="input" id="wPad" inputMode="numeric" value={pad} onChange={(e) => setPad(e.target.value)} /><span className="sm sub">px</span></div>
                    </div>
                    <div className="field">
                        <label className="label" htmlFor="wRad">Card rad</label>
                        <div className="row g8"><input className="input" id="wRad" inputMode="numeric" value={rad} onChange={(e) => setRad(e.target.value)} /><span className="sm sub">px</span></div>
                    </div>
                    {kind === 'text' ? null : (
                        <div className="field">
                            <label className="label" htmlFor="wBtnText">Button text</label>
                            <input className="input" id="wBtnText" value={btnText} onChange={(e) => setBtnText(e.target.value)} placeholder="Submit" />
                        </div>
                    )}
                </div>
            </div>
            <span className="help" id="newNote" style={{ display: 'block', flex: 'none', marginTop: 10 }}>
                Saved to your widget library and reusable by any lock.
            </span>

            <div className="row g8 new-foot" style={{ flex: 'none' }}>
                <button type="button" className="btn" onClick={onCancel} disabled={saving}>Cancel</button>
                <button type="button" className="btn primary" onClick={save} disabled={saving}>
                    {saving ? 'Creating…' : 'Create widget'}
                </button>
            </div>
        </div>
    );
}
