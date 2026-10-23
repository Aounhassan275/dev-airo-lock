import { previewFields, resolvePopupCopy } from '../../lib/popupPreview';
import { translate } from '../../lib/widgetLanguages';
import Icon from './icons';

export const DEFAULT_LOOK = { text: '#1a1a1a', card: '#ffffff', buttonBg: '#1a1a1a', buttonText: '#ffffff' };

/** A widget's colours, from its saved configuration. */
export function widgetColors(widget) {
    if (!widget) return DEFAULT_LOOK;
    let config = widget.configuration;
    if (typeof config === 'string') {
        try {
            config = JSON.parse(config);
        } catch {
            config = {};
        }
    }
    const colors = config?.designOptions?.colors || {};
    return { ...DEFAULT_LOOK, ...colors };
}

export function widgetDesign(widget) {
    let config = widget?.configuration;
    if (typeof config === 'string') {
        try {
            config = JSON.parse(config);
        } catch {
            config = {};
        }
    }
    return config?.designOptions || {};
}

/**
 * The device every step that shows a popup draws. It resolves the wording
 * the way the storefront does (lock override > widget > translated default)
 * and draws only the boxes this lock's conditions ask for — a Text widget
 * draws none of them and no button, since it has nothing to submit.
 */
export default function PopupPreview({
    groups = [],
    colors = DEFAULT_LOOK,
    design = {},
    draft = null,
    popupText = {},
    description = '',
    showPopup = true,
    noPopupNote = '',
    off = false,
    caption = 'What shoppers see',
    locale = 'en',
}) {
    const t = (key) => translate(key, locale);
    const copy = resolvePopupCopy({ text: popupText, description, design, translate: t });
    const fields = previewFields(groups);
    const look = draft || colors;

    const cardStyle = { background: look.card, color: look.text };
    if (draft) {
        cardStyle.padding = `${draft.pad}px ${Number(draft.pad) + 6}px`;
        cardStyle.borderRadius = `${draft.rad}px`;
    }
    const buttonLabel = draft?.btnText || copy.button;

    return (
        <div className="stage w">
            <div className={`device${off ? ' off' : ''}`}>
                <div className="sk">
                    <i style={{ width: '46%', height: 12 }} /><i className="gap" />
                    <i /><i style={{ width: '88%' }} /><i style={{ width: '70%' }} /><i className="gap" />
                    <i style={{ width: '40%', height: 11 }} /><i /><i style={{ width: '80%' }} />
                </div>
                <div className="veil" style={showPopup ? undefined : { background: 'transparent' }}>
                    {showPopup ? (
                        <div className="lk" style={cardStyle}>
                            <div className="lk-ico"><Icon name="lock" size={15} strokeWidth={1.8} /></div>
                            <div className="lk-t">{copy.title}</div>
                            <div className="lk-m">{copy.description}</div>
                            {fields.map((field, i) => {
                                const label = field.label
                                    || (field.kind === 'email' ? copy.emailLabel : field.kind === 'dob' ? copy.dobLabel : copy.passcodeLabel);
                                const hint = field.kind === 'email' ? copy.emailPlaceholder : field.kind === 'dob' ? 'DD / MM / YYYY' : copy.passcodePlaceholder;
                                return (
                                    <div key={`${field.kind}-${i}`}>
                                        <div className="lk-l">{label}</div>
                                        <div className="lk-f">{hint}</div>
                                    </div>
                                );
                            })}
                            {fields.length > 0 ? (
                                <div className="lk-b" style={{ background: look.buttonBg, color: look.buttonText }}>{buttonLabel}</div>
                            ) : null}
                        </div>
                    ) : (
                        <div className="ob-nopop">{noPopupNote}</div>
                    )}
                </div>
                {off ? <span className="dev-badge">Not running yet</span> : null}
            </div>
            <span className="stage-cap">{caption}</span>
        </div>
    );
}
