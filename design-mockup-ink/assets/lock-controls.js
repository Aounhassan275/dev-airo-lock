/* ---------------------------------------------------------------------------
   A lock's controls, independent of the screen they are laid out on.

   Two screens ask the same questions: the setup flow asks them four at a time
   over four steps, and lock-builder.html asks all of them at once on one page.
   Everything here is about a lock — what it covers, who gets in, what the
   popup shows, whether the embed is on — and nothing here knows about steps,
   sections, or a save bar.

   The screen supplies LOCK_HOOKS before anything is clicked, and calls
   initLockControls() once its own markup is in place.

   The preview is the point. Every control that changes what a shopper sees
   redraws it, because the field count and the presence of a button are exactly
   what merchants get wrong when they cannot see them.

   Needs: app.js (pickOne, fillActionChoices, NO_POPUP_NOTE) and lock-form.js
   ($, WHOLE, CONDITIONS, byValue, countLabel, renderPicker, wireCheckCards,
   PALETTES, PALETTE_KEYS).
--------------------------------------------------------------------------- */

/* What the screen wants to know. Every one is optional; a screen that does not
   care about a change simply leaves it out.

   changed()            something was chosen — repaint whatever summarises it
   gate()               the lock may have become valid, or stopped being valid
   actionChanged(gate)  the lock action changed; `gate` is true when it still
                        shows a popup, false when it hides the content outright
   makingChanged(on)    the widget editor opened or closed, and wants the room
   embedChanged(on)     the theme app embed was found on or off
*/
const hook = (name, ...args) => {
    const fn = (window.LOCK_HOOKS || {})[name];
    if (fn) fn(...args);
};

/* ---------------------------------------------------------------- state -- */

const state = {
    name: '',
    enabled: true,
    scope: '',
    items: 0,
    action: 'gate',
    operator: 'AND',
    conds: ['singlePasscode'],
    formDesign: '',
    textDesign: '',
    embed: false,
};

/* ------------------------------------------------------------- previews -- */

/** Which boxes the popup shows, across every condition, in order. */
function previewFields() {
    const out = [];
    let confirm = '';
    for (const v of state.conds) {
        const c = byValue(v);
        (c.fields || []).forEach((f) => { if (!out.includes(f)) out.push(f); });
        if (c.confirm) confirm = c.confirm;
    }
    return { fields: out, confirm };
}

/** Form if any condition asks for input; Text covers the rest. */
function widgetNeeds() {
    const kinds = state.conds.map((v) => byValue(v).w);
    return { form: kinds.includes('form'), text: kinds.includes('text') };
}

const val = (id, fallback) => {
    const el = $(id);
    return (el && el.value.trim()) || fallback;
};

/** Every stage on every screen, drawn from one source. */
function paintPreview() {
    const { fields, confirm } = previewFields();
    const gateAction = state.action === 'gate';
    const design = (widgetNeeds().form ? state.formDesign : state.textDesign);

    const body = confirm
        ? `<div class="lk-b" style="margin-top:9px;background:transparent;border:1px solid currentColor">${confirm}</div>`
        : fields.length === 0
            ? '<p class="lk-m" style="margin-top:8px">You are let through automatically.</p>'
            : fields.map((f) => {
                const label = f === 'Passcode' ? val('wPL', 'Passcode') : val('wEL', 'Email address');
                const hint = f === 'Passcode' ? val('wPH', 'Enter code') : val('wEH', 'you@example.com');
                return `<div class="lk-l">${label}</div><div class="lk-f">${hint}</div>`;
            }).join('');

    for (const n of ['3']) {
        const card = $('card' + n);
        if (!card) continue;
        $('t' + n).textContent = val('wTitle', 'Members only');
        $('m' + n).textContent = val('wMsg', 'Access restricted.');
        $('f' + n).innerHTML = body;
        const btn = $('b' + n);
        btn.textContent = val('wBtn', 'Unlock');
        btn.style.display = (confirm || fields.length === 0) ? 'none' : '';

        const o = designOption(design);
        card.style.background = o.bg;
        card.style.color = o.fg;
        btn.style.background = o.btn;
        btn.style.color = o.btnfg;

        // The three style numbers only exist while one is being made.
        card.style.padding = draft ? `${draft.pad}px ${draft.pad + 6}px` : '';
        card.style.borderRadius = draft ? `${draft.rad}px` : '';
        if (draft && draft.btnText) btn.textContent = draft.btnText;
    }

    // A hiding action means no popup anywhere.
    const note = $('note3');
    if (note) {
        note.classList.toggle('hide', gateAction);
        $('card3').classList.toggle('hide', !gateAction);
        $('veil3').style.background = gateAction ? '' : 'transparent';
        $('note3Text').textContent = NO_POPUP_NOTE[state.action] || '';
    }

    // Wording fields only for the boxes this lock actually shows.
    document.querySelectorAll('[data-forfield]').forEach((el) => {
        el.classList.toggle('hide', !fields.includes(el.dataset.forfield));
    });
    const btnField = document.querySelector('[data-forbutton]');
    if (btnField) btnField.classList.toggle('hide', confirm !== '' || fields.length === 0);

}

