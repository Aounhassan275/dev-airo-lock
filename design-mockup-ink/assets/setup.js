/* ---------------------------------------------------------------------------
   Setup behaviour — the flow, and only the flow.

   The four steps, which of them this lock actually has, and the done screen.
   Everything about the lock itself — what it covers, who gets in, what the
   popup shows, the four modals, the preview they all feed — is in
   lock-controls.js, which lock-builder.html uses to ask the same questions on
   one page. This file is what makes those questions a wizard.

   Load order: app.js, lock-form.js, lock-controls.js, then this.
--------------------------------------------------------------------------- */

/* Which screen this is. Setup runs the flow for a store's first lock. */
const MODE = new URLSearchParams(location.search).get('mode') === 'lock' ? 'lock' : 'setup';

/* Whether the theme app embed is already on when the page loads. The server
   knows — ThemeExtensionService::status() — and here the shape of that answer
   is: a store creating another lock turned it on to create the first, a store
   in first-run setup has not. ?embed=on|off forces either, so both paths can
   be looked at from either screen. */
const EMBED_PARAM = new URLSearchParams(location.search).get('embed');
const EMBED_ON = EMBED_PARAM ? EMBED_PARAM === 'on' : MODE === 'lock';

mountChrome(MODE === 'lock' ? 'locks' : 'onboarding');
/* Setup owns the whole frame only when it fits in it. Below the layout
   breakpoint the card is taller than the window, so the frame has to scroll or
   the footer becomes unreachable. */
const WIDE = window.matchMedia('(min-width: 1181px)');
function lockFrame() {
    document.querySelector('.app-scroll').style.overflow = WIDE.matches ? 'hidden' : '';
}
WIDE.addEventListener('change', lockFrame);
lockFrame();

/* ---------------------------------------------------------------- steps -- */

/** Which step is showing. The rest of the lock's state is in lock-controls. */
let step = 1;

const steps = [...document.querySelectorAll('.wiz')];
const stRows = [...document.querySelectorAll('.st')];

/** Whether step 3 has anything to ask. Its two halves are the popup and the
    app embed: a lock that hides its content outright has no popup to design,
    and a store whose embed is already on has nothing to switch. */
const hasPopup = () => state.action === 'gate';
const hasEmbed = () => !EMBED_ON;

/** The steps this lock actually has. (5 is not in the list: Settings is half
    of step 2.) A lock that hides its content outright has no popup to design,
    and a store whose embed is already on has nothing to switch, so either
    step can be absent. */
function flow() {
    const path = [1, 2];
    if (hasPopup()) path.push(3);
    if (hasEmbed()) path.push(4);
    path.push(6);
    return path;
}

/** Steps 3 and 4 are the same panel showing one half each. */
function paintStep3() {
    const embedStep = step === 4;
    $('popupHalf').classList.toggle('hide', embedStep || !hasPopup());
    $('embedHalf').classList.toggle('hide', !embedStep);

    $('step3H').textContent = embedStep ? 'One switch left' : 'What should visitors see?';
    $('step3Sub').textContent = embedStep
        ? 'Your locks run through a theme app embed. Switch it on and this one starts working.'
        : hasPopup()
            ? 'Choose how the popup looks and what it says.'
            : 'This action hides the content outright, so there is nothing for a shopper to read.';
}

