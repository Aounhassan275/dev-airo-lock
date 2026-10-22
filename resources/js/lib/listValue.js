// Multi-value condition values (multiple passcodes, email lists) are stored
// as ONE newline-joined string — the storefront validator splits on '\n'.
// Old admin builds rendered the field placeholder with a literal '\n'
// ("passcode1\npasscode2\npasscode3"), which taught merchants to separate
// values with backslashes on a single line; those saves stored the whole
// line as one giant "passcode". Parsing recognises that legacy pattern so a
// broken save comes back as separate values (and is rewritten canonically
// on the next save). Backslash is therefore reserved as a separator — it
// cannot appear inside an individual passcode or email. The legacy split is
// inherently ambiguous when a value starts with 'n' ('vip\new2024' reads as
// 'vip'/'ew2024', since a literal '\n' must win) — merchants see the parsed
// fields in the editor and can correct them before saving.
export function splitListValue(value) {
    const raw = String(value ?? '');
    if (raw.includes('\n')) return raw.split('\n').map((s) => s.replace(/\r$/, ''));
    if (raw.includes('\\')) return raw.split(/\\n|\\/);
    return [raw];
}

export function joinListValue(items) {
    return items.join('\n');
}