/* The widget being made, or null. The preview reads it, which is the point of
   making one here: the device beside the form is the live preview, so there is
   no second one to keep in step with it. */
let draft = null;

function designOption(name) {
    if (draft) {
        return { bg: draft.card, fg: draft.text, btn: draft.buttonBg, btnfg: draft.buttonText };
    }
    const group = widgetNeeds().form ? $('formDesign') : $('textDesign');
    const picks = [...group.querySelectorAll('.pick')];
    const o = picks.find((p) => p.querySelector('input').value === name) || picks[0];
    return { bg: o.dataset.bg, fg: o.dataset.fg, btn: o.dataset.btn, btnfg: o.dataset.btnfg };
}

/** The wording fields: their ids, and what each one is called. */
const WORD_FIELDS = [['wTitle', 'title'], ['wMsg', 'message'], ['wBtn', 'button'],
                     ['wPL', 'passcode label'], ['wPH', 'passcode hint'],
                     ['wEL', 'email label'], ['wEH', 'email hint']];

/* ------------------------------------------------------------- summary --- */

/* A screen may carry a line per answer, or none. Both callers describe what
   was chosen either way, so a screen can take the description or ignore it. */
function setSummary(n, text, set = true) {
    const row = $('sum' + n);
    if (!row) return;
    row.classList.toggle('set', set);
    row.querySelector('.sum-v').textContent = text;
}

function setProtects() {
    const whole = WHOLE[state.scope];
    if (whole) return setSummary(1, whole);
    if (state.items > 0) return setSummary(1, countLabel(state.items, state.scope));
    setSummary(1, 'Nothing chosen yet', false);
}

function setOpensFor() {
    if (state.conds.length === 1) return setSummary(2, byValue(state.conds[0]).sum);
    const joiner = state.operator === 'AND' ? 'all' : 'any';
    setSummary(2, `${state.conds.length} conditions, ${joiner} must match`);
}

function setShows() {
    if (state.action !== 'gate') return setSummary(3, 'Nothing — it is hidden');
    const needs = widgetNeeds();
    const name = needs.form ? state.formDesign : state.textDesign;
    setSummary(3, name || 'Default design');
}

wireCheckCards();

/* ----------------------------------------------------------- app embed -- */

/* The real check is server-side — ThemeExtensionService reads the theme's
   settings and builds a deep link that opens the editor with the block already
   switched on, so the merchant only presses Save. Here the status is
   simulated: "Check again" finds it on. */

