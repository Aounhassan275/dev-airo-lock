/* ---------------------------------------------------------------------------
   What setup and the lock builder have in common.

   The two screens ask the same questions in a different order: what the lock
   covers, what locking does, who gets through. So they are built from the same
   controls (see "the lock form" in app.css) and read the same data from here.

   Load this before setup.js or builder.js.
--------------------------------------------------------------------------- */

const $ = (id) => document.getElementById(id);


/* Store and Checkout cover everything, so there is nothing to pick. */
const WHOLE = { Store: 'Every page of your storefront', Checkout: 'Your checkout' };

/* Sample rows per type. A collection picker listing snowboards with a vendor
   under each is the kind of detail that makes a mockup read as unconsidered. */
const SAMPLES = {
    products: [
        ['The Collection Snowboard: Liquid', 'Vendor: Hydrogen Vendor'],
        ['The Inventory Not Tracked Snowboard', 'Vendor: aounshah275'],
        ['Gift Card', 'Vendor: Snowboard Vendor'],
        ['The Archived Snowboard', 'Vendor: Snowboard Vendor'],
        ['The Minimal Snowboard', 'Vendor: aounshah275'],
        ['The Multi-managed Snowboard', 'Vendor: Multi-managed Vendor'],
    ],
    collections: [
        ['Trade & Wholesale', '42 products'], ['Bulk packs', '18 products'],
        ['New arrivals', '24 products'], ['Summer sale', '9 products'],
    ],
    pages: [
        ['Trade terms', '/pages/trade-terms'], ['Price list 2026', '/pages/price-list-2026'],
        ['Downloads', '/pages/downloads'], ['About us', '/pages/about-us'],
    ],
    blogs: [['News', '38 posts'], ['Trade updates', '12 posts'], ['Care guides', '7 posts']],
    'liquid theme': [['Dawn', 'Live theme'], ['Refresh', 'Draft'], ['Dawn — trade copy', 'Draft']],
    'hide price rule': [
        ['The Collection Snowboard: Liquid', 'Vendor: Hydrogen Vendor'],
        ['The Minimal Snowboard', 'Vendor: aounshah275'],
        ['The Archived Snowboard', 'Vendor: Snowboard Vendor'],
    ],
};

const PICK_ART = {
    box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"></path><path d="M3 8l9 5 9-5"></path>',
    page: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"></path><path d="M14 3v5h5"></path>',
    code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"></path>',
};

/* The twelve conditions, in the order LockCreationFlow.jsx lists them, with
   the field each needs. Labels, placeholders and help text are the app's own;
   plan badges come from condition_feature_map. */