function render() {
    const path = flow();
    if (!path.includes(step)) step = 2;
    const at = path.indexOf(step);

    const panel = step === 4 ? 3 : step;
    steps.forEach((s) => {
        const on = Number(s.dataset.wiz) === panel;
        s.classList.toggle('hide', !on);
        s.style.display = on ? 'flex' : '';
    });
    stRows.forEach((r) => {
        // Circles are numbered by their place in this lock's path, not by the
        // step they happen to be, so a three-step lock counts 1, 2, 3.
        const i = path.indexOf(Number(r.dataset.st));
        r.classList.toggle('hide', i === -1);
        if (i === -1) return;
        r.classList.toggle('on', i === at);
        r.classList.toggle('done', i < at);
        r.querySelector('.st-n').innerHTML = i < at ? '✓' : i + 1;
    });
    // The greeting that held this moved to welcome.html.
    const WORDS = ['no', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
    if ($('stepCount')) $('stepCount').textContent = WORDS[path.length - 1];

    // The last step is a result, not a question. It carries its own actions,
    // so the footer goes rather than standing empty beneath them.
    const done = step === 6;
    document.querySelector('.work-foot').classList.toggle('hide', done);
    // Nothing in the flow sits behind step 1, so the left button only appears
    // once there is a step to go back to.
    $('back').classList.toggle('hide', at === 0);
    // The last question, whichever one it turns out to be, is the one that
    // creates the lock.
    $('next').textContent = at === path.length - 2 ? 'Create my lock' : 'Continue';
    if (step === 3 || step === 4) paintStep3();
    paintEmbed();
    if (done) runDone();
    gate();
}

/** Continue waits until the step could actually be completed. */
function gate() {
    if (step !== 1) return ($('next').disabled = false);
    const scoped = !!WHOLE[state.scope] || state.items > 0;
    $('next').disabled = !(state.name !== '' && scoped);
}

$('next').addEventListener('click', () => {
    const path = flow(), at = path.indexOf(step);
    if (at === path.length - 1) { window.location.href = 'locks.html'; return; }
    step = path[at + 1]; render();
});

$('back').addEventListener('click', () => {
    const path = flow(), at = path.indexOf(step);
    step = path[at - 1]; render();
});

/* ---------------------------------------------------------------- hooks -- */

/* What the controls tell the flow. Everything else they handle themselves. */
window.LOCK_HOOKS = {
    changed: () => render(),
    gate: () => gate(),

    /* Only the step that is about the embed draws its state. */
    embedShown: () => step === 4,

    actionChanged: (gateAction) => {
        paintStep3();
        // The badge lives with the heading of the half it describes, so the
        // line under the title is free to say what the step is for. Step 4
        // writes its own, so this only speaks for step 3.
        if (step !== 4) {
            $('step3Sub').textContent = gateAction
                ? 'Choose how the popup looks and what it says.'
                : 'This action hides the content outright, so there is nothing for a shopper to read.';
        }
    },

    /* A half-made widget is a job to finish or abandon, so the step's own
       way forward waits for one of the two. */
    makingChanged: (on) => {
        paintStep3();
        $('next').disabled = on;
        $('next').title = on ? 'Finish or cancel the widget first' : '';
    },
};

/* --------------------------------------------------------------- step 6 -- */

/* The burst. Pieces start behind the mark and fly out, so the celebration
   comes from the thing that just succeeded rather than the edges. */
const CONFETTI = ['#1a1a1a', '#5c5c5c', '#8a8a8a', '#c9c9c9', '#cdfee1', '#ffd79d'];

function fireConfetti() {
    const box = $('confetti');
    const pieces = [];
    for (let i = 0; i < 30; i++) {
        const x = (Math.random() - 0.5) * 560;
        const y = 150 + Math.random() * 200;
        const r = (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 540);
        const c = CONFETTI[i % CONFETTI.length];
        const round = i % 4 === 0;
        pieces.push('<i style="--x:' + x.toFixed(0) + 'px;--y:' + y.toFixed(0) + 'px;'
            + '--r:' + r.toFixed(0) + 'deg;background:' + c + ';'
            + 'animation-delay:' + (Math.random() * 180).toFixed(0) + 'ms;'
            + (round ? 'border-radius:50%;width:8px;height:8px;' : '')
            + '"></i>');
    }
    box.innerHTML = pieces.join('');
}

function paintDone() {
    const whole = WHOLE[state.scope];
    $('doneName').textContent = state.name || 'Untitled lock';
    $('doneProtects').textContent = whole
        // countLabel already carries the noun, so appending it read '4 pages of pages'.
        ? whole : countLabel(state.items, state.scope);
    $('doneOpens').textContent = state.conds.length === 1
        ? byValue(state.conds[0]).sum
        : countLabel(state.conds.length, 'conditions')
          + ', ' + (state.operator === 'AND' ? 'all' : 'any') + ' must match';
    $('doneShows').textContent = state.action === 'gate'
        ? (widgetNeeds().form ? state.formDesign : state.textDesign) || 'Default design'
        : 'Nothing — the content is hidden';

    const which = MODE === 'lock' ? 'Your lock' : 'Your first lock';
    $('doneH').textContent = which + (state.embed ? ' is live' : ' is saved');
    $('doneP').textContent = state.embed
        ? 'Shoppers who do not pass your conditions will see your popup from now on.'
        : 'It will start running as soon as you turn the app embed on in your theme.';
    $('donePill').className = 'done-pill' + (state.embed ? '' : ' wait');
    $('donePill').textContent = state.embed
        ? 'Running on your storefront' : 'Waiting on the app embed';
}

/* The three jobs, run in front of the merchant before the result appears.
   The third reports what the embed check actually found. */
const QUIET = window.matchMedia('(prefers-reduced-motion: reduce)');

function reveal() {
    const wrap = $('doneWrap');
    paintDone();
    $('confetti').innerHTML = '';
    void wrap.offsetWidth;
    fireConfetti();
    wrap.classList.add('play');
}

let doneRun = 0;

/** Show the drawing for the job that is running; 0 for none. */
function scene(n) {
    document.querySelectorAll('#scenes .scene').forEach((el) =>
        el.classList.toggle('on', Number(el.dataset.s) === n));
}

function runDone() {
    const wrap = $('doneWrap');
    const rows = [...$('prog').children];
    wrap.classList.remove('play');
    rows.forEach((li) => { li.className = ''; });
    scene(0);
    $('prog3').textContent = 'Checking the theme app embed';

    // Straight to the result for anyone who asked for less motion.
    if (QUIET.matches) return reveal();

    const run = ++doneRun;
    const stepThrough = (i) => {
        if (run !== doneRun) return;          // a later arrival took over
        if (i > 0) {
            const last = i === rows.length;
            rows[i - 1].classList.remove('run');
            rows[i - 1].classList.add(last && !state.embed ? 'warn' : 'ok');
            if (last) {
                $('prog3').textContent = state.embed
                    ? 'App embed is on' : 'App embed is off — the lock is saved, not running';
            }
        }
        if (i === rows.length) { scene(0); return setTimeout(reveal, 420); }
        rows[i].classList.add('run');
        scene(i + 1);
        setTimeout(() => stepThrough(i + 1), 1500);
    };
    stepThrough(0);
}

/* ------------------------------------------------------------------ init -- */

/* Everything that says "setup" rather than "a lock". */
if (MODE === 'lock') {
    document.title = 'Create a lock — Airo Access Lock';
    $('wizH').textContent = 'Create a lock';
    /* Setup drops out of the flow by finishing it; a lock you chose to make
       can be abandoned, so this mode puts the way out back. */
    const cancel = document.createElement('a');
    cancel.className = 'btn';
    cancel.id = 'cancel';
    cancel.href = 'locks.html';
    cancel.textContent = 'Cancel';
    $('next').parentElement.insertBefore(cancel, $('next'));
    $('doneX').setAttribute('aria-label', 'Close');
}

state.embed = EMBED_ON;
initLockControls();
render();