function paintEmbed() {
    if (!$('embedCard')) return;
    $('embedCard').classList.toggle('on', state.embed);
    $('embedT').textContent = state.embed ? 'App embed is on' : 'App embed is off';
    $('embedD').textContent = state.embed
        ? 'Your locks run on the storefront.'
        : 'Your locks will not run on the storefront until you turn it on.';
    $('embedIc').innerHTML = state.embed
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"'
          + ' stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5.5 5.5L20 7"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"'
          + ' stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/>'
          + '<path d="M10.3 3.9L2.4 17.2A2 2 0 004.1 20.2h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>';
    $('embedGo').textContent = state.embed ? 'Open theme editor' : 'Enable in theme editor';
    // Once it is on, the button is just a way back to the editor.
    $('embedNote').textContent = state.embed
        ? 'Nothing else to do here. Changing themes later turns it off again.'
        : 'Opens the editor with the embed already switched on — you only have to press Save.';

    // The lock is always shown; the embed decides whether it is reaching
    // anyone — but only on a screen that is asking about the embed. The flow
    // asks on one step; a screen that does not answer is asking, which is
    // what the one-page builder wants.
    const asks = (window.LOCK_HOOKS || {}).embedShown;
    const showing = asks ? asks() : true;

    const dev = document.querySelector('[data-preview-device]');
    if (dev) dev.classList.toggle('off', showing && !state.embed);
    if ($('devBadge')) $('devBadge').classList.toggle('hide', !showing || state.embed);
    if ($('cap3')) {
        $('cap3').textContent = !showing ? 'What shoppers see'
            : state.embed ? 'Your lock, running' : 'Your lock, once the embed is on';
    }
    hook('embedChanged', state.embed);
}

if ($('embedCheck')) {
    $('embedCheck').addEventListener('click', () => { state.embed = true; paintEmbed(); });
}

/* --------------------------------------------------- what to lock ------- */

$('lockName').addEventListener('input', (e) => {
    state.name = e.target.value.trim();
    setSummary(0, state.name || 'Not named yet', state.name !== '');
    hook('gate');
    hook('changed');
});

/* A lock being created is on — that is what creating it means — so setup
   does not ask. The lock page keeps the switch, because it also edits locks
   that already exist. */
if ($('enabled')) {
    $('enabled').addEventListener('click', () => {
        state.enabled = !$('enabled').classList.toggle('off');
        $('enabledLabel').textContent = state.enabled ? 'Enabled' : 'Disabled';
        hook('changed');
    });
}

function applyAction(value) {
    state.action = value;
    $('action').querySelectorAll('.act').forEach((l) => {
        const box = l.querySelector('input');
        l.classList.toggle('on', box.value === value);
        box.checked = box.value === value;
    });

    const gateAction = value === 'gate';
    $('popupBlock').classList.toggle('hide', !gateAction);
    $('noPopup').classList.toggle('hide', gateAction);
    $('noPopupWhy').textContent = gateAction ? '' : (NO_POPUP_NOTE[value] || '');
    hook('actionChanged', gateAction);

    setShows();
    paintWidgetKind();
    paintPreview();
    hook('changed');
}

pickOne($('scope'), (b) => {
    state.scope = b.dataset.sum;
    state.items = 0;

    const whole = WHOLE[state.scope];
    const noun = state.scope.toLowerCase();
    const isPrice = state.scope === 'Hide price rule';

    $('browse').disabled = !!whole;
    $('browse').textContent = whole ? 'Nothing to choose' : 'Choose ' + noun;
    $('itemsText').textContent = whole ? whole + ' will be locked.' : 'Nothing chosen yet';
    $('itemsSub').textContent = whole
        ? 'There is nothing to narrow down — the lock covers all of it.'
        : 'Pick the exact ' + noun + ' this lock covers.';
    $('itemsRow').classList.toggle('set', !!whole);
    $('clearItems').classList.toggle('hide', true);

    // Hide Price Rule has its own settings instead of a lock action, and
    // variant behaviour only applies to product locks.
    $('priceWrap').classList.toggle('hide', !isPrice);
    $('actionWrap').classList.toggle('hide', isPrice);
    $('variantWrap').classList.toggle('hide', !['Products', 'Hide price rule'].includes(state.scope));

    applyAction(isPrice ? 'gate' : fillActionChoices($('action'), noun));
    if (!whole) { renderPicker(noun); $('pickModal').classList.remove('hide'); }
    setProtects();
    hook('gate');
});

$('action').addEventListener('change', (e) => applyAction(e.target.value));
$('browse').addEventListener('click', () => $('pickModal').classList.remove('hide'));

$('pickModal').addEventListener('change', paintPicker);

