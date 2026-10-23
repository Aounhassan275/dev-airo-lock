// Stroked, monochrome icons from the design mockup. They inherit the text
// colour, so a tile's tint decides what colour they are.

const base = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
};

const PATHS = {
    products: (<><path d="M3 8.2l9-5 9 5v7.6l-9 5-9-5z" /><path d="M3 8.2l9 5 9-5M12 13.2v7.6" /></>),
    collections: (<><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" /></>),
    pages: (<><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" /><path d="M14 3v5h5" /></>),
    blogs: (<path d="M4 5h16M4 10h16M4 15h10M4 20h7" />),
    price: (<><path d="M3.5 12.5l8-8H20v8.5l-8 8z" /><circle cx="15.8" cy="8.2" r="1.3" /><path d="M4 20l16-16" /></>),
    themes: (<path d="M12 3s5.5 5.3 5.5 9a5.5 5.5 0 11-11 0C6.5 8.3 12 3 12 3z" />),
    store: (<><path d="M4 9.5V20h16V9.5" /><path d="M3 9.5L4.8 4h14.4L21 9.5a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0z" /><path d="M10 20v-5h4v5" /></>),
    checkout: (<><path d="M3 4h2.2l2.1 10.5a1.6 1.6 0 001.6 1.3h8.3a1.6 1.6 0 001.6-1.3L20.5 7H6" /><circle cx="9.5" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" /></>),
    list: (<path d="M4 7h16M4 12h16M4 17h10" />),
    user: (<><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
    screen: (<><rect x="3" y="4" width="18" height="14" rx="2.5" /><path d="M3 9h18M8 22h8" /></>),
    tag: (<><path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-7-7A2 2 0 013 12.2V5a2 2 0 012-2h7.2a2 2 0 011.4.6l7 7a2 2 0 010 2.8z" /><circle cx="7.6" cy="7.6" r="1.3" /></>),
    key: (<><circle cx="7.5" cy="15.5" r="3.6" /><path d="M10.1 12.9L20 3m-3.1 3.1l2.6 2.6m-5.2-.1l2.3 2.3" /></>),
    wrench: (<path d="M14.9 6.1a4.6 4.6 0 01-6 6L4.4 16.6a2.1 2.1 0 103 3l4.5-4.5a4.6 4.6 0 006-6l-2.7 2.7-2.1-2.1z" />),
    chat: (<path d="M20 14a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2h12a2 2 0 012 2z" />),
    lock: (<><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>),
    hideCart: (<><path d="M3 4h2l2.3 10.5h9.9L19 7H6" /><circle cx="9.5" cy="19" r="1.4" /><circle cx="16.5" cy="19" r="1.4" /><path d="M3 3l18 18" /></>),
    eyeOff: (<><path d="M2 12s3.6-6.5 10-6.5c2 0 3.7.6 5.1 1.5M22 12s-3.6 6.5-10 6.5c-2.2 0-4-.7-5.4-1.7" /><path d="M3 3l18 18" /></>),
    eye: (<><path d="M2 12s3.6-6.5 10-6.5 10 6.5 10 6.5-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="2.6" /></>),
    collectionOnly: (<><rect x="3" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" /><path d="M14 17.5h7" /></>),
    device: (<><rect x="2.5" y="4" width="19" height="12.5" rx="2" /><path d="M8 20.5h8M12 16.5v4" /></>),
    browser: (<><rect x="2.5" y="4" width="19" height="16" rx="2" /><path d="M2.5 8.5h19M6 6.2h.01M8.6 6.2h.01" /></>),
    repeat: (<><path d="M20 11a8 8 0 0 0-14-4.5L4 9" /><path d="M4 13a8 8 0 0 0 14 4.5L20 15" /><path d="M4 5v4h4M20 19v-4h-4" /></>),
    warn: (<><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9L2.4 17.2A2 2 0 004.1 20.2h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /></>),
    check: (<path d="M4 12.5l5.5 5.5L20 7" />),
    trash: (<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />),
    chevron: (<path d="M9 18l6-6-6-6" />),
    close: (<path d="M6 6l12 12M18 6L6 18" />),
    search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>),
    popper: (<><path d="M3 21l4.6-11.4L18 20z" /><path d="M7.6 9.6L18 20" /><path d="M13.2 3.1v2.2M17.9 4.9l-1.6 1.6M20.6 9.4h-2.2M19.4 14.1l-1.9-1" /><circle cx="11.6" cy="7.6" r=".9" /></>),
};

export default function Icon({ name, size, strokeWidth, className, style }) {
    const sized = size ? { width: size, height: size } : {};
    return (
        <svg {...base} {...sized} strokeWidth={strokeWidth || base.strokeWidth} className={className} style={style}>
            {PATHS[name] || PATHS.lock}
        </svg>
    );
}

/** Which icon each "When locked" action wears. */
export const ACTION_ICON = {
    gate: 'lock',
    hide_cart: 'hideCart',
    hide_completely: 'eyeOff',
    hide_all: 'eyeOff',
    hide_collection_only: 'collectionOnly',
    hide_cart_products: 'hideCart',
};

/** The refresh glyph, used by "Refresh from Shopify". */
export function SyncGlyph() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 11a8 8 0 0 0-14-4.5L4 9" />
            <path d="M4 13a8 8 0 0 0 14 4.5L20 15" />
            <path d="M4 5v4h4M20 19v-4h-4" />
        </svg>
    );
}
