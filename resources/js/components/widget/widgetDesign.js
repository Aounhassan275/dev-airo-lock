/**
 * What a widget looks like, read the same way by the widget list and the
 * widget page, so the swatches in one and the palette chip in the other
 * cannot disagree.
 *
 * The two kinds store their colours differently, and that is kept as it is:
 *   form  configuration.designOptions.colors = { text, card, buttonBg, buttonText } (hex)
 *   text  configuration.textColor / backgroundColor (HSB objects)
 */

// ---------------------------------------------------------------- colours --

export const hsbToHex = (hsb) => {
    if (!hsb || typeof hsb !== 'object') return '#ffffff';
    const { hue = 0, saturation = 0, brightness = 1 } = hsb;
    const h = hue / 360;
    const s = saturation;
    const v = brightness;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    const [r, g, b] = [
        [v, t, p],
        [q, v, p],
        [p, v, t],
        [p, q, v],
        [t, p, v],
        [v, p, q],
    ][((i % 6) + 6) % 6];
    const toHex = (x) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const hexToHsb = (hex) => {
    const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
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
        if (max === r) {
            hue = ((g - b) / (max - min)) * 60;
            if (hue < 0) hue += 360;
        } else if (max === g) {
            hue = ((b - r) / (max - min)) * 60 + 120;
        } else {
            hue = ((r - g) / (max - min)) * 60 + 240;
        }
    }
    return { hue, saturation, brightness };
};

/** Any stored colour — hex string or HSB object — as a lowercase #rrggbb. */
export const toHex = (color, fallback = '#ffffff') => {
    if (!color) return fallback;
    if (typeof color === 'string') {
        const m = /^#?([a-f\d]{6})$/i.exec(color.trim());
        if (m) return `#${m[1].toLowerCase()}`;
        const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(color.trim());
        if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
        return fallback;
    }
    if (typeof color === 'object') return hsbToHex(color);
    return fallback;
};

// --------------------------------------------------------------- palettes --

/** The form editor's six palettes (text, card, button, button text). */
export const FORM_PALETTES = [
    { key: 'classic-dark', label: 'Classic Dark', colors: { text: '#FFFFFF', card: '#6B7280', buttonBg: '#000000', buttonText: '#FFFFFF' } },
    { key: 'midnight-orchid', label: 'Midnight Orchid', colors: { text: '#15173D', card: '#E491C9', buttonBg: '#982598', buttonText: '#F1E9E9' } },
    { key: 'minimal-light', label: 'Minimal Light', colors: { text: '#222222', card: '#FFFFFF', buttonBg: '#3B82F6', buttonText: '#FFFFFF' } },
    { key: 'sunset', label: 'Vibrant Sunset', colors: { text: '#2D1B69', card: '#FFF2E5', buttonBg: '#FF6B00', buttonText: '#FFFFFF' } },
    { key: 'emerald', label: 'Emerald', colors: { text: '#0F3D2E', card: '#E8FFF5', buttonBg: '#10B981', buttonText: '#FFFFFF' } },
    { key: 'ocean-blue', label: 'Ocean Blue', colors: { text: '#0A2540', card: '#E6F4FF', buttonBg: '#1E88E5', buttonText: '#FFFFFF' } },
];

/** The text editor's six palettes. A text widget has no button, so two colours. */
export const TEXT_PALETTES = [
    { key: 'classic-dark', label: 'Classic Dark', colors: { text: '#FFFFFF', card: '#000000' } },
    { key: 'minimal-light', label: 'Minimal Light', colors: { text: '#222222', card: '#FFFFFF' } },
    { key: 'vibrant-sunset', label: 'Vibrant Sunset', colors: { text: '#2D1B69', card: '#FFF2E5' } },
    { key: 'emerald', label: 'Emerald', colors: { text: '#0F3D2E', card: '#E8FFF5' } },
    { key: 'ocean-blue', label: 'Ocean Blue', colors: { text: '#0A2540', card: '#E6F4FF' } },
    { key: 'midnight-orchid', label: 'Midnight Orchid', colors: { text: '#15173D', card: '#E491C9' } },
];

export const COLOUR_KEYS = {
    form: ['text', 'card', 'buttonBg', 'buttonText'],
    text: ['text', 'card'],
};

export const COLOUR_LABELS = {
    text: 'Text',
    card: 'Card',
    buttonBg: 'Button BG',
    buttonText: 'Button text',
};

export const palettesFor = (kind) => (kind === 'text' ? TEXT_PALETTES : FORM_PALETTES);

/**
 * The palette these colours are, or null when they are nobody's. Stored
 * widgets keep colours, not a palette name, so this is worked out, never read.
 */
export function paletteFor(kind, colours) {
    const keys = COLOUR_KEYS[kind === 'text' ? 'text' : 'form'];
    return (
        palettesFor(kind).find((p) => keys.every((k) => toHex(p.colors[k]) === toHex(colours?.[k], ''))) || null
    );
}

// ---------------------------------------------------------------- reading --

/**
 * A saved widget's colours as hex, keyed text / card / buttonBg / buttonText.
 * A text widget has no button colours; those keys are absent.
 */
export function widgetColours(widget) {
    if (!widget) return {};
    if (widget.type === 'text') {
        const d = widget.textData || widget.configuration || {};
        return {
            text: toHex(d.textColor, '#333333'),
            card: toHex(d.backgroundColor, '#f5f5f5'),
        };
    }
    const c = (widget.formData || widget.configuration || {})?.designOptions?.colors || {};
    return {
        text: toHex(c.text, '#333333'),
        card: toHex(c.card, '#ffffff'),
        buttonBg: toHex(c.buttonBg, '#15518c'),
        buttonText: toHex(c.buttonText, '#ffffff'),
    };
}

// ------------------------------------------------------------------ misc ---

/** Naive CSS scoping for the preview (top-level rules and simple @media). */
export const scopeCss = (css, scope) => {
    if (!css || typeof css !== 'string') return '';
    const prefix = (src) =>
        src.replace(/(^|})(\s*[^@}{][^{}]*)\{/g, (m, b, sel) => {
            const scoped = sel
                .split(',')
                .map((s) => `${scope} ${s.trim()}`)
                .join(', ');
            return `${b} ${scoped}{`;
        });
    return css
        .replace(/@media[^{]+\{([\s\S]*?)\}/g, (full, inner) => full.replace(inner, prefix(inner)))
        .replace(/(^|})(\s*[^@}{][^{}]*)\{/g, (m, b, sel) => {
            const scoped = sel
                .split(',')
                .map((s) => `${scope} ${s.trim()}`)
                .join(', ');
            return `${b} ${scoped}{`;
        });
};

/** "1 lock" / "2 locks". */
export const countLabel = (n, noun) => `${n} ${n === 1 ? noun.replace(/s$/, '') : noun}`;
