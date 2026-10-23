import { useEffect, useState } from 'react';
import CredentialPairField from '../locks/CredentialPairField';
import PasscodeListField from '../locks/PasscodeListField';
import {
    AGE_OPTIONS,
    CHECKOUT_CONDITION_TYPES,
    CONDITIONS,
    COUNTRY_OPTIONS,
    USER_STATE_OPTIONS,
    conditionByValue,
} from './constants';
import Icon from './icons';

/**
 * One condition's form. Clicking a row opens it here to edit; "Add condition"
 * opens it empty. Conditions that take a list carry "Add in bulk" (inside the
 * list fields), which opens on top and leaves this one underneath.
 */
export default function ConditionModal({
    open,
    index,
    condition,
    usedTypes = [],
    checkoutMode = false,
    storefrontBase = '',
    onSave,
    onClose,
}) {
    const isNew = index === null || index === undefined;
    const [draft, setDraft] = useState({ type: '', value: '' });
    const [error, setError] = useState('');

    const available = CONDITIONS.filter(
        (c) => (!checkoutMode || CHECKOUT_CONDITION_TYPES.has(c.v)) && (!usedTypes.includes(c.v) || c.v === condition?.type),
    );

    useEffect(() => {
        if (!open) return;
        setError('');
        if (condition) {
            setDraft({ ...condition });
        } else {
            const first = available[0];
            setDraft({ type: first ? first.v : '', value: '', invert: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, index]);

    if (!open) return null;

    const def = conditionByValue(draft.type);
    const f = def?.field;
    const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

    // A value typed for one check means nothing to another, so changing the
    // type starts the value again (the builder does the same).
    const changeType = (type) => setDraft({ type, value: '', invert: draft.invert || false });

    let control = null;
    if (f) {
        switch (f.t) {
            case 'signedIn':
                control = (
                    <select className="select" value={draft.value || 'loggedIn'} onChange={(e) => set({ value: e.target.value })}>
                        {USER_STATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                );
                break;
            case 'age':
                control = (
                    <select className="select" value={draft.value || '18'} onChange={(e) => set({ value: e.target.value })}>
                        {AGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                );
                break;
            case 'location':
                control = (
                    <>
                        <select className="select" value={draft.value || ''} onChange={(e) => set({ value: e.target.value })}>
                            <option value="">Select a country…</option>
                            {COUNTRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {draft.value === 'custom' ? (
                            <input
                                className="input mt8"
                                value={draft.custom || ''}
                                onChange={(e) => set({ custom: e.target.value })}
                                placeholder="e.g., New York, London, EU"
                                aria-label="Custom location"
                            />
                        ) : null}
                    </>
                );
                break;
            case 'list':
                control = (
                    <div className="ob-polaris-field">
                        <PasscodeListField
                            label={f.label}
                            value={draft.value || ''}
                            onChange={(v) => set({ value: v })}
                            placeholder={f.ph}
                            helpText={f.help}
                        />
                    </div>
                );
                break;
            case 'emails':
                control = (
                    <div className="ob-polaris-field">
                        <PasscodeListField
                            label={f.label}
                            value={draft.value || ''}
                            onChange={(v) => set({ value: v })}
                            kind="email"
                            itemLabel="Email"
                            addLabel="Add another email"
                            placeholder={f.ph}
                            helpText={f.help}
                        />
                    </div>
                );
                break;
            case 'pairs':
                control = (
                    <div className="ob-polaris-field">
                        <CredentialPairField value={draft.value || ''} onChange={(v) => set({ value: v })} helpText={f.help} />
                    </div>
                );
                break;
            case 'secret': {
                const code = String(draft.value || '').trim();
                const link = code && storefrontBase ? `${storefrontBase}/?access=${encodeURIComponent(code)}` : '';
                control = (
                    <>
                        <input className="input" value={draft.value || ''} onChange={(e) => set({ value: e.target.value })} placeholder={f.ph} />
                        {link ? (
                            <div className="row g8 mt8">
                                <input className="input grow" value={link} readOnly aria-label="Shareable secret link" />
                                <button type="button" className="btn" onClick={() => navigator.clipboard?.writeText(link)}>Copy</button>
                            </div>
                        ) : null}
                    </>
                );
                break;
            }
            default:
                control = <input className="input" value={draft.value || ''} onChange={(e) => set({ value: e.target.value })} placeholder={f.ph} />;
        }
    }

    // List-type fields render their own label and help (Polaris), so the
    // shell only adds them for the plain controls.
    const ownsLabel = f && ['list', 'emails', 'pairs'].includes(f.t);

    const save = () => {
        if (!draft.type) {
            setError('Choose a condition type.');
            return;
        }
        const next = { ...draft };
        if (next.type === 'signedIn' && !String(next.value || '').trim()) next.value = 'loggedIn';
        if (next.type === 'ageVerification' && !String(next.value || '').trim()) next.value = '18';
        onSave(next);
    };

    return (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} role="presentation">
            <div className="modal ob-cond-modal" style={{ maxWidth: ownsLabel ? 600 : 520 }} role="dialog" aria-modal="true" aria-labelledby="ob-cond-title">
                <div className="modal-head">
                    <h2 className="h-md" id="ob-cond-title">{isNew ? 'Add a condition' : `Condition ${index + 1}`}</h2>
                    <button type="button" className="btn plain" onClick={onClose} aria-label="Close">
                        <Icon name="close" size={14} />
                    </button>
                </div>
                <div className="ob-modal-body">
                    <div className="row g8" style={{ marginBottom: 12 }}>
                        <span className="tag">Permit if</span>
                        {def ? <span className={`tag ${def.w}`}>{def.w === 'form' ? 'Form' : 'Text'}</span> : null}
                    </div>
                    <div className={`cond-f${ownsLabel ? ' ob-cond-wide' : ''}`}>
                        <div className="field">
                            <label className="label" htmlFor="ob-cond-type">Condition type</label>
                            <select id="ob-cond-type" className="select" value={draft.type} onChange={(e) => changeType(e.target.value)}>
                                {available.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                            </select>
                        </div>
                        {f ? (
                            <div className="field">
                                {ownsLabel ? null : <span className="label">{f.label}</span>}
                                {control}
                                {!ownsLabel && f.help ? <span className="help">{f.help}</span> : null}
                            </div>
                        ) : null}
                    </div>
                    {error ? <p className="help ob-err mt8">{error}</p> : null}
                </div>
                <div className="modal-foot between">
                    <span className="xs sub">Every condition is checked when a shopper arrives.</span>
                    <div className="row g8">
                        <button type="button" className="btn" onClick={onClose}>Cancel</button>
                        <button type="button" className="btn primary" onClick={save}>{isNew ? 'Add condition' : 'Save condition'}</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
