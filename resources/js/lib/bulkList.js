// Bulk entry for multi-value conditions (passcodes, email allow-lists).
//
// A merchant granting access to a couple of hundred customers is not going to
// click "Add another" two hundred times, so the list fields accept a pasted
// blob or an uploaded .csv/.txt. Storage is unchanged — the values still end
// up newline-joined in the condition's `value` (see listValue.js); this module
// only turns arbitrary pasted text into clean values.
//
// Separators: newline is canonical. Commas, semicolons and tabs come from
// spreadsheet exports (a one-column CSV pastes as lines, a one-row CSV as
// commas). Backslash is the reserved legacy separator described in
// listValue.js, so it can never appear inside a value and is safe to split on.
// A literal "\n" typed by hand is folded to a real newline first, or splitting
// on the backslash alone would leave "nvip2024" behind.
const SEPARATORS = /[\n\r,;\t\\]+/;

// Deliberately permissive: this rejects obvious junk (a "Customer email"
// header row, a stray name, a truncated address) without second-guessing the
// long tail of legal addresses. The real check is whether it matches the
// address the customer signs in with.
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

// A spreadsheet's column heading, dropped when it is the FIRST value in the
// paste. This matters most for passcode lists: an email header fails the
// address check anyway, but without this a merchant who downloads the template,
// fills it in and uploads it back gets a passcode literally called "passcode".
// Only an exact match at the top of the list is treated as a heading, so a
// value that happens to read "code" further down is still imported.
const HEADER_WORDS = new Set([
    'email',
    'emails',
    'email address',
    'email addresses',
    'e-mail',
    'passcode',
    'passcodes',
    'code',
    'codes',
    'access code',
    'access codes',
]);

// One condition's list is republished to a Shopify metafield on every save and
// read by every storefront visitor, so it is capped rather than unbounded.
export const MAX_LIST_ITEMS = 1000;

export function isValidEmail(value) {
    return EMAIL_PATTERN.test(String(value ?? '').trim());
}

/** Comparison key: emails match case-insensitively, passcodes exactly. */
function dedupeKey(value, kind) {
    const trimmed = String(value ?? '').trim();

    return kind === 'email' ? trimmed.toLowerCase() : trimmed;
}

/** Trim, unwrap the quotes a CSV export puts around fields, lowercase emails. */
function cleanToken(token, kind) {
    const unquoted = String(token ?? '')
        .trim()
        .replace(/^["']+|["']+$/g, '')
        .trim();

    return kind === 'email' ? unquoted.toLowerCase() : unquoted;
}

const BOM = String.fromCharCode(0xfeff);

/** Excel writes a byte-order mark at the start of a .csv; it is not data. */
function stripBom(text) {
    return text.startsWith(BOM) ? text.slice(BOM.length) : text;
}

/**
 * Split pasted text into values, dropping blanks, anything already in
 * `existing`, and — for email lists — anything that isn't an address.
 *
 * @returns {{values: string[], invalid: string[], duplicates: number}}
 */
export function parseBulkList(text, { kind = 'passcode', existing = [] } = {}) {
    const tokens = stripBom(String(text ?? ''))
        .replace(/\\n/g, '\n')
        .split(SEPARATORS);

    const seen = new Set(existing.map((v) => dedupeKey(v, kind)).filter((k) => k !== ''));
    const values = [];
    const invalid = [];
    let duplicates = 0;
    let first = true;

    for (const token of tokens) {
        const value = cleanToken(token, kind);
        if (!value) continue;

        const wasFirst = first;
        first = false;

        if (wasFirst && HEADER_WORDS.has(value.toLowerCase())) {
            invalid.push(value);
            continue;
        }

        if (kind === 'email' && !isValidEmail(value)) {
            invalid.push(value);
            continue;
        }

        const key = dedupeKey(value, kind);
        if (seen.has(key)) {
            duplicates += 1;
            continue;
        }

        seen.add(key);
        values.push(value);
    }

    return { values, invalid, duplicates };
}

/** Column heading used by both the export and the downloadable template. */
export function listHeader(kind) {
    return kind === 'email' ? 'email' : 'passcode';
}

/** Suggested filename for a download of this kind of list. */
export function listFilename(kind) {
    return kind === 'email' ? 'email-access-list.csv' : 'passcodes.csv';
}

function csvCell(value) {
    const text = String(value ?? '');

    // Quoting is for the spreadsheet's benefit. Note that a value containing a
    // comma does NOT survive a download/re-upload round trip — commas are a
    // separator on the way back in (SEPARATORS), so the value splits. Such
    // values cannot be bulk-entered in the first place, so nothing regresses;
    // they are only reachable by typing into a single field by hand.
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One value per row under a heading, which is what the parser reads back and
 * what a spreadsheet opens as a single column.
 *
 * The leading byte-order mark is what makes Excel treat the file as UTF-8
 * instead of the local codepage; `stripBom` removes it again on re-upload.
 */
export function toCsv(values, kind = 'passcode') {
    const rows = [listHeader(kind), ...values.map(csvCell)];

    return `${BOM}${rows.join('\r\n')}\r\n`;
}

/**
 * A fill-in-the-blanks file: the heading plus a few example rows, so a merchant
 * can build the list in a spreadsheet and upload it back.
 */
export function templateCsv(kind = 'passcode') {
    const examples =
        kind === 'email'
            ? ['customer1@example.com', 'customer2@example.com', 'customer3@example.com']
            : ['VIP-0001', 'VIP-0002', 'VIP-0003'];

    return toCsv(examples, kind);
}

/** How many entries in `items` repeat an earlier one (informational only). */
export function countDuplicates(items, kind = 'passcode') {
    const seen = new Set();
    let duplicates = 0;

    for (const item of items) {
        const key = dedupeKey(item, kind);
        if (key === '') continue;
        if (seen.has(key)) duplicates += 1;
        else seen.add(key);
    }

    return duplicates;
}
