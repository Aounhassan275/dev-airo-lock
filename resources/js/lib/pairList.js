// Paired credentials: one passcode that only works for one email address.
//
// An email allow-list plus a passcode list are two INDEPENDENT conditions —
// any listed passcode opens the lock for any listed email. Pairing them is a
// different question ("is this the code issued to THIS person?"), so it is its
// own condition type rather than a flag on the other two.
//
// Storage reuses the existing container: one newline-joined string (listValue.js),
// one pair per line, written `email,passcode`.
//
// The pair separator is the FIRST comma, semicolon, tab or colon on the line.
// An email address can contain none of those, so the left side is unambiguous
// and everything after the separator belongs to the passcode — `a@x.com,VIP,24`
// is the code `VIP,24`, not a parse error.
//
// Mirrored by splitPair() in extensions/access-controll/assets/access_validator.js,
// the checkout Function, and AccessRule::splitPair() in PHP. All four must
// agree or a credential the merchant can see in the admin fails to unlock.
// Explicit .js extensions: this is the first lib/ module to import another,
// and the node --test suite resolves these paths directly (Vite is fine either way).
import { isValidEmail } from './bulkList.js';
import { joinListValue, splitListValue } from './listValue.js';

const PAIR_SEPARATOR = /[,;\t:]/;
const BOM = String.fromCharCode(0xfeff);

/** Excel writes a byte-order mark at the start of a .csv; it is not data. */
function stripBom(text) {
    return text.startsWith(BOM) ? text.slice(BOM.length) : text;
}

/** Unwrap the quotes a spreadsheet puts around a cell: "VIP,24" → VIP,24. */
function unquote(cell) {
    const text = cell.trim();
    const inner = text.length >= 2 && text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1) : text;

    return inner.replace(/""/g, '"').trim();
}

/**
 * `email,passcode` → {email, passcode}. Either side may come back empty.
 *
 * Quotes are unwrapped per side AFTER the split, not before: a quoted passcode
 * can legitimately contain the separator ("VIP,24"), and splitting the raw line
 * on every separator would tear it apart.
 */
export function parsePair(line) {
    const text = stripBom(String(line ?? '')).trim();
    const at = text.search(PAIR_SEPARATOR);
    if (at === -1) return { email: unquote(text).toLowerCase(), passcode: '' };

    return {
        email: unquote(text.slice(0, at)).toLowerCase(),
        passcode: unquote(text.slice(at + 1)),
    };
}

/** {email, passcode} → the stored `email,passcode` line. */
export function formatPair(pair) {
    const email = String(pair?.email ?? '').trim().toLowerCase();
    const passcode = String(pair?.passcode ?? '').trim();
    if (!email && !passcode) return '';

    return `${email},${passcode}`;
}

/** The condition value → the rows the editor shows. Always at least one row. */
export function splitPairs(value) {
    const rows = splitListValue(value).map(parsePair);

    return rows.length > 0 ? rows : [{ email: '', passcode: '' }];
}

/** The editor rows → the condition value. Blank rows are dropped on save. */
export function joinPairs(rows) {
    return joinListValue(rows.map(formatPair));
}

export function isCompletePair(pair) {
    return isValidEmail(pair?.email) && String(pair?.passcode ?? '').trim() !== '';
}

/**
 * Parse a pasted or uploaded block into pairs.
 *
 * One pair per line. A line missing either half is reported rather than
 * silently half-imported — a row with an email and no code would lock that
 * customer out, which is worse than telling the merchant about it.
 *
 * @returns {{pairs: {email: string, passcode: string}[], invalid: string[], duplicates: number}}
 */
export function parseBulkPairs(text, { existing = [] } = {}) {
    const lines = stripBom(String(text ?? ''))
        .replace(/\\n/g, '\n')
        .split(/[\r\n]+/);

    // Keyed by email: one passcode per address is the whole point, so a repeat
    // of an address already on the list is a duplicate even when the code differs.
    const seen = new Set(existing.map((p) => String(p?.email ?? '').trim().toLowerCase()).filter(Boolean));
    const pairs = [];
    const invalid = [];
    let duplicates = 0;
    let first = true;

    for (const line of lines) {
        const raw = line.trim();
        if (!raw) continue;

        const pair = parsePair(raw);
        const wasFirst = first;
        first = false;

        // A two-column export starts with its heading row.
        if (wasFirst && pair.email === 'email' && /^pass ?code$|^code$/i.test(pair.passcode)) {
            invalid.push(raw);
            continue;
        }

        if (!isCompletePair(pair)) {
            invalid.push(raw);
            continue;
        }

        if (seen.has(pair.email)) {
            duplicates += 1;
            continue;
        }

        seen.add(pair.email);
        pairs.push(pair);
    }

    return { pairs, invalid, duplicates };
}

/** How many rows repeat an address already used above them. */
export function countDuplicateEmails(rows) {
    const seen = new Set();
    let duplicates = 0;

    for (const row of rows) {
        const email = String(row?.email ?? '').trim().toLowerCase();
        if (!email) continue;
        if (seen.has(email)) duplicates += 1;
        else seen.add(email);
    }

    return duplicates;
}

function csvCell(value) {
    const text = String(value ?? '');

    return /[",\n\r;\t:]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Two columns, one pair per row — what parseBulkPairs reads back. */
export function pairsToCsv(rows) {
    const lines = ['email,passcode', ...rows.map((p) => `${csvCell(p.email)},${csvCell(p.passcode)}`)];

    return `${BOM}${lines.join('\r\n')}\r\n`;
}

export function pairTemplateCsv() {
    return pairsToCsv([
        { email: 'customer1@example.com', passcode: 'VIP-0001' },
        { email: 'customer2@example.com', passcode: 'VIP-0002' },
        { email: 'customer3@example.com', passcode: 'VIP-0003' },
    ]);
}
