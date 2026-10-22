// What the popup will actually say, for the lock builder's preview.
//
// This has to agree with the server, or the preview lies. The server resolves
// the same question in two passes — PopupTextOverrides writes the lock's
// wording onto a per-rule copy of the widget payload, then PopupTextBaker fills
// whatever is still blank with the translated default — which comes out as:
//
//     lock override  >  widget value  >  translated default
//
// Field labels are the one asymmetry: they are written onto the condition
// rather than into the widget, so a label the merchant typed on an individual
// condition beats the lock-wide override, and the widget has no say at all.

/**
 * Which popup inputs a condition draws, in order.
 *
 * Mirrors inputFieldsFor() in extensions/access-controll/assets/access_validator.js.
 * 'pairedCredentials' is the only type that draws two, and it must not be
 * matched by the "contains email" test — hence the explicit case first.
 */
export function inputFieldsFor(type) {
    if (!type) return [];
    if (type === 'pairedCredentials') return ['email', 'passcode'];
    if (type === 'ageVerification') return ['dob'];

    const name = String(type).toLowerCase();
    if (name.includes('email')) return ['email'];
    if (name.includes('passcode')) return ['passcode'];

    return [];
}

/** The input boxes this lock's conditions produce, in the order shown. */
export function previewFields(groups = []) {
    const fields = [];

    for (const group of groups || []) {
        for (const condition of group?.conditions || []) {
            inputFieldsFor(condition?.type).forEach((kind, index) => {
                fields.push({
                    kind,
                    // A label typed on the condition wins over everything, but
                    // the popup applies it to that condition's FIRST field only.
                    label: index === 0 && condition?.label ? String(condition.label) : null,
                });
            });
        }
    }

    return fields;
}

const blank = (value) => String(value ?? '').trim() === '';

/**
 * Resolve every string the popup renders.
 *
 * @param {object}   opts.text       the lock's popup_text overrides
 * @param {string}   opts.description the lock's message line
 * @param {object}   opts.design     the widget's designOptions
 * @param {Function} opts.translate  (key) => translated default
 */
export function resolvePopupCopy({ text = {}, description = '', design = {}, translate }) {
    const pick = (override, widgetValue, key) => {
        if (!blank(override)) return String(override).trim();
        if (!blank(widgetValue)) return String(widgetValue).trim();

        return translate(key);
    };

    // Labels never consult the widget — they are written onto the condition.
    const label = (override, key) => (blank(override) ? translate(key) : String(override).trim());

    return {
        title: pick(text.header, design.headerSettings?.text, 'header.locked'),
        description: blank(description) ? translate('prompt.default') : String(description).trim(),
        button: pick(text.button, design.layout?.buttonText, 'button.submit'),
        passcodeLabel: label(text.passcode_label, 'label.passcode'),
        passcodePlaceholder: pick(text.passcode_placeholder, design.placeholderText, 'placeholder.code'),
        emailLabel: label(text.email_label, 'label.email'),
        emailPlaceholder: pick(text.email_placeholder, design.emailPlaceholderText, 'placeholder.email'),
        dobLabel: translate('label.dob'),
    };
}
