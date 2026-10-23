/**
 * Inline stroked icons for the lock builder, copied from the design mockup
 * (design-mockup-ink/lock-builder.html and assets/app.js). They draw in
 * currentColor so the tile they sit in decides their colour.
 */

const Svg = ({ children, width = 1.6, ...rest }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
    >
        {children}
    </svg>
);

/* ------------------------------------------------------- content types -- */

export const TYPE_ICONS = {
    products: (
        <Svg>
            <path d="M3 8.2l9-5 9 5v7.6l-9 5-9-5z" />
            <path d="M3 8.2l9 5 9-5M12 13.2v7.6" />
        </Svg>
    ),
    collections: (
        <Svg>
            <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
            <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
            <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
            <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
        </Svg>
    ),
    pages: (
        <Svg>
            <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
            <path d="M14 3v5h5" />
        </Svg>
    ),
    blogs: (
        <Svg>
            <path d="M4 5h16M4 10h16M4 15h10M4 20h7" />
        </Svg>
    ),
    price_hide: (
        <Svg>
            <path d="M3.5 12.5l8-8H20v8.5l-8 8z" />
            <circle cx="15.8" cy="8.2" r="1.3" />
            <path d="M4 20l16-16" />
        </Svg>
    ),
    themes: (
        <Svg>
            <path d="M12 3s5.5 5.3 5.5 9a5.5 5.5 0 11-11 0C6.5 8.3 12 3 12 3z" />
        </Svg>
    ),
    store: (
        <Svg>
            <path d="M4 9.5V20h16V9.5" />
            <path d="M3 9.5L4.8 4h14.4L21 9.5a3 3 0 01-6 0 3 3 0 01-6 0 3 3 0 01-6 0z" />
            <path d="M10 20v-5h4v5" />
        </Svg>
    ),
    checkout: (
        <Svg>
            <path d="M3 4h2.2l2.1 10.5a1.6 1.6 0 001.6 1.3h8.3a1.6 1.6 0 001.6-1.3L20.5 7H6" />
            <circle cx="9.5" cy="19.5" r="1.3" />
            <circle cx="17" cy="19.5" r="1.3" />
        </Svg>
    ),
};

/* ------------------------------------------------------------- actions -- */

const EyeOff = (
    <Svg>
        <path d="M2 12s3.6-6.5 10-6.5c2 0 3.7.6 5.1 1.5M22 12s-3.6 6.5-10 6.5c-2.2 0-4-.7-5.4-1.7" />
        <path d="M3 3l18 18" />
    </Svg>
);
const CartOff = (
    <Svg>
        <path d="M3 4h2l2.3 10.5h9.9L19 7H6" />
        <circle cx="9.5" cy="19" r="1.4" />
        <circle cx="16.5" cy="19" r="1.4" />
        <path d="M3 3l18 18" />
    </Svg>
);

export const ACTION_ICONS = {
    gate: (
        <Svg>
            <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </Svg>
    ),
    hide_cart: CartOff,
    hide_completely: EyeOff,
    hide_all: EyeOff,
    hide_collection_only: (
        <Svg>
            <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
            <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
            <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
            <path d="M14 17.5h7" />
        </Svg>
    ),
    hide_cart_products: CartOff,
};

/* ------------------------------------------------------- how long ------- */

export const REPROMPT_ICONS = {
    remember: (
        <Svg>
            <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
            <path d="M8 20.5h8M12 16.5v4" />
        </Svg>
    ),
    session: (
        <Svg>
            <rect x="2.5" y="4" width="19" height="16" rx="2" />
            <path d="M2.5 8.5h19M6 6.2h.01M8.6 6.2h.01" />
        </Svg>
    ),
    always: (
        <Svg>
            <path d="M20 11a8 8 0 0 0-14-4.5L4 9" />
            <path d="M4 13a8 8 0 0 0 14 4.5L20 15" />
            <path d="M4 5v4h4M20 19v-4h-4" />
        </Svg>
    ),
};

export const EyeOffIcon = () => EyeOff;
export const EyeIcon = () => (
    <Svg>
        <path d="M2 12s3.6-6.5 10-6.5 10 6.5 10 6.5-3.6 6.5-10 6.5S2 12 2 12z" />
        <circle cx="12" cy="12" r="2.6" />
    </Svg>
);

/* ---------------------------------------------------------------- misc -- */

export const BackIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
    </svg>
);

export const ListIcon = () => (
    <Svg>
        <path d="M4 7h16M4 12h16M4 17h10" />
    </Svg>
);

export const RefreshIcon = () => (
    <Svg width={2}>
        <path d="M20 11a8 8 0 0 0-14-4.5L4 9" />
        <path d="M4 13a8 8 0 0 0 14 4.5L20 15" />
        <path d="M4 5v4h4M20 19v-4h-4" />
    </Svg>
);

export const SearchIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
    </svg>
);

export const BinIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </svg>
);

export const CloseIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
    </svg>
);

export const ChevronRightIcon = () => (
    <Svg width={2}>
        <path d="M9 18l6-6-6-6" />
    </Svg>
);

export const ChevronDownIcon = () => (
    <Svg width={2}>
        <path d="M6 9l6 6 6-6" />
    </Svg>
);

export const PadlockIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
        <path d="M8 10.5V7.5a4 4 0 018 0v3" />
    </svg>
);

export const WarningIcon = () => (
    <Svg width={1.8}>
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 3.9L2.4 17.2A2 2 0 004.1 20.2h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    </Svg>
);

export const CheckIcon = () => (
    <Svg width={2.2}>
        <path d="M4 12.5l5.5 5.5L20 7" />
    </Svg>
);

export const InfoIcon = () => (
    <Svg width={1.8}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
    </Svg>
);