const CONDITIONS = [
    { v: 'tag', label: 'If user is tagged with…', w: 'text', sum: 'Customer tag',
      field: { t: 'input', label: 'Customer tag', ph: 'e.g., VIP, B2B',
               help: 'Customers must have this tag applied to their account' } },
    { v: 'signedIn', label: 'If user is signed in', w: 'text', sum: 'Signed-in customers',
      field: { t: 'select', label: 'Customer state', opts: ['Logged-in customers', 'Guests'],
               help: 'Check if customer is signed in or not' } },
    { v: 'singlePasscode', label: 'If user gives the passcode…', w: 'form', sum: 'A passcode',
      fields: ['Passcode'],
      field: { t: 'input', label: 'Passcode', ph: 'e.g., 1234',
               help: 'The exact passcode customers must enter' } },
    { v: 'multiplePasscodes', label: 'If user gives one of many passcodes…', w: 'form',
      sum: 'One of many passcodes', fields: ['Passcode'], bulk: 'passcodes',
      field: { t: 'textarea', label: 'Multiple passcodes', ph: 'e.g., 1234',
               help: 'Customers can use any of these passcodes.' } },
    { v: 'singleSecretLink', label: 'If user arrives via a secret link…', w: 'text',
      sum: 'A secret link',
      field: { t: 'input', label: 'Secret link code', ph: 'e.g., summer-sale-2024',
               help: 'Customers must arrive via a link carrying this code. You can also append ?access=CODE to any page link.' } },
    { v: 'location', label: 'If user is visiting from a certain location', w: 'text',
      sum: 'A location',
      field: { t: 'select', label: 'Country',
               opts: ['United Kingdom', 'United States', 'Germany', 'France', 'Japan'], help: '' } },
    { v: 'specificEmail', label: 'If user has a certain email address', w: 'text',
      sum: 'A specific email',
      field: { t: 'input', label: 'Email address', ph: 'e.g., customer@example.com',
               help: 'Exact email address required' } },
    { v: 'emailContains', label: 'If user email address contains…', w: 'text',
      sum: 'An email domain',
      field: { t: 'input', label: 'Email contains', ph: 'e.g., @company.com',
               help: 'Email address must contain this text' } },
    { v: 'emailFromList', label: 'If user email is on a list…', w: 'text',
      sum: 'An email list', bulk: 'email addresses',
      field: { t: 'textarea', label: 'Allowed email addresses', ph: 'e.g., customer@example.com',
               help: 'Anyone on this list gets in.' } },
    { v: 'pairedCredentials', label: 'If user gives the passcode issued to their email…', w: 'form',
      sum: 'Email + its own passcode', fields: ['Email address', 'Passcode'],
      bulk: 'email and passcode pairs',
      field: { t: 'textarea', label: 'Email and passcode pairs', ph: 'hana@mori.jp,TRADE-8841',
               help: 'Each passcode works only for the email address next to it.' } },
    { v: 'ip', label: 'If user has a certain IP address', w: 'text', sum: 'An IP address',
      field: { t: 'input', label: 'IP address (IPv4/IPv6)', ph: 'e.g., 203.0.113.42',
               help: 'Only allow access from specific IP addresses' } },
    { v: 'ageVerification', label: 'If user confirms their age…', w: 'form',
      sum: 'Age confirmation', confirm: 'I am over 18',
      field: { t: 'input', label: 'Minimum age required', ph: '18', help: '' } },
];

const byValue = (v) => CONDITIONS.find((c) => c.v === v) || CONDITIONS[2];

function countLabel(n, label) {
    const word = n === 1 ? label.toLowerCase().replace(/s$/, '') : label.toLowerCase();
    return `${n} ${word}`;
}

/* What the open picker is picking, so the toolbar can name it. */
let pickNoun = 'products';

function renderPicker(noun) {
    const rows = SAMPLES[noun] || SAMPLES.products;
    const art = noun === 'pages' || noun === 'blogs' ? PICK_ART.page
        : noun === 'liquid theme' ? PICK_ART.code : PICK_ART.box;
    // A price rule picks products; counting it as 'hide price rule' reads
    // like a typo in the toolbar.
    pickNoun = noun === 'hide price rule' ? 'products' : noun;

    $('pickList').innerHTML = rows.map(([title, meta]) =>
        '<label class="pick-row"><input type="checkbox">'
        + '<span class="thumb ' + noun.replace(/ /g, '-') + '">'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" '
        + 'stroke="currentColor" stroke-width="1.6">' + art + '</svg></span>'
        + '<span class="grow"><span class="sm strong" style="display:block">' + title + '</span>'
        + '<span class="xs sub">' + meta + '</span></span></label>').join('');

    /* The picker names what it is picking. */
    $('pickTitle').textContent = 'Select ' + noun;
    $('pickSearch').textContent = 'Search ' + noun + '…';
    paintPicker();
}

/** Everything the toolbar and the footer say about the selection, in one
    place, called on every change rather than written once at open. */
function paintPicker() {
    const boxes = [...$('pickModal').querySelectorAll('.pick-row input')];
    const picked = boxes.filter((b) => b.checked);
    const all = picked.length === boxes.length && boxes.length > 0;

    boxes.forEach((b) => b.closest('.pick-row').classList.toggle('on', b.checked));

    $('pickShowing').textContent = picked.length === 0
        ? countLabel(boxes.length, pickNoun)
        : `${picked.length} of ${boxes.length} selected`;
    $('pickShowing').classList.toggle('none', picked.length === 0);

    // A Select all with nothing left to select is a dead control.
    $('pickAll').textContent = all ? 'Clear selection' : 'Select all';

    $('pickCount').textContent = picked.length === 0
        ? 'Nothing selected yet'
        : 'Only these are locked. Everything else stays open.';
    $('pickAdd').disabled = picked.length === 0;
    $('pickAdd').textContent = picked.length === 0
        ? 'Add selected' : 'Add ' + countLabel(picked.length, pickNoun);
}

