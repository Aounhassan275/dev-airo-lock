// What the setup flow asks, in the app's own terms.
//
// Everything here mirrors the lock builder (pages/locks/LockCreationFlow.jsx):
// the content types, the "When locked" actions and the flags they set, the
// twelve conditions and which of them draw a form. The flow sends the same
// payload the builder does, so these must agree with it.

/** The eight content types, in the order the builder lists them. */
// `sum` is the name the shared stylesheet keys each tile's hue on.
export const CONTENT_TYPES = [
    { value: 'products', label: 'Products', sum: 'Products', noun: 'products', desc: 'Individual products, by hand or by a rule.', icon: 'products' },
    { value: 'collections', label: 'Collections', sum: 'Collections', noun: 'collections', desc: 'Lock a trade catalogue, leave the rest open.', icon: 'collections' },
    { value: 'pages', label: 'Pages', sum: 'Pages', noun: 'pages', desc: 'Course pages, downloads, price lists.', icon: 'pages' },
    { value: 'blogs', label: 'Blogs', sum: 'Blogs', noun: 'blogs', desc: 'A whole blog, for members-only writing.', icon: 'blogs' },
    { value: 'price_hide', label: 'Hide price rule', sum: 'Hide price rule', noun: 'products', desc: 'Products stay visible; price and cart hidden.', icon: 'price' },
    { value: 'themes', label: 'Liquid theme', sum: 'Liquid theme', noun: 'themes', desc: 'Target a theme rather than its pages.', icon: 'themes' },
    { value: 'store', label: 'Store', sum: 'Store', noun: 'store', desc: 'Every page of the storefront asks for access.', icon: 'store' },
    { value: 'checkout', label: 'Checkout (Plus)', sum: 'Checkout', noun: 'checkout', desc: 'Stop a locked item being bought via a cart link.', icon: 'checkout' },
];

/** Store and Checkout cover everything, so there is nothing to pick. */
export const WHOLE = {
    store: 'Every page of your storefront',
    checkout: 'Your checkout',
};

/** One "When locked" choice → the flags the save endpoint takes. */
export const LOCK_ACTION_FLAGS = {
    gate: { hideAddToCart: false, hideCompletely: false, protectProducts: false },
    hide_cart: { hideAddToCart: true, hideCompletely: false, protectProducts: false },
    hide_completely: { hideAddToCart: false, hideCompletely: true, protectProducts: false },
    hide_all: { hideAddToCart: false, hideCompletely: true, protectProducts: true },
    hide_collection_only: { hideAddToCart: false, hideCompletely: true, protectProducts: false },
    hide_cart_products: { hideAddToCart: true, hideCompletely: false, protectProducts: true },
};

const ACTIONS = {
    products: [
        ['gate', 'Require password / access'],
        ['hide_cart', 'Hide the Add to Cart button'],
        ['hide_completely', 'Hide the product completely'],
    ],
    collections: [
        ['gate', 'Require password / access (collection page)'],
        ['hide_all', 'Hide entire collection + its products'],
        ['hide_collection_only', 'Hide collection page only (keep products)'],
        ['hide_cart_products', 'Hide Add to Cart on its products'],
    ],
    pages: [
        ['gate', 'Require password / access'],
        ['hide_completely', "Hide completely (page won't load)"],
    ],
    blogs: [
        ['gate', 'Require password / access'],
        ['hide_completely', "Hide completely (page won't load)"],
    ],
    default: [['gate', 'Require password / access']],
};

export function actionsFor(type) {
    return ACTIONS[type] || ACTIONS.default;
}

/** One line each: the card gives these about 44 characters. */
export const LOCK_ACTION_HELP = {
    gate: 'Visitors must pass your conditions.',
    hide_cart: 'Visible, but the buy button is gone.',
    hide_completely: 'Hidden everywhere; the URL redirects.',
    hide_all: 'The collection and its products vanish.',
    hide_collection_only: 'The page hides; its products stay.',
    hide_cart_products: 'Visible, but none can be added to cart.',
};

/** What a shopper sees when the action is not "gate" — no popup at all. */
export const NO_POPUP_NOTE = {
    hide_cart: 'The product page looks normal. The Add to Cart button is simply not there.',
    hide_completely: 'The item is gone from grids, search and menus, and its URL redirects home.',
    hide_all: 'The collection and its products are gone from the storefront entirely.',
    hide_collection_only: 'The collection page is gone. Its products are still reachable on their own.',
    hide_cart_products: 'Products still appear. None of them can be added to the cart.',
    price_hide: 'Products stay visible. The price is replaced by your message.',
};

