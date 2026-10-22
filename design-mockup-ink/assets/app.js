/* ---------------------------------------------------------------------------
   Shared chrome + small interactions for the mockup.

   The Shopify admin frame is injected from here rather than copied into each
   page, so the screens cannot drift apart while the design is still being
   argued over. Everything below is presentation only — no data, no persistence.

   The shape matters: Shopify's sidebar carries the app's own navigation nested
   under the app entry, and the app draws inside a white rounded frame with its
   own title bar. About 258px of the window is gone before we render anything,
   which is why every screen here is designed against that remainder.
--------------------------------------------------------------------------- */

const ico = (d, extra = '') => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`;

const ICONS = {
    analytics: ico('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    store: ico('<path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6"/>'),
    agentic: ico('<circle cx="12" cy="12" r="8"/><path d="M9 12h.01M15 12h.01"/>'),
    pos: ico('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 12h8M8 17h4"/>'),
    flow: ico('<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H14a4 4 0 0 1 0 8H9.5"/>'),
    app: ico('<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>'),
    lock: ico('<rect x="4" y="10.5" width="16" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
    gear: ico('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.1 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14V14a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
    search: ico('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    bell: ico('<path d="M18 8a6 6 0 1 0-12 0c0 7-2 8-2 8h16s-2-1-2-8M13.7 21a2 2 0 0 1-3.4 0"/>'),
    panel: ico('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>'),
    chev: ico('<path d="M9 18l6-6-6-6"/>'),
    dots: ico('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
};

/* The app's own pages, as they appear nested in Shopify's sidebar. */
/* The app's real pages, as routes/web.php defines them today.

   The dashboard is not among them: in Shopify's sidebar the app's own entry
   is the way to its "/", and listing the same destination twice under itself
   would only make the app look like it has one more page than it has. */
const APP_NAV = [
    { key: 'locks', href: 'locks.html', label: 'Locks' },
    { key: 'widgets', href: 'widgets.html', label: 'Widgets' },
    { key: 'plans', href: 'plans.html', label: 'Subscriptions' },
    { key: 'onboarding', href: 'welcome.html', label: 'Onboarding' },
];

function sidebar(active) {
    const sub = APP_NAV.map((n) =>
        `<a class="sb-sub ${n.key === active ? 'on' : ''}" href="${n.href}">${n.label}</a>`).join('');

    return `
    <nav class="sb">
        <div class="sb-top">
            <span class="sb-logo" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
                    <path d="M15.3 4.2c-.2 0-.4.1-.6.2-.3-.9-.9-1.5-1.8-1.5h-.2C12.2 2.3 11.6 2 11 2 9 2 8 4.5 7.7 5.8l-1.4.4c-.4.1-.5.2-.5.6L4 19.6 14.6 22l4.6-1.1-3.3-16.6c-.1-.1-.3-.1-.6-.1zM11 5.3l-1.6.5C9.7 4.7 10.3 3.6 11 3.3v2zm1.6-.5l-.2-.9c.4.1.7.4.9 1l-.7-.1z"/>
                </svg>
            </span>
            <span style="color:var(--faint)" aria-hidden="true">${ICONS.panel}</span>
        </div>

        <div class="sb-search"><span style="opacity:.6">${ICONS.search}</span>
            <span>Search</span><span class="kbd">Ctrl K</span></div>

        <a class="sb-item" href="#"><span class="sb-ico">${ICONS.analytics}</span>Analytics</a>

        <div class="sb-sec">Sales channels <span style="opacity:.55;display:flex">${ICONS.chev}</span></div>
        <a class="sb-item" href="#"><span class="sb-ico">${ICONS.store}</span>Online Store</a>
        <a class="sb-item" href="#"><span class="sb-ico">${ICONS.agentic}</span>Agentic</a>
        <a class="sb-item" href="#"><span class="sb-ico">${ICONS.pos}</span>Point of Sale</a>

        <div class="sb-sec">Apps <span style="opacity:.55;display:flex">${ICONS.chev}</span></div>
        <a class="sb-item" href="#"><span class="sb-ico">${ICONS.flow}</span>Flow</a>
        <a class="sb-item" href="#"><span class="sb-ico">${ICONS.app}</span>aoun</a>
        <a class="sb-item on" href="dashboard.html">
            <span class="sb-ico">${ICONS.lock}</span>Airo Access Lock<span class="live"></span></a>
        ${sub}

        <div class="sb-foot">
            <a class="sb-item" href="#"><span class="sb-ico">${ICONS.gear}</span>Settings</a>
            <div class="sb-user">
                <span class="sb-ava">AOU</span>
                <span class="small">aounshah275</span>
                <span class="badge xs">dev</span>
                <span style="margin-left:auto;color:var(--faint)" aria-hidden="true">${ICONS.bell}</span>
            </div>
        </div>
    </nav>`;
}

function appHead() {
    return `<div class="app-head">
        <span class="app-mark" aria-hidden="true">
            <img src="https://cdn.shopify.com/s/files/1/0718/7723/0786/files/Lock.png?v=1778586829"
                 alt="" width="26" height="26" loading="lazy">
        </span>
        <span style="font-weight:650">Airo Access Lock &amp; Control</span>
        <span class="xs faint" style="margin-left:12px">Design proposal</span>
        <select class="select head-sel" style="margin-left:auto" aria-label="Language">
            <option>English</option><option>Deutsch</option><option>Fran&ccedil;ais</option>
        </select>
        <button class="btn plain" aria-label="More actions">${ICONS.dots}</button>
    </div>`;
}

/* The app's own mark, waiting. The shackle lifts and settles rather than a
   ring going round: a spinner belongs to any app, and this one does not. */
function bootLoader() {
    return `<div class="boot" role="status" aria-label="Loading Airo Access Lock">
        <span class="boot-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="44" height="44">
                <rect width="32" height="32" rx="7.5" class="boot-tile"/>
                <path class="boot-shackle" d="M11.4 14.5v-3a4.6 4.6 0 0 1 9.2 0v3"
                      fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/>
                <rect x="8.4" y="14.2" width="15.2" height="10.4" rx="3" fill="#fff"/>
                <circle cx="16" cy="18.4" r="1.7" class="boot-key"/>
                <rect x="15.1" y="18.4" width="1.8" height="3.4" rx=".9" class="boot-key"/>
            </svg>
        </span>
    </div>`;
}

/** Wrap whatever the page already has in <main> with the admin frame. */
function mountChrome(active) {
    const main = document.querySelector('main');
    const shell = document.createElement('div');
    shell.className = 'shell';
    shell.innerHTML = sidebar(active)
        + `<div class="stage-area"><div class="app-frame">${appHead()}`
        + `<div class="app-body"><div class="app-scroll"></div>${bootLoader()}</div>`
        + `</div></div>`;
    document.body.prepend(shell);
    shell.querySelector('.app-scroll').appendChild(main);

    /* About as long as the real thing takes to hand over its first screen.
       The fade is left to run out on its own rather than timed twice. */
    const boot = shell.querySelector('.boot');
    /* The app's own floating bits are part of the app, so they wait too. */
    document.documentElement.classList.add('booting');
    setTimeout(() => {
        document.documentElement.classList.remove('booting');
        boot.classList.add('gone');
        boot.addEventListener('transitionend', () => boot.remove(), { once: true });
    }, 460);
}

/* ------------------------------------------------------ tiny behaviours -- */

/* Every kind of single-select button in the mockup. Kept in one place because
   the preset swatches were silently dead for want of being listed here. */
const PICKABLE = '.choice, .chip, .preset, .opt';

/** Single-select within a group of pickable buttons. */
function pickOne(container, onPick) {
    if (!container) return;
    container.addEventListener('click', (e) => {
        const b = e.target.closest(PICKABLE);
        if (!b || !container.contains(b)) return;
        container.querySelectorAll(PICKABLE).forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        if (onPick) onPick(b);
    });
}

/** Mirror an input's value into a preview node, falling back to placeholder. */
function bind(inputId, targetId, fallback) {
    const i = document.getElementById(inputId);
    const t = document.getElementById(targetId);
    if (!i || !t) return;
    const sync = () => { t.textContent = i.value.trim() || fallback; };
    i.addEventListener('input', sync);
    sync();
}

/* ---------------------------------------------------------------------------
   "When locked, do this" — LockCreationFlow.jsx builds these per content type,
   and the help text is the app's own. Shared so the setup screen and the
   builder cannot describe the same choice differently.
--------------------------------------------------------------------------- */
const LOCK_ACTIONS = {
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

/* One line each: the card gives these about 44 characters. */
const LOCK_ACTION_HELP = {
    gate: 'Visitors must pass your conditions.',
    hide_cart: 'Visible, but the buy button is gone.',
    hide_completely: 'Hidden everywhere; the URL redirects.',
    hide_all: 'The collection and its products vanish.',
    hide_collection_only: 'The page hides; its products stay.',
    hide_cart_products: 'Visible, but none can be added to cart.',
};

/* Each action gets the mark the content types get, so the two questions
   beside each other are asked the same way. */
const ACTION_ICONS = {
    gate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>',
    hide_cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.3 10.5h9.9L19 7H6"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/><path d="M3 3l18 18"/></svg>',
    hide_completely: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5c2 0 3.7.6 5.1 1.5M22 12s-3.6 6.5-10 6.5c-2.2 0-4-.7-5.4-1.7"/><path d="M3 3l18 18"/></svg>',
    hide_all: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5c2 0 3.7.6 5.1 1.5M22 12s-3.6 6.5-10 6.5c-2.2 0-4-.7-5.4-1.7"/><path d="M3 3l18 18"/></svg>',
    hide_collection_only: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><path d="M14 17.5h7"/></svg>',
    hide_cart_products: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.3 10.5h9.9L19 7H6"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="16.5" cy="19" r="1.4"/><path d="M3 3l18 18"/></svg>',
};

/** What a shopper sees when the action is not "gate" — no popup at all. */
const NO_POPUP_NOTE = {
    hide_cart: 'The product page looks normal. The Add to Cart button is simply not there.',
    hide_completely: 'The item is gone from grids, search and menus, and its URL redirects home.',
    hide_all: 'The collection and its products are gone from the storefront entirely.',
    hide_collection_only: 'The collection page is gone. Its products are still reachable on their own.',
    hide_cart_products: 'Products still appear. None of them can be added to the cart.',
};

/** Render the actions for a content type as a radio group, each with what it
    does to the storefront. Returns the chosen value. */
function fillActionChoices(box, type) {
    const key = (type || '').toLowerCase();
    const list = LOCK_ACTIONS[key] || LOCK_ACTIONS.default;
    box.innerHTML = list.map(([v, label], i) => `
        <label class="act${i === 0 ? ' on' : ''}">
            <input type="radio" name="lockAction" value="${v}"${i === 0 ? ' checked' : ''}>
            <span class="act-ic" aria-hidden="true">${ACTION_ICONS[v] || ACTION_ICONS.gate}</span>
            <span class="act-c"><span class="act-t">${label}</span>
            <span class="act-d" title="${LOCK_ACTION_HELP[v] || ''}">${LOCK_ACTION_HELP[v] || ''}</span></span>
            <span class="act-tick" aria-hidden="true"></span>
        </label>`).join('');
    return list[0][0];
}

/* There used to be a second filler here that put the same list into a
   <select>, for the builder. The builder shows the cards now, so both screens
   ask the question the same way and there is one list to keep right. */