/* A checkbox card carries its state in a class rather than :has(input:checked),
   which paints on load but does not always drop when the box is unchecked. */
document.querySelectorAll('.act input[type="checkbox"]').forEach((box) => {
    const paint = () => box.closest('.act').classList.toggle('on', box.checked);
    box.addEventListener('change', paint);
    paint();
});

/* The settings radio cards. #action is painted by applyAction, which also
   switches the rest of the step; these three only pick themselves, so one
   listener per group is the whole behaviour. */
document.querySelectorAll('.acts[role="radiogroup"], .seg[role="radiogroup"], '
    + '.chips[role="radiogroup"], .picks[role="radiogroup"]')
    .forEach((g) => {
    /* #action and #operator are painted by whoever owns what they change. */
    if (g.id === 'action' || g.id === 'operator') return;
    const items = [...g.querySelectorAll('.act, .seg-b, .chip, .pick')];
    g.addEventListener('change', () => {
        items.forEach((c) => c.classList.toggle('on', c.querySelector('input').checked));
    });
});

/* A checkbox card carries its state in a class rather than :has(input:checked),
   which paints on load but does not always drop when the box is unchecked. */
function wireCheckCards(root = document) {
    root.querySelectorAll('.act input[type="checkbox"]').forEach((box) => {
        const paint = () => box.closest('.act').classList.toggle('on', box.checked);
        box.addEventListener('change', paint);
        paint();
    });
}

/* ----------------------------------------------------- store locales -- */

/* What the store publishes. Shopify's Markets settings decide this and
   Translate & Adapt fills it, so the app reads it rather than shipping a
   list — these are the sample store's four. */
const STORE_LOCALES = [
    ['English', true], ['Deutsch', false],
    ['Fran\u00e7ais', false], ['\u65e5\u672c\u8a9e', false],
];

/** Put the store's languages into every select that lists them, so the widget
    editor and the wording editor can never disagree about the same store. */
function fillLocales() {
    const widget = $('wLang');
    if (widget) {
        widget.innerHTML = '<option>Follow the storefront language (recommended)</option>'
            + STORE_LOCALES.map(([name]) => '<option>' + name + '</option>').join('');
    }
    const wording = document.getElementById('wordLang');
    if (wording) {
        wording.innerHTML = STORE_LOCALES.map(([name, primary]) =>
            '<option>' + name + (primary ? ' (primary)' : '') + '</option>').join('');
    }
    if ($('wLangNote')) {
        $('wLangNote').textContent = 'Synced \u2014 your store publishes '
            + countLabel(STORE_LOCALES.length, 'languages') + ', '
            + STORE_LOCALES[0][0] + ' first.';
    }
}

/* ------------------------------------------------------- the palettes -- */

/* The palettes the widget editor ships with, exactly as Widgets.jsx defines
   them. Order of the swatches is the order they are applied: text, card,
   button background, button text. */
const PALETTES = [
    ['Classic Dark', { text: '#FFFFFF', card: '#6B7280', buttonBg: '#000000', buttonText: '#FFFFFF' }],
    ['Midnight Orchid', { text: '#15173D', card: '#E491C9', buttonBg: '#982598', buttonText: '#F1E9E9' }],
    ['Minimal Light', { text: '#222222', card: '#FFFFFF', buttonBg: '#3B82F6', buttonText: '#FFFFFF' }],
    ['Vibrant Sunset', { text: '#2D1B69', card: '#FFF2E5', buttonBg: '#FF6B00', buttonText: '#FFFFFF' }],
    ['Emerald', { text: '#0F3D2E', card: '#E8FFF5', buttonBg: '#10B981', buttonText: '#FFFFFF' }],
    ['Ocean Blue', { text: '#0A2540', card: '#E6F4FF', buttonBg: '#1E88E5', buttonText: '#FFFFFF' }],
];

const PALETTE_KEYS = ['text', 'card', 'buttonBg', 'buttonText'];