/* Select all, and its opposite once there is nothing left to select. */
$('pickAll').addEventListener('click', () => {
    const boxes = [...$('pickModal').querySelectorAll('.pick-row input')];
    const clear = boxes.every((b) => b.checked);
    boxes.forEach((b) => { b.checked = !clear; });
    paintPicker();
});

/* Re-reading the catalogue from Shopify is a real thing the app does; here it
   reports that it happened rather than pretending to fetch. */
$('pickSync').addEventListener('click', () => {
    const bar = $('pickBar');
    if (bar.classList.contains('syncing')) return;
    bar.classList.add('syncing');
    // Re-reading the catalogue should not cost you the ticks you already made.
    const picked = [...$('pickModal').querySelectorAll('.pick-row input')]
        .map((b2, i) => (b2.checked ? i : -1)).filter((i) => i >= 0);
    setTimeout(() => {
        bar.classList.remove('syncing');
        renderPicker(pickNoun);
        const boxes = $('pickModal').querySelectorAll('.pick-row input');
        picked.forEach((i) => { if (boxes[i]) boxes[i].checked = true; });
        paintPicker();
    }, 900);
});

/** The selection bar, after state.items has changed. */
function paintItems() {
    const some = state.items > 0;
    $('itemsText').textContent = some
        ? countLabel(state.items, state.scope) + ' chosen' : 'Nothing chosen yet';
    $('itemsSub').textContent = some
        ? 'Only these are locked. Everything else stays open.'
        : 'Pick the exact ' + state.scope.toLowerCase() + ' this lock covers.';
    $('itemsRow').classList.toggle('set', some);
    $('clearItems').classList.toggle('hide', !some);
    setProtects();
    hook('gate');
    hook('changed');
}

$('pickAdd').addEventListener('click', () => {
    state.items = $('pickModal').querySelectorAll('.pick-row input:checked').length;
    $('pickModal').classList.add('hide');
    paintItems();
});

$('clearItems').addEventListener('click', () => {
    state.items = 0;
    // The picker keeps its ticks otherwise, and reopening it would show a
    // selection the bar says is gone.
    $('pickModal').querySelectorAll('input').forEach((c) => { c.checked = false; });
    $('pickModal').dispatchEvent(new Event('change'));
    paintItems();
});

/* ------------------------------------------------------ who gets in ----- */

/** One condition, as a row in the list. The form that fills it in is in
    the modal, so a row only has to say which check this is. */
function condRow(value, index) {
    const c = byValue(value);
    const set = (state.condVals || [])[index];
    return `<div class="crow" data-i="${index}">
        <span class="crow-n">${index + 1}</span>
        <span class="crow-b">
            <span class="crow-t">${c.label}</span>
            <span class="crow-v${set ? '' : ' none'}">${set || 'Not set yet &mdash; click to fill it in'}</span>
        </span>
        <span class="tag ${c.w}">${c.w === 'form' ? 'Form' : 'Text'}</span>
        ${state.conds.length > 1
            ? '<button class="btn plain icon crow-x" data-remove aria-label="Remove condition">'
              + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
              + ' stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
              + '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"></path></svg></button>'
            : ''}
        <span class="crow-go" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
    </div>`;
}

/** Which condition the modal is editing: an index, or null for a new one. */
let condAt = null;

function paintCondField(value) {
    const c = byValue(value);
    const f = c.field;
    const control = f.t === 'select'
        ? `<select class="select">${f.opts.map((o) => `<option>${o}</option>`).join('')}</select>`
        : f.t === 'textarea'
            ? `<textarea class="textarea mono" style="font-size:12px;min-height:76px" placeholder="${f.ph}"></textarea>`
            : `<input class="input" placeholder="${f.ph}">`;

    $('condField').innerHTML = `<div class="between">
            <label class="label">${f.label}</label>
            ${c.bulk ? `<button class="btn plain xs" data-bulk="${c.bulk}">Add in bulk</button>` : ''}
        </div>
        ${control}
        ${f.help ? `<span class="help">${f.help}</span>` : ''}`;

    $('condKind').className = 'tag ' + c.w;
    $('condKind').textContent = c.w === 'form' ? 'Form' : 'Text';
}