/** How long an unlock lasts — the builder's reprompt values. */
export const REPROMPT_OPTIONS = [
    { value: 'remember', title: 'Stay unlocked on this device', desc: 'They unlock once and are not asked again on that browser.', icon: 'device' },
    { value: 'session', title: 'Ask again next browsing session', desc: 'The unlock lasts until they close the browser.', icon: 'browser' },
    { value: 'always', title: 'Ask on every page view', desc: 'Every locked page asks again, every time.', icon: 'repeat' },
];

/**
 * The twelve conditions, in the builder's order. `w` is the widget kind the
 * builder pairs them with (FORM_BASED_CONDITIONS); `sum` is the short title a
 * row and the summary use; `field` describes the one input each needs.
 */
export const CONDITIONS = [
    { v: 'tag', label: 'If user is tagged with…', w: 'text', sum: 'Customer tag',
        field: { t: 'input', label: 'Customer tag', ph: 'e.g., VIP, B2B', help: 'Customers must have this tag applied to their account' } },
    { v: 'signedIn', label: 'If user is signed in', w: 'text', sum: 'Signed-in customers',
        field: { t: 'signedIn', label: 'Customer state', help: 'Check if customer is signed in or not' } },
    { v: 'singlePasscode', label: 'If user gives the passcode…', w: 'form', sum: 'A passcode',
        field: { t: 'input', label: 'Passcode', ph: 'e.g., 1234', help: 'The exact passcode customers must enter' } },
    { v: 'multiplePasscodes', label: 'If user gives one of many passcodes…', w: 'form', sum: 'One of many passcodes',
        field: { t: 'list', label: 'Multiple passcodes', ph: 'e.g., 1234', help: 'Customers can use any of these passcodes. Use "Add in bulk" to paste or upload a whole list at once.' } },
    { v: 'singleSecretLink', label: 'If user arrives via a secret link…', w: 'text', sum: 'A secret link',
        field: { t: 'secret', label: 'Secret link code', ph: 'e.g., summer-sale-2024', help: 'Customers must arrive via a link carrying this code. You can also append ?access=CODE to any page link.' } },
    { v: 'location', label: 'If user is visiting from a certain location', w: 'text', sum: 'A location',
        field: { t: 'location', label: 'Country', help: '' } },
    { v: 'specificEmail', label: 'If user has a certain email address', w: 'text', sum: 'A specific email',
        field: { t: 'input', label: 'Email address', ph: 'e.g., customer@example.com', help: 'Exact email address required' } },
    { v: 'emailContains', label: 'If user email address contains…', w: 'text', sum: 'An email domain',
        field: { t: 'input', label: 'Email contains', ph: 'e.g., @company.com', help: 'Email address must contain this text' } },
    { v: 'emailFromList', label: 'If user email is on a list…', w: 'text', sum: 'An email list',
        field: { t: 'emails', label: 'Allowed email addresses', ph: 'e.g., customer@example.com', help: 'Anyone on this list gets in. Use "Add in bulk" to paste or upload a whole customer list at once.' } },
    { v: 'pairedCredentials', label: 'If user gives the passcode issued to their email…', w: 'form', sum: 'Email + its own passcode',
        field: { t: 'pairs', label: 'Email and passcode pairs', help: 'Each passcode works only for the email address next to it. A customer enters both, and a code issued to someone else will not let them in.' } },
    { v: 'ip', label: 'If user has a certain IP address', w: 'text', sum: 'An IP address',
        field: { t: 'input', label: 'IP address (IPv4/IPv6)', ph: 'e.g., 203.0.113.42', help: 'Only allow access from specific IP addresses' } },
    { v: 'ageVerification', label: 'If user confirms their age…', w: 'form', sum: 'Age confirmation',
        field: { t: 'age', label: 'Minimum age required', help: 'Visitors must confirm they meet the minimum age requirement' } },
];

export const conditionByValue = (v) => CONDITIONS.find((c) => c.v === v) || null;

/** Condition types enforceable at checkout (same set as the builder). */
export const CHECKOUT_CONDITION_TYPES = new Set([
    'signedIn', 'singlePasscode', 'multiplePasscodes', 'specificEmail',
    'emailContains', 'emailFromList', 'pairedCredentials', 'location',
]);

