import { useMemo } from 'react';
import { inputFieldsFor } from '../../lib/popupPreview';
import { localeLabel, normalizeLocale, preferredEditingLocale, translate } from '../../lib/widgetLanguages';
import { FIELDS, joinNames } from './PopupTextModal';

/** The language the rail previews in, to start with. */
export function initialPreviewLocale(widget, storeLocales, primaryLocale) {
    return preferredEditingLocale(widget?.configuration?.language || null, storeLocales, primaryLocale);
}

/** The store's published languages, as select options (English when unknown). */
export function useLocaleOptions(storeLocales = []) {
    return useMemo(() => {
        const codes = new Set(storeLocales.map((l) => normalizeLocale(l.locale)).filter(Boolean));
        if (codes.size === 0) codes.add('en');

        return Array.from(codes).map((code) => ({
            value: code,
            label: localeLabel(code, storeLocales.find((l) => normalizeLocale(l.locale) === code)?.name),
        }));
    }, [storeLocales]);
}

/**
 * Per-lock popup wording, in place: the same overrides the wording modal
 * edits (popup_text + the lock's message), beside the preview in the rail
 * rather than over it. Blank means "use the widget's wording, then the
 * translated default" — the placeholders show what that would be.
 *
 * Box wording is only offered for boxes this lock's conditions draw, unless
 * it was already set, so nothing saved is hidden.
 */
export default function PopupWording({
    popupText = {},
    description = '',
    onChange,
    onDescriptionChange,
    groups = [],
    widget = null,
    locale = 'en',
    onLocaleChange,
    localeOptions = [],
}) {
    const text = popupText || {};
    const widgetName = widget?.name ? String(widget.name).trim() : '';

    const kinds = useMemo(() => {
        const set = new Set();
        (groups || []).forEach((g) => (g?.conditions || []).forEach((c) => inputFieldsFor(c?.type).forEach((k) => set.add(k))));
        return set;
    }, [groups]);

    const changed = [
        ...(description.trim() ? ['message'] : []),
        ...FIELDS.filter((f) => (text[f.key] || '').trim() !== '').map((f) => f.short),
    ];

    const setField = (key, value) => onChange({ ...text, [key]: value });
    const byKey = Object.fromEntries(FIELDS.map((f) => [f.key, f]));
    const shown = (key) => {
        if ((text[key] || '').trim() !== '') return true;
        if (key.startsWith('passcode')) return kinds.has('passcode');
        if (key.startsWith('email')) return kinds.has('email');
        return true;
    };

    const input = (field) =>
        shown(field.key) ? (
            <div className="field" key={field.key}>
                <label className="label" htmlFor={`lb-word-${field.key}`}>
                    {field.label}
                </label>
                <input
                    id={`lb-word-${field.key}`}
                    className="input"
                    value={text[field.key] || ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={translate(field.translationKey, locale)}
                    autoComplete="off"
                />
            </div>
        ) : null;

    return (
        <div className="lb-says">
            <span className="sec-l" style={{ display: 'block', marginBottom: 5 }}>
                What the popup says
            </span>
            <p className="help">
                {widgetName ? (
                    <>
                        <b>{widgetName}</b> decides how this popup <em>looks</em>. Below is what it <em>says</em> — for
                        this lock only, without changing that design. Other locks using {widgetName} keep their own wording.
                    </>
                ) : (
                    <>
                        No design is selected, so it uses the default look. Below is what it <em>says</em>, for this lock
                        only.
                    </>
                )}
            </p>

            <div className="between lb-word-head">
                <span className="sec-l" style={{ margin: 0 }}>
                    Wording for this lock
                </span>
                {localeOptions.length > 1 ? (
                    <select
                        className="select lb-auto lb-mini"
                        value={locale}
                        onChange={(e) => onLocaleChange(e.target.value)}
                        aria-label="Preview language"
                    >
                        {localeOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                ) : null}
            </div>
            <p className="help">
                Leave a box empty to keep the standard wording, translated into each customer’s language. Anything you
                type is shown to everyone exactly as written.
            </p>

            <div className="wfields mt12">
                {input(byKey.header)}
                <div className="field">
                    <label className="label" htmlFor="lb-word-message">
                        Message
                    </label>
                    <input
                        id="lb-word-message"
                        className="input"
                        value={description}
                        onChange={(e) => onDescriptionChange(e.target.value)}
                        placeholder={translate('prompt.default', locale)}
                        autoComplete="off"
                    />
                </div>
                {input(byKey.passcode_label)}
                {input(byKey.passcode_placeholder)}
                {input(byKey.email_label)}
                {input(byKey.email_placeholder)}
                {input(byKey.button)}
            </div>

            <div className="between mt8">
                <span className="help">
                    {changed.length > 0
                        ? `You changed the ${joinNames(changed)} on this lock.`
                        : 'Right now it uses the standard wording, translated into each customer’s language.'}
                </span>
                {changed.length > 0 ? (
                    <button
                        type="button"
                        className="btn plain xs lb-undo"
                        onClick={() => {
                            onChange({});
                            onDescriptionChange('');
                        }}
                    >
                        Undo my changes
                    </button>
                ) : null}
            </div>
        </div>
    );
}