function openCond(index) {
    condAt = index;
    const used = new Set(state.conds);
    const value = index === null
        ? (CONDITIONS.find((c) => !used.has(c.v)) || CONDITIONS[0]).v
        : state.conds[index];

    $('condType').innerHTML = CONDITIONS.map((x) =>
        `<option value="${x.v}"${x.v === value ? ' selected' : ''}>${x.label}</option>`).join('');
    $('condType').value = value;
    paintCondField(value);
    /* Only when the type is still the one that value was entered for. */
    if (index !== null && state.conds[index] === value) {
        const ctl = $('condField').querySelector('.input, .select, .textarea');
        if (ctl && (state.condVals || [])[index]) ctl.value = state.condVals[index];
    }

    $('condTitle').textContent = index === null ? 'Add a condition' : 'Condition ' + (index + 1);
    $('condSave').textContent = index === null ? 'Add condition' : 'Save condition';
    $('condModal').classList.remove('hide');
}

$('condType').addEventListener('change', (e) => paintCondField(e.target.value));

$('condSave').addEventListener('click', () => {
    const value = $('condType').value;
    const ctl = $('condField').querySelector('.input, .select, .textarea');
    /* What was typed is what the row will say, so it is kept beside the type.
       A textarea holds a list, so the row says how many rather than all of it. */
    const typed = ctl ? ctl.value.trim() : '';
    const said = ctl && ctl.classList.contains('textarea')
        ? (typed ? countLabel(typed.split(/\n+/).filter(Boolean).length, 'entries') : '')
        : typed;
    state.condVals = state.condVals || [];
    if (condAt === null) {
        state.conds.push(value);
        state.condVals.push(said);
    } else {
        state.conds[condAt] = value;
        state.condVals[condAt] = said;
    }
    $('condModal').classList.add('hide');
    renderConds();
});

/* Add in bulk opens on top of the condition modal, which stays behind it so
   the condition is still being edited when it closes. */
$('condField').addEventListener('click', (e) => {
    const bulk = e.target.closest('[data-bulk]');
    if (!bulk) return;
    $('bulkTitle').textContent = 'Add ' + bulk.dataset.bulk + ' in bulk';
    $('bulkHelp').textContent = bulk.dataset.bulk.includes('pairs')
        ? 'One pair per line, as email,passcode. Paste straight from a spreadsheet — commas, tabs and semicolons all work, and a header row is ignored.'
        : 'One per line. Paste straight from a spreadsheet — a header row is ignored.';
    $('bulkModal').classList.remove('hide');
});

function renderConds() {
    $('conds').innerHTML = state.conds.map(condRow).join('');
    if ($('condCount')) $('condCount').textContent = countLabel(state.conds.length, 'conditions');
    $('operatorHelp').textContent =
        `Customer must meet ${state.operator === 'AND' ? 'all' : 'any'} of the conditions below to unlock access.`;
    setOpensFor();
    fitConds();
    paintWidgetKind();
    paintPreview();
    hook('changed');
}

/* The list has no scroller and its card clips, so a list that does not fit
   has to become one that does: first the rows drop the value they are set
   to, then they tighten. Checked against the area the step actually has,
   because the card grows to whatever the list asks for. */
function fitConds() {
    const list = $('conds');
    const card = list && list.closest('.col-conds, .s-card');
    const area = card && card.closest('.work-opts');
    if (!area) return;

    list.classList.remove('tight', 'tighter');
    if (card.scrollHeight <= area.clientHeight) return;
    list.classList.add('tight');
    if (card.scrollHeight > area.clientHeight) list.classList.add('tighter');
}

/* The area changes with the window, so the fit is checked again. */
window.addEventListener('resize', fitConds);

$('conds').addEventListener('click', (e) => {
    const row = e.target.closest('.crow');
    if (!row) return;
    if (e.target.closest('[data-remove]')) {
        state.conds.splice(Number(row.dataset.i), 1);
        (state.condVals || []).splice(Number(row.dataset.i), 1);
        return renderConds();
    }
    openCond(Number(row.dataset.i));
});

