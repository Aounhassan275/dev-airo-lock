/* ---------------------------------------------------------------------------
   The one-page widget form — /widget/create and /widget/{widget}/edit.

   The same screen the lock form is, for the same reason, and built from the
   same shell ("one page" in app.css). What a widget is, though, is small
   enough that it needs no shared control layer: a name, a kind, four colours
   and three numbers, all of which only this page asks for.

   ?id=1 opens it on an existing widget.

   Needs: app.js (mountChrome) and lock-form.js ($, PALETTES, PALETTE_KEYS,
   countLabel, fillLocales).
--------------------------------------------------------------------------- */

const EDIT_ID = new URLSearchParams(location.search).get('id');

mountChrome('widgets');

/* The library, as the widget list shows it. Colours are the ones its swatch
   row already prints, so the list and this page cannot disagree. */
const WIDGETS = {
    1: {
        name: 'Trade gate', kind: 'form',
        c: { text: '#dfe5f5', card: '#111a33', buttonBg: '#ffffff', buttonText: '#111a33' },
        pad: 12, rad: 14, btnText: '',
        locks: [['Wholesale catalogue', 14], ['Members area', 15]],
    },
    2: {
        name: 'Members notice', kind: 'text',
        c: { text: '#4a3a1e', card: '#f5efe4', buttonBg: '#8a6a30', buttonText: '#ffffff' },
        pad: 10, rad: 12, btnText: '',
        locks: [['Members area', 15]],
    },
    3: {
        name: 'Age check', kind: 'form',
        c: { text: '#222222', card: '#ffffff', buttonBg: '#3b82f6', buttonText: '#ffffff' },
        pad: 10, rad: 10, btnText: 'I am over 18',
        locks: [],
    },
};

/* ---------------------------------------------------------------- state -- */

const state = { kind: 'form', pal: 'Classic Dark', locks: [] };

let ready = false;
let dirty = false;

function markDirty() {
    if (!ready || dirty) return;
    dirty = true;
    $('savebar').classList.add('on');
}

/** A widget needs a name; everything else has a working default. */
function gate() {
    const ok = $('wName').value.trim() !== '';
    $('save').disabled = !ok;
    $('saveBottom').disabled = !ok;
    $('sbNeeds').textContent = ok
        ? 'Nothing is saved until you press Save.'
        : 'Name the widget first.';
}

/* -------------------------------------------------------------- preview -- */

/** The palette these colours are, or '' when they are nobody's. Stored
    widgets keep colours, not a palette name, so the two cannot disagree. */
function palFor(c) {
    const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
    const hit = PALETTES.find(([, p]) => PALETTE_KEYS.every((k) => same(p[k], c[k])));
    return hit ? hit[0] : '';
}

const colourInput = (k) => document.querySelector('#colours [data-k="' + k + '"]');
const readColours = () => Object.fromEntries(PALETTE_KEYS.map((k) => [k, colourInput(k).value]));

function paintPreview() {
    const c = readColours();
    const form = state.kind === 'form';
    const card = $('card3');
    const btn = $('b3');

    card.style.background = c.card;
    card.style.color = c.text;
    card.style.padding = `${$('wPad').value || 10}px ${Number($('wPad').value || 10) + 6}px`;
    card.style.borderRadius = ($('wRad').value || 12) + 'px';

    /* A text widget has nothing to submit, so it has no button — which is the
       whole difference between the two kinds, and the preview should show it
       rather than describe it. */
    $('f3').innerHTML = form
        ? '<div class="lk-l">Passcode</div><div class="lk-f">Enter code</div>'
        : '<p class="lk-m" style="margin-top:8px">You are let through automatically.</p>';
    btn.style.display = form ? '' : 'none';
    btn.textContent = $('wBtnText').value.trim() || 'Unlock';
    btn.style.background = c.buttonBg;
    btn.style.color = c.buttonText;

    $('btnTextWrap').classList.toggle('hide', !form);
}

/** The rail's running summary. */
function paintSummary() {
    const set = (id, text, on = true) => {
        $(id).classList.toggle('set', on);
        $(id).querySelector('.sum-v').textContent = text;
    };
    set('sum1', state.kind === 'form' ? 'Form widget' : 'Text widget');
    set('sum2', state.pal || 'Custom colours', !!state.pal);
    set('sum3', state.locks.length === 0
        ? 'No locks yet' : countLabel(state.locks.length, 'locks'), state.locks.length > 0);
}

const repaint = () => { paintPreview(); paintSummary(); markDirty(); };

/* ------------------------------------------------------------- controls -- */