/** Conditions whose value the save endpoint needs filled in. */
export const REQUIRES_VALUE = new Set([
    'singlePasscode', 'multiplePasscodes', 'passcodeFromList', 'tag', 'singleSecretLink',
    'specificEmail', 'emailContains', 'emailFromList', 'pairedCredentials', 'ip',
]);

export const USER_STATE_OPTIONS = [
    { label: 'Logged-in customers', value: 'loggedIn' },
    { label: 'Guests', value: 'guest' },
];

export const AGE_OPTIONS = [
    { label: '18 years old', value: '18' },
    { label: '21 years old', value: '21' },
    { label: '25 years old', value: '25' },
];

export const COUNTRY_OPTIONS = [
    ['AF', 'Afghanistan'], ['AL', 'Albania'], ['DZ', 'Algeria'], ['AR', 'Argentina'],
    ['AU', 'Australia'], ['AT', 'Austria'], ['BD', 'Bangladesh'], ['BE', 'Belgium'],
    ['BR', 'Brazil'], ['CA', 'Canada'], ['CN', 'China'], ['DK', 'Denmark'], ['EG', 'Egypt'],
    ['FI', 'Finland'], ['FR', 'France'], ['DE', 'Germany'], ['GR', 'Greece'], ['IN', 'India'],
    ['ID', 'Indonesia'], ['IR', 'Iran'], ['IQ', 'Iraq'], ['IE', 'Ireland'], ['IT', 'Italy'],
    ['JP', 'Japan'], ['MY', 'Malaysia'], ['MX', 'Mexico'], ['NL', 'Netherlands'],
    ['NZ', 'New Zealand'], ['NG', 'Nigeria'], ['NO', 'Norway'], ['PK', 'Pakistan'],
    ['PH', 'Philippines'], ['PL', 'Poland'], ['PT', 'Portugal'], ['RU', 'Russia'],
    ['SA', 'Saudi Arabia'], ['SG', 'Singapore'], ['ZA', 'South Africa'], ['KR', 'South Korea'],
    ['ES', 'Spain'], ['SE', 'Sweden'], ['CH', 'Switzerland'], ['TH', 'Thailand'],
    ['TR', 'Turkey'], ['AE', 'United Arab Emirates'], ['GB', 'United Kingdom'],
    ['US', 'United States'], ['VN', 'Vietnam'],
].map(([value, label]) => ({ value, label })).concat([{ value: 'custom', label: 'Custom…' }]);

/** The palettes the widget editor ships with (pages/widget/Widgets.jsx). */
export const PALETTES = [
    { key: 'classic-dark', label: 'Classic Dark', colors: { text: '#FFFFFF', card: '#6B7280', buttonBg: '#000000', buttonText: '#FFFFFF' } },
    { key: 'midnight-orchid', label: 'Midnight Orchid', colors: { text: '#15173D', card: '#E491C9', buttonBg: '#982598', buttonText: '#F1E9E9' } },
    { key: 'minimal-light', label: 'Minimal Light', colors: { text: '#222222', card: '#FFFFFF', buttonBg: '#3B82F6', buttonText: '#FFFFFF' } },
    { key: 'sunset', label: 'Vibrant Sunset', colors: { text: '#2D1B69', card: '#FFF2E5', buttonBg: '#FF6B00', buttonText: '#FFFFFF' } },
    { key: 'emerald', label: 'Emerald', colors: { text: '#0F3D2E', card: '#E8FFF5', buttonBg: '#10B981', buttonText: '#FFFFFF' } },
    { key: 'ocean-blue', label: 'Ocean Blue', colors: { text: '#0A2540', card: '#E6F4FF', buttonBg: '#1E88E5', buttonText: '#FFFFFF' } },
];

export const PALETTE_KEYS = ['text', 'card', 'buttonBg', 'buttonText'];

/** "1 product", "3 products", "1 entry". */
export function countLabel(n, label) {
    const lower = String(label).toLowerCase();
    let word = lower;
    if (n === 1) {
        word = lower.endsWith('ies') ? `${lower.slice(0, -3)}y` : lower.replace(/s$/, '');
    }
    return `${n} ${word}`;
}

/** Opens the Crisp chat (loaded by app.blade.php). */
export function openChat(event) {
    const crisp = typeof window !== 'undefined' ? window.$crisp : null;
    if (!crisp || typeof crisp.push !== 'function') return;
    if (event) event.preventDefault();
    crisp.push(['do', 'chat:show']);
    crisp.push(['do', 'chat:open']);
}