$('addCond').addEventListener('click', () => openCond(null));

$('operator').addEventListener('change', (e) => {
    state.operator = e.target.value;
    $('operator').querySelectorAll('.seg-b').forEach((b) =>
        b.classList.toggle('on', b.querySelector('input').checked));
    renderConds();
});

// Bulk entry reports what it parsed rather than silently accepting a paste.
$('bulkText').addEventListener('input', (e) => {
    const lines = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean);
    const uniq = new Set(lines);
    $('bulkValid').textContent = countLabel(uniq.size, 'entries');
    $('bulkDupes').textContent = (lines.length - uniq.size) + ' duplicates merged';
});
$('bulkAdd').addEventListener('click', () => $('bulkModal').classList.add('hide'));

/* -------------------------------------------------- what visitors see --- */

function paintWidgetKind() {
    const needs = widgetNeeds();
    $('formWrap').classList.toggle('hide', !needs.form);
    $('textWrap').classList.toggle('hide', !needs.text);

    const tag = $('needTag');
    if (tag) {
        // The painter owns the whole class, so it has to carry the hidden
        // state across with it — a screen that hides this badge itself would
        // otherwise find it back on the next repaint.
        const hidden = tag.classList.contains('hide') ? ' hide' : '';
        tag.className = 'tag ' + (needs.form ? 'form' : 'text') + hidden;
        tag.textContent = needs.form ? 'Form' : 'Text';
    }

    if ($('widgetKindWhy')) {
        $('widgetKindWhy').textContent = needs.form && needs.text
            ? 'One condition asks for input and another does not, so both are used.'
            : needs.form
                ? 'Used for conditions that need user input (passcode, age verification).'
                : "Used for conditions that don't need input (tag, signed in, location).";
    }
}

/** Check one design in a group and paint it, the way a click would. */
function setDesign(which, name) {
    [...$(which + 'Design').querySelectorAll('.pick')].forEach((p) => {
        const hit = p.querySelector('input').value === (name || '');
        p.querySelector('input').checked = hit;
        p.classList.toggle('on', hit);
    });
}

function onDesign(which) {
    return (e) => {
        const name = e.target.value;
        state[which + 'Design'] = name;

        $('saysCopy').innerHTML = name
            ? `<b>${name}</b> sets how it <em>looks</em>. Below is what it <em>says</em>, for this
               lock only.`
            : `No design is selected, so it uses the default look. Below is what it
               <em>says</em>, for this lock only.`;
        $('saysOther').classList.toggle('hide', !name);
        if (name) $('saysOther').textContent = `Other locks using ${name} keep their own wording.`;

        setShows();
        paintPreview();
        hook('changed');
    };
}
$('formDesign').addEventListener('change', onDesign('form'));
$('textDesign').addEventListener('change', onDesign('text'));

/* ---------------------------------------------------------------- modals -- */

document.querySelectorAll('[data-close]').forEach((b) =>
    b.addEventListener('click', () => $(b.dataset.close).classList.add('hide')));
document.querySelectorAll('.modal-bg').forEach((m) =>
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.add('hide'); }));

/* What the popup says, as opposed to how it looks. Every field redraws the
   preview beside it and the one on the screen behind it, so the two can never
   disagree about the lock they are both showing. */

for (const [id] of WORD_FIELDS) {
    const el = $(id);
    if (el) el.addEventListener('input', () => { paintPreview(); hook('changed'); });
}

/* ------------------------------------------------ making a widget ------ */

/* The editor the app has, in the page it belongs to rather than on top of it.
   Everything it asks for is a property of the design; what the popup *says*
   stays in the wording editor below. */

const colourInput = (k) => document.querySelector('#colours [data-k="' + k + '"]');

function readDraft() {
    const d = Object.fromEntries(PALETTE_KEYS.map((k) => [k, colourInput(k).value]));
    d.pad = Number($('wPad').value) || 10;
    d.rad = Number($('wRad').value) || 12;
    d.btnText = $('wBtnText').value.trim();
    return d;
}

