/* ---------------------------------------------------------------------------
   The one-page lock form — /lock/create and /lock/{lock}/configure.

   The controls are lock-controls.js, the same ones the setup flow uses. This
   file is only what makes them a page rather than a wizard: a title that says
   whether you are making a lock or changing one, a save bar that turns up once
   there is something to save, and the hooks the controls call.

   ?id=14 opens it on an existing lock. ?embed=off shows the store that has not
   switched the theme app embed on yet.
--------------------------------------------------------------------------- */

const PARAMS = new URLSearchParams(location.search);
const EDIT_ID = PARAMS.get('id');
/* A store editing or adding a lock turned the embed on to create its first —
   unless it did not, which ?embed=off is how to look at. */
const EMBED_ON = PARAMS.get('embed') !== 'off';

mountChrome('locks');

/* ----------------------------------------------------------- save state -- */

/* Nothing counts as a change until the page has finished drawing itself and,
   on an edit, filling itself in. */
let ready = false;
let dirty = false;

function markDirty() {
    if (!ready || dirty) return;
    dirty = true;
    $('savebar').classList.add('on');
}

/** Both Save buttons say the same thing and are enabled by the same answer. */
function setSaveable(ok) {
    $('save').disabled = !ok;
    $('saveBottom').disabled = !ok;
    $('sbNeeds').textContent = ok
        ? 'Nothing is saved until you press Save.'
        : 'Name the lock and choose what it covers first.';
}

/* ---------------------------------------------------------------- hooks -- */

window.LOCK_HOOKS = {
    changed: () => markDirty(),

    /* The one rule the page enforces: a lock needs a name and something to
       cover. Everything else has a working default. */
    gate: () => setSaveable(state.name !== '' && (!!WHOLE[state.scope] || state.items > 0)),

    actionChanged: (gateAction) => {
        $('seeNote').textContent = gateAction
            ? 'Choose how the popup looks, and what it says on this lock.'
            : 'This action hides the content outright, so there is nothing for a shopper to read.';
        // A section with nothing to answer stops claiming a numbered place in
        // the order; it still says why, in the notice inside it.
        $('secSee').classList.toggle('off', !gateAction);
        $('needTag').classList.toggle('hide', !gateAction);
    },

    /* The editor opens inside the section rather than over it. The badge in
       the section heading says which widget kind this lock needs, which is
       about the lock and not about the design being made, so it stands aside
       while one is open — the flow hides it for the same reason. */
    makingChanged: (on) => {
        $('needTag').classList.toggle('hide', on);
        /* Saving the lock while a widget is half made would save neither. */
        $('save').disabled = on;
        $('saveBottom').disabled = on;
        if (!on) return;
        $('newWidget').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },

    embedChanged: (on) => {
        $('secEmbed').classList.toggle('off', on);
        // Once it is on there is nothing to follow, so the manual route goes.
        $('howto').classList.toggle('hide', on);
        $('embedNote').classList.toggle('hide', on);
    },
};

/* ------------------------------------------------------- create or edit -- */

/* One lock, as the list already shows it: #14 Wholesale catalogue, 2
   collections and a product, open to anyone with a passcode. Editing starts
   from what is there rather than from an empty form. */
const LOCK = {
    name: 'Wholesale catalogue',
    scope: 'Collections',
    items: 3,
    design: 'Trade gate',
};

function prefill() {
    $('lockName').value = LOCK.name;
    $('lockName').dispatchEvent(new Event('input'));

    // Going through the real control means the action list, the item bar and
    // the variant settings all land where choosing the type would put them.
    // Choosing a type opens the picker; on an edit the items are already
    // known, so it closes again straight away.
    document.querySelector(`#scope [data-sum="${LOCK.scope}"]`).click();
    $('pickModal').classList.add('hide');
    state.items = LOCK.items;
    paintItems();

    setDesign('form', LOCK.design);
    $('formDesign').dispatchEvent(new Event('change', { bubbles: true }));
}

function paintMode() {
    const edit = EDIT_ID !== null;
    document.title = (edit ? 'Edit lock' : 'Create a lock') + ' — Airo Access Lock';
    $('pageTitle').textContent = edit ? LOCK.name : 'Create a lock';
    $('lockId').textContent = '#' + EDIT_ID;
    $('lockId').classList.toggle('hide', !edit);
    // The painter owns the whole class: setting className after toggling
    // 'hide' is how the badge came back on a screen that has no lock yet.
    $('liveTag').className = 'badge ' + (EMBED_ON ? 'success' : 'warning') + (edit ? '' : ' hide');
    $('liveTag').textContent = EMBED_ON ? 'Running' : 'Not running yet';
    $('deleteLock').classList.toggle('hide', !edit);

    const label = edit ? 'Save' : 'Create lock';
    $('save').textContent = label;
    $('saveBottom').textContent = label;
}

$('deleteLock').addEventListener('click', () => $('delModal').classList.remove('hide'));

for (const id of ['save', 'saveBottom']) {
    $(id).addEventListener('click', () => { window.location.href = 'locks.html'; });
}

/* The browser's own warning is the only honest one here: this page does not
   save anything, so leaving it really does lose the lot. */
window.addEventListener('beforeunload', (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
});
// Every link that leaves on purpose is leaving on purpose.
document.querySelectorAll('a[href]').forEach((a) =>
    a.addEventListener('click', () => { dirty = false; }));

/* ------------------------------------------------------------------ init -- */

state.embed = EMBED_ON;
paintMode();
initLockControls();
if (EDIT_ID !== null) prefill();
ready = true;