$('palettes').innerHTML = PALETTES.map(([name, c], i) =>
    '<button class="pal' + (i === 0 ? ' on' : '') + '" data-p="' + i + '">' + name
    + '<span class="pal-sw">'
    + PALETTE_KEYS.map((k) => '<i style="background:' + c[k] + '"></i>').join('')
    + '</span></button>').join('');

$('palettes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    document.querySelectorAll('.pal').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    const [name, colours] = PALETTES[Number(b.dataset.p)];
    PALETTE_KEYS.forEach((k) => { colourInput(k).value = colours[k]; });
    state.pal = name;
    $('palName').textContent = name;
    repaint();
});

/* Changing a colour by hand means it no longer matches a named palette. */
$('colours').addEventListener('input', () => {
    document.querySelectorAll('.pal').forEach((x) => x.classList.remove('on'));
    state.pal = '';
    $('palName').textContent = 'Custom';
    repaint();
});

pickOne($('kind'), (b) => {
    state.kind = b.dataset.kind;
    $('kindTag').className = 'tag ' + state.kind + (EDIT_ID === null ? ' hide' : '');
    $('kindTag').textContent = state.kind === 'form' ? 'Form' : 'Text';
    repaint();
});

['wPad', 'wRad', 'wBtnText'].forEach((id) => $(id).addEventListener('input', repaint));

$('wName').addEventListener('input', () => {
    if (EDIT_ID !== null) $('pageTitle').textContent = $('wName').value.trim() || 'Untitled widget';
    gate();
    markDirty();
});

$('wLang').addEventListener('change', markDirty);

/* The store's languages, read from the store — the same action the lock form
   carries, out of the same place. */
$('wLangSync').addEventListener('click', () => {
    const btn = $('wLangSync');
    if (btn.classList.contains('syncing')) return;
    btn.classList.add('syncing');
    setTimeout(() => { btn.classList.remove('syncing'); fillLocales(); }, 900);
});

/* ---------------------------------------------------------------- modals -- */

document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => $(b.dataset.close).classList.add('hide')));
document.querySelectorAll('.modal-bg').forEach((m) =>
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hide'); }));

$('deleteWidget').addEventListener('click', () => $('delModal').classList.remove('hide'));

for (const id of ['save', 'saveBottom']) {
    $(id).addEventListener('click', () => { window.location.href = 'widgets.html'; });
}

window.addEventListener('beforeunload', (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
});
document.querySelectorAll('a[href]').forEach((a) =>
    a.addEventListener('click', () => { dirty = false; }));

/* ------------------------------------------------------- create or edit -- */

function paintMode() {
    const w = EDIT_ID !== null ? WIDGETS[EDIT_ID] : null;
    const edit = !!w;

    document.title = (edit ? 'Edit widget' : 'Create a widget') + ' — Airo Access Lock';
    $('pageTitle').textContent = edit ? w.name : 'Create a widget';
    $('deleteWidget').classList.toggle('hide', !edit);
    $('usedTag').classList.toggle('hide', !edit);

    const label = edit ? 'Save' : 'Create widget';
    $('save').textContent = label;
    $('saveBottom').textContent = label;

    if (!edit) {
        // The painter owns the whole class, so the hidden state travels with it.
        $('kindTag').className = 'tag form hide';
        return;
    }

    $('wName').value = w.name;
    document.querySelector(`#kind [data-kind="${w.kind}"]`).click();

    PALETTE_KEYS.forEach((k) => { colourInput(k).value = w.c[k]; });
    state.pal = palFor(w.c);
    $('palName').textContent = state.pal || 'Custom';
    const at = PALETTES.findIndex(([n]) => n === state.pal);
    document.querySelectorAll('.pal').forEach((x, i) => x.classList.toggle('on', i === at));

    $('wPad').value = w.pad;
    $('wRad').value = w.rad;
    $('wBtnText').value = w.btnText;

    state.locks = w.locks;
    $('usedTag').textContent = w.locks.length
        ? 'Used by ' + countLabel(w.locks.length, 'locks') : 'Not used by any lock';
    $('secUses').classList.toggle('hide', w.locks.length === 0);
    $('usesBody').innerHTML = w.locks.map(([name, id]) =>
        `<div class="uses-l2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
                <rect x="4" y="10.5" width="16" height="10" rx="2.5"></rect>
                <path d="M8 10.5V7.5a4 4 0 018 0v3"></path></svg>
            <a href="lock-builder.html?id=${id}">${name}</a>
            <span class="xs sub">#${id}</span>
        </div>`).join('');
    $('delNote').textContent = w.locks.length
        ? countLabel(w.locks.length, 'locks') + ' use it. They fall back to the default look, '
          + 'and keep working.'
        : 'Nothing is using it, so nothing changes on your storefront.';
}

paintMode();
paintPreview();
paintSummary();
gate();
ready = true;