$('palettes').innerHTML = PALETTES.map(([name, c], i) =>
    '<button class="pal' + (i === 0 ? ' on' : '') + '" data-p="' + i + '">' + name
    + '<span class="pal-sw">'
    + PALETTE_KEYS.map((k) => '<i style="background:' + c[k] + '"></i>').join('')
    + '</span></button>').join('');

/** Which widget kind is being made, so Create knows which select to add to. */
let makingKind = 'form';

function setMaking(on) {
    draft = on ? readDraft() : null;
    $('newWidget').classList.toggle('hide', !on);
    // While a design is being made, the screen is about how it looks. What it
    // says is the editor below, and the select is what you use instead.
    // The note about which widget kind this lock needs is about the lock,
    // not the design being made, so it stands aside too.
    for (const id of ['kindBox', 'saysBox', 'saysRule', 'wordBlock']) {
        if ($(id)) $(id).classList.toggle('hide', on);
    }
    $('formWrap').classList.toggle('hide', on || !widgetNeeds().form);
    $('textWrap').classList.toggle('hide', on || !widgetNeeds().text);

    // The editor wants the whole column, and whatever sits beside it is not
    // part of the design being made.
    hook('makingChanged', on);
    paintPreview();
}

document.querySelectorAll('[data-new]').forEach((b) =>
    b.addEventListener('click', () => {
        makingKind = b.dataset.new;
        $('wNameIn').value = '';
        setMaking(true);
        $('wNameIn').focus();
    }));

$('newCancel').addEventListener('click', () => setMaking(false));

/* The store's languages, read from the store. The real call is Shopify's —
   the published locales out of Markets — and here it reports that it ran. */
if ($('wLangSync')) {
    $('wLangSync').addEventListener('click', () => {
        const btn = $('wLangSync');
        if (btn.classList.contains('syncing')) return;
        btn.classList.add('syncing');
        setTimeout(() => {
            btn.classList.remove('syncing');
            fillLocales();
        }, 900);
    });
}

$('palettes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    document.querySelectorAll('.pal').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    const colours = PALETTES[Number(b.dataset.p)][1];
    PALETTE_KEYS.forEach((k) => { colourInput(k).value = colours[k]; });
    draft = readDraft();
    paintPreview();
});

// Changing a colour by hand means it no longer matches a named palette.
$('colours').addEventListener('input', () => {
    document.querySelectorAll('.pal').forEach((x) => x.classList.remove('on'));
    draft = readDraft();
    paintPreview();
});

['wPad', 'wRad', 'wBtnText'].forEach((id) =>
    $(id).addEventListener('input', () => { draft = readDraft(); paintPreview(); }));

$('newSave').addEventListener('click', () => {
    const name = $('wNameIn').value.trim()
        || (document.querySelector('.pal.on') || {}).textContent
        || 'New widget';
    const c = readDraft();
    const group = $(makingKind + 'Design');

    // A design is a set of colours under a name — the same shape the picks
    // the preview already reads are in, so nothing downstream has to change.
    const el = document.createElement('label');
    el.className = 'pick';
    el.dataset.bg = c.card;
    el.dataset.fg = c.text;
    el.dataset.btn = c.buttonBg;
    el.dataset.btnfg = c.buttonText;
    el.innerHTML = '<input type="radio" name="' + group.id + '" value="' + name + '">'
        + '<span class="pick-sw" aria-hidden="true" style="background:' + c.card
        + ';color:' + c.text + '"><i style="background:' + c.buttonBg + '"></i></span>'
        + '<span class="pick-n">' + name + '</span>';
    /* Before the add button, so making one does not push it around. */
    group.appendChild(el);
    setDesign(makingKind, name);

    setMaking(false);
    group.dispatchEvent(new Event('change', { bubbles: true }));
});

/* ------------------------------------------------------------------ init -- */

/** Draw everything once, after the screen has set its hooks up. */
function initLockControls() {
    // Variant behaviour only applies once a product-shaped type is chosen.
    $('variantWrap').classList.add('hide');

    // The action list has a sensible default before a type is picked, so the
    // control is never an empty select.
    applyAction(fillActionChoices($('action'), ''));

    paintEmbed();
    renderConds();
    paintPreview();
    hook('gate');
}
