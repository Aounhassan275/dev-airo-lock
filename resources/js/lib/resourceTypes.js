// What a lock protects — access_rules.resource_type, presented for humans.

const LABELS = {
    product: ['Product', 'Products'],
    variant: ['Variant', 'Variants'],
    collection: ['Collection', 'Collections'],
    page: ['Page', 'Pages'],
    blog: ['Blog', 'Blogs'],
    theme: ['Theme', 'Themes'],
    checkout: ['Checkout', 'Checkout'],
    shop: ['Entire store', 'Entire store'],
};

const COLORS = {
    product: { bg: '#ede9fe', fg: '#5b21b6' },
    variant: { bg: '#ede9fe', fg: '#5b21b6' },
    collection: { bg: '#dbeafe', fg: '#1e40af' },
    page: { bg: '#dcfce7', fg: '#166534' },
    blog: { bg: '#fef3c7', fg: '#92400e' },
    theme: { bg: '#e0f2fe', fg: '#075985' },
    checkout: { bg: '#ffe4e6', fg: '#9f1239' },
    shop: { bg: '#fee2e2', fg: '#991b1b' },
};

export const NEUTRAL_COLOR = { bg: '#f3f4f6', fg: '#374151' };

export function resourceTypeLabel(type, count = 1) {
    const [one, many] = LABELS[type] ?? [type, type];
    // "Entire store" stays singular however many rules point at it.
    if (one === many || count <= 1) return one;
    return `${count} ${many}`;
}

export function resourceTypeColor(type) {
    return COLORS[type] ?? NEUTRAL_COLOR;
}

// [{ type, count }], biggest group first.
export function resourceTypesFromRules(rules = []) {
    const counts = new Map();
    for (const rule of rules) {
        const type = rule?.resource_type;
        if (!type) continue;
        counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return [...counts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
}

// The lock's kind is orthogonal to what it targets: a price rule still sits on
// products. Null for a plain lock, which needs no extra label.
export function lockKindLabel(type) {
    if (type === 'price_hide') return 'Hide price';
    if (type === 'content_lock') return 'Content lock';
    return null;
}

export function resourceTypePillStyle(type) {
    const { bg, fg } = resourceTypeColor(type);
    return {
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        background: bg,
        color: fg,
    };
}
