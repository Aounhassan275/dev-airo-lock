import { useMemo } from 'react';
import { previewFields, resolvePopupCopy } from '../../lib/popupPreview';
import { applyLanguageForPreview, isRTLLocale, translate } from '../../lib/widgetLanguages';
import { PadlockIcon } from './LockIcons';

/** HSB ({hue, saturation, brightness}) → hex, as the text widget stores it. */
function hsbToHex(hsb) {
    if (!hsb || typeof hsb !== 'object') return null;
    const { hue = 0, saturation = 0, brightness = 1 } = hsb;
    const h = hue / 360;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = brightness * (1 - saturation);
    const q = brightness * (1 - f * saturation);
    const t = brightness * (1 - (1 - f) * saturation);
    const [r, g, b] = [
        [brightness, t, p],
        [q, brightness, p],
        [p, brightness, t],
        [p, q, brightness],
        [t, p, brightness],
        [brightness, p, q],
    ][((i % 6) + 6) % 6];
    const hex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');

    return `#${hex(r)}${hex(g)}${hex(b)}`;
}

const asColor = (value) => (typeof value === 'string' && value ? value : hsbToHex(value));

/**
 * The four colours a widget paints the popup with. Form widgets keep hex under
 * designOptions.colors; text widgets keep HSB as textColor / backgroundColor
 * and have no button of their own.
 */
export function widgetColors(widget) {
    const config = widget?.configuration || {};
    const colors = config.designOptions?.colors || {};

    return {
        card: asColor(colors.card) || asColor(config.backgroundColor) || '#ffffff',
        text: asColor(colors.text) || asColor(config.textColor) || '#333333',
        buttonBg: asColor(colors.buttonBg) || '#15518C',
        buttonText: asColor(colors.buttonText) || '#ffffff',
    };
}

/**
 * The rail: the popup as a shopper sees it, on the light stage, and under it
 * what the lock adds up to. Text resolves exactly as the storefront does —
 * lock override, then widget, then the translated default — and the boxes are
 * the ones this lock's conditions draw.
 */
export default function LockPreview({
    groups = [],
    popupText = {},
    description = '',
    widget = null,
    locale = 'en',
    gateAction = true,
    noPopupNote = '',
    embedOn = null,
    summaries = [],
}) {
    const copy = useMemo(() => {
        const design = widget?.configuration?.designOptions || {};
        const language = widget?.configuration?.language || null;
        applyLanguageForPreview({ ...(language || {}), mode: 'auto' });

        return {
            ...resolvePopupCopy({ text: popupText || {}, description, design, translate: (key) => translate(key, locale) }),
            rtl: isRTLLocale(locale),
        };
    }, [popupText, description, widget, locale]);

    const fields = useMemo(() => previewFields(groups), [groups]);
    const colors = widgetColors(widget);
    const off = embedOn === false;

    return (
        <div className="rail-c">
            <div className="stage">
                <div className={`device${off ? ' off' : ''}`}>
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
                    <div className="veil" style={gateAction ? undefined : { background: 'transparent' }}>
                        {gateAction ? (
                            <div
                                className="lk"
                                dir={copy.rtl ? 'rtl' : 'ltr'}
                                style={{ background: colors.card, color: colors.text }}
                            >
                                <div className="lk-ico">
                                    <PadlockIcon />
                                </div>
                                <div className="lk-t">{copy.title}</div>
                                <div className="lk-m">{copy.description}</div>
                                {fields.length === 0 ? (
                                    <p className="lk-m" style={{ marginTop: 8 }}>
                                        No boxes to fill in — just the message above.
                                    </p>
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
                                                  ? 'YYYY-MM-DD'
                                                  : copy.passcodePlaceholder;

                                        return (
                                            <div key={i}>
                                                <div className="lk-l">{label}</div>
                                                <div className="lk-f">{placeholder}</div>
                                            </div>
                                        );
                                    })
                                )}
                                <div className="lk-b" style={{ background: colors.buttonBg, color: colors.buttonText }}>
                                    {copy.button}
                                </div>
                            </div>
                        ) : (
                            <div className="lb-nopop">{noPopupNote || 'No popup is shown for this action.'}</div>
                        )}
                    </div>
                    {off ? <span className="dev-badge">Not running yet</span> : null}
                </div>
                <span className="stage-cap">
                    {embedOn === null ? 'What shoppers see' : embedOn ? 'Your lock, running' : 'Your lock, once the embed is on'}
                </span>
            </div>

            <ol className="osums">
                {summaries.map((s) => (
                    <li key={s.k} className={`sum${s.set ? ' set' : ''}`}>
                        <span className="sum-k">{s.k}</span>
                        <span className="sum-v">{s.v}</span>
                    </li>
                ))}
            </ol>
        </div>
    );
}
