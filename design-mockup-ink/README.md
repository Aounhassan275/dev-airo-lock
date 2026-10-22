# Airo Access Lock — ink scheme

**This folder is `design-mockup-black/` with one ramp swapped.** Every screen,
every word and every measurement below is the same; the accent is ink instead
of dark violet, and `--link` is Shopify's blue again, because a black link in
a black-accented scheme is not a link.

Ten lines in `:root` are the entire difference. Content types keep their own
colours in both folders — those come from the app's own
`resources/js/lib/resourceTypes.js` and carry meaning rather than brand.

Run it on 8745 (the violet one is on 8744, so both can be open at once):

```bash
node design-mockup-ink/serve.mjs
```

---

# Airo Access Lock — design proposal

Every screen the app renders, redrawn. It began as a palette experiment — the
folder is still called `design-mockup-black` — and it is not one any more:
the onboarding is a different flow, the dashboard answers a different
question, creating a lock is a different screen, and the lock and widget lists
report things the app does not yet show.

**Two colours do two jobs.** The app's violet *marks* — selected, current,
running, how far along. Black *acts*: every primary button is black, and
nothing else is, so the heaviest thing on a page is always the thing to press.

- `../design-mockup-current/` — the same screens in the violet they ship in today
- `../design-mockup/` — the earlier Avada-inspired structural proposal

## Open it

Double-click `index.html`, or serve the folder:

```bash
node design-mockup-black/serve.mjs
```

Then open <http://localhost:8744>.

## Screens and where they come from

The app's own entry in Shopify's sidebar carries four pages under it:
**Locks**, **Widgets**, **Subscriptions**, **Onboarding**. Every one of them already sits
under "Airo Access Lock", so "Access Locks" was saying the app's name twice,
"Widgets Dashboard" called a list a dashboard, and "Plans & Billing" was two
words for one page. The app entry itself is the way to the dashboard.

**Onboarding** keeps its place. The `onboard` middleware only sends a store
there on its first run, but the flow is worth being able to open again — to
see what it asks, or to walk another lock through it.

| File | Route | Source |
| --- | --- | --- |
| `onboarding.html` | `/onboarding` | **redesigned** — see below |
| `dashboard.html` | `/` | **proposed** — see below |
| `locks.html` | `/` | `resources/js/Pages/Dashboard.jsx` |
| `lock-builder.html` | `/lock/create`, `/lock/{lock}/configure` | **one page** — see below |
| `lock-preview.html` | `/lock/{lock}` | `resources/js/Pages/LockConfigurePage.jsx` |
| `widgets.html` | `/widgetdashboard` | `resources/js/Pages/widget/Widgetsdashboard.jsx` |
| `widget-builder.html` | `/widget/create`, `/widget/{widget}/edit` | **one page** — see below |
| `plans.html` | `/pricing` | `resources/js/Pages/Plans.jsx`, plus proposed reviews and FAQ |

Each screen is drawn inside a reduced copy of the Shopify admin, because the
app is embedded and about 258px of the window is gone before it renders.

## The palette

**Polaris 13** still supplies the page frame and the furniture: `Page`,
`Card`, `IndexFilters`, `IndexTable`, `Badge`, `Button`, `Modal`,
`EmptyState`.

**Two colours, two jobs: violet marks, black acts.**

**The accent is the app's own violet, taken deep** — `#5b21b6`, on a ramp
from `#f5f3ff` to `#3b0d7e`. It marks: the current step, the chosen card, a
switch that is on, how far along a meter is, the plan you are on, and the
number on a section. One ramp in `:root`, so every tint on every screen moves
together; nothing hard-codes a violet of its own.

It is 800, not 600. A mid violet reads as a brand colour sprayed onto the
page; this one reads as ink that happens to be purple — which is what an
accent sitting beside black buttons has to do, or the two fight each other.

**Buttons are deliberately not on that ramp.** `--btn-bg` is `#1a1a1a` with
`#000` for hover and `#303030` for the inset edge, and it is the only thing
that uses them. A violet primary button beside violet tiles, violet ticks and
violet meters is one violet among many; a black one is the only black on the
screen. The rule that follows is worth stating plainly: **the heaviest thing
on a page is always the thing to press**, however much colour surrounds it.

It carries white at 8.6:1, so a badge, a filled circle or a whole band can
use it. The lighter steps could not: `#8b5cf6` manages 3.4:1 and `#7c3aed`
4.7:1.

**A hue per thing a lock can protect**, from the app's own
`resources/js/lib/resourceTypes.js`:

| Type | Tint | Where it shows |
| --- | --- | --- |
| Products, and Hide price rule | violet `#ede9fe` / `#5b21b6` | a price rule sits on products, so it wears what it targets |
| Collections | blue `#dbeafe` / `#1e40af` | |
| Pages | green `#dcfce7` / `#166534` | |
| Blogs | amber `#fef3c7` / `#92400e` | |
| Liquid theme | sky `#e0f2fe` / `#075985` | |
| Checkout | rose `#ffe4e6` / `#9f1239` | |
| Entire store | red `#fee2e2` / `#991b1b` | the blast radius, not a category |

These are the eight choice tiles on step 1 and on the lock page, and the pills
on every row of the lock list. The type is the most-repeated fact on these
screens and the one thing a colour says faster than a word.

**Surfaces stay white; the marks carry the colour.** Every tinted square in the
folder was briefly the same light violet — the stepper band, the step heading,
the help note, eight choice tiles, four figures, six dashboard tiles. Eight
identical lilac squares in a row carry no more information than eight grey ones
did, and they make the page look themed rather than organised. So the washes
came off, and the tints went to things that differ from each other: a hue per
content type, and for a figure the tone that already means that — green for
what got through, amber for what is waiting on you, blue for what was counted,
violet for what the app itself holds.

**The accent is never decoration** — if it is violet, it is either something
you can press or where you are. `#f1f1f1` and `#e3e3e3` carry surfaces and
hairlines; green stays for confirmation, amber for warnings and for the
recommended plan, red for deleting.

**The header carries the real app icon**, served from the same Shopify CDN URL
the app's own listing uses, rather than a drawn padlock.

**The language picker belongs to the app, not to a page.** It applies to every
screen, so it sits in the app header bar beside the overflow menu rather than
next to one page heading. Below 700px the bar drops the “Design proposal” label
so the name, the language and the menu stay on one line.

**What each colour means, and nothing else is coloured:**

| Colour | Used for |
| --- | --- |
| `#5b21b6` | the accent — what is selected, current, on, or how far along |
| `#1a1a1a` | primary buttons, and the dark panels that carry context |
| `#5b21b6` | links — anything clickable that is not a button |
| `#0c5132` | confirmations and plan feature ticks |
| `#ffd79d` / `#5e4200` | the recommended plan, which is a claim rather than a state |
| `#fff1c2` / `#8a6116` | plan gating, so a Pro badge cannot be mistaken for a tag |
| `#8e1f0b` | deleting a lock, the one action that cannot be undone |

Links were Shopify's `#005bd3`, which left the pricing page with two blues in
it and no reason for either. They are violet now, which is the accent they
already sit beside.

Violet marking "the current thing" is also why the **recommended** plan can no
longer be violet: the ring, the tile and the badge on the plan you are *on* use
the accent, so *Most popular* — a different claim entirely — takes the
attention tone instead.

**Resource pills carry the app's own seven hues.** They were flattened to one
grey here first, on the grounds that the label already names the type. That is
true of a single pill and false of a column of them: in a list, the colour is
what lets you find the two rows that touch checkout without reading any of
them. `resources/js/lib/resourceTypes.js` already ships the map, so this is
the app's palette rather than a new one.

**Icons are monochrome.** Twenty-six colour emoji became stroked SVGs that
inherit the text colour.

## The design language

Three pieces, defined once in `assets/app.css` and used by every screen rather
than copied between them:

| Piece | What it is |
| --- | --- |
| `.panel` | A black surface that carries context — plan state, a lock's details. It stands beside the work on the preview screen; setup and the builder have no rail, and the list pages use plain cards |
| `.stage` | A dark mount for anything the shopper sees. A white popup on a white card has no edge and reads as empty space; on black it reads as a screen |
| `.opt` | A pickable row. The whole row is the target and the chosen one takes the accent border and a tick, instead of a bare radio with a label beside it |

Plus `.split` (panel + work area in one bordered card), `.sum-row` (the
amber-dotted summary lines), `.tag` and `.num`.

**Where each screen puts the panel:**

- **Welcome** — no panel: one card, what the app does on the left and the
  shopper's view on the right
- **Setup** — no panel: the steps run across the top as a connector stepper
- **Lock preview** — beside the work: at-a-glance state and schedule
- **Locks / Widgets** — flat across the top: plan and counts
- **Plans** — no panel: the cards are white, and the recommended tier is marked rather than inverted
- **Cover page** — the hero

## The onboarding is redesigned, not just recoloured

The onboarding was rebuilt rather than restyled, and the rest of the app then
followed its lead. The four-slide tour it shipped with (Welcome, Features,
Quick Start, All Set) told the merchant about the app without setting anything
up, and ended on a screen of marketing statistics.

### A welcome screen, then the work

`welcome.html` is where a new store lands. It says what the app does, shows
the shopper's side of it, and hands over — *Set up your first lock* into the
stepper, *Skip* for anyone who already knows.
It asks for nothing, so it holds no state and never scrolls on a desktop.

**The stage is the card’s right-hand column, not a block inside it.** It sits
beside the work rather than within the body, so it runs the full height from
the card’s top edge to its bottom and the card’s own corners clip it. The
device grows to match. Stacked below 1180px it leads instead — the shopper’s
view, then what the app does, then the button — because a sibling of the work
column can no longer sit between the text and the footer.

**The stage plays the product rather than picturing it.** A nine-second CSS
loop runs the whole thing: the page as a shopper lands on it, the lock taking
hold as the page dims and blurs, a four-character passcode going in, Unlock
pressed, the page back and sharp, and a green *Unlocked* confirming it. Every
piece reads off the same timeline, so nothing drifts. Under
`prefers-reduced-motion` it stops on the locked frame, which is the one that
carries the meaning.

**It stopped saying everything three times.** The subtitle used to read *"Lock
any part of your store, choose who gets through, and design what they see"* —
which is the three headings under it, in order, read out in advance. Then each
heading enumerated: seven kinds of content, six kinds of check, four things
about the popup. One example plus the real count does the same job and is
shorter — *"Twelve checks, from a passcode to a customer tag, joined by all or
any."* The blurbs went from two lines each to one.

**Which left a hole, so the column gained the thing it was missing.** Cutting
the copy left 290px of nothing in a 543px panel: the layout had been sized for
the long words. The three capabilities became cards, and under
them is **What people build with it** — a
wholesale catalogue, a members area, a store being rebuilt. The capabilities
say what the app *has*; this says what to do with it, which is the question a
merchant actually has before pressing *Set up your first lock*. The three are
the same examples the lock list is built around, and each is a combination the
app supports today. Content is 416px in that 543px panel now, with the rest as
margin above and below rather than a gap in the middle.

**And then it was four kinds of box.** Cards with coloured left bars, an
uppercase micro-label, a bulleted list with coloured dots, and a grey pill —
each defensible alone, together reading as four things borrowed from four
places. A panel is one system repeated, not four systems once each. The bars
came off (the icon tile already says which card is which; the bar was a second
marker for the same fact), the examples became one card with a header and
ruled rows — the object the dashboard’s extension list already is — and the
grey pill moved to a meta line beside the heading, where a fact about what the
button does belongs.

Everything it claims is something the app does: the content types out of
`LockCreationFlow.jsx`, the twelve conditions in `CONDITIONS`, the six
palettes in `PALETTES`, checkout being Plus-only, and the "about two minutes"
the real onboarding already quoted. The greeting that used to sit above the
stepper is gone with it, and step 1's **Back** now reads *Back to welcome*
instead of being a hidden, dead control.

**The card's actions run under both columns.** They were in the left column's
footer, so they ended where the text ended — about 60% across a card whose
right half is the demo. The card is a column now: the two panels, then one
footer under both, with the buttons at its right edge and *Skip* the
smaller of the two.

### The design

**The steps sit above the card.** Numbered circles joined by a rule, each
labelled underneath, with *Current* under the one you are on; the card below
holds only the decision being made right now, at full width. The rail that used
to hold the steps is gone — it cost a third of the screen to say what a row of
circles says in one line, and the rule between them already shows how far along
you are, so there is no separate progress meter.

**The stepper drops a step when the lock has no popup.** "Hide the Add to
Cart button" and "Hide the product completely" show the shopper nothing, so
there is nothing for "What visitors see" to ask about: the step leaves the
stepper and the remaining circles renumber, six becoming five. Switching the
action back brings it straight back.

**Enabled moved into Settings**, where it belongs with the other lock settings
rather than floating beside the steps.

**The content types are choice cards, not a radio list.** Each of the eight
carries an icon tile, its name and one line on what it covers; the chosen one
darkens its tile, rings its border and shows a tick. The eight-way decision is
the first real thing the merchant does, so it gets the weight.

**What is chosen gets its own bar.** The selection under the grid is dashed and
muted until something is in it, then turns solid and says what it is holding —
*3 products chosen / Only these are locked. Everything else stays open.* Once something is in it a **Clear all**
button appears beside *Choose*, and it empties the picker’s ticks too, so
reopening it never shows a selection the bar says is gone.

**The preview stands on a light stage.** It was black, to give a white popup
an edge it would not have on a white card. That worked at 300px beside the
work, but on the welcome screen the stage is half the card, and a black slab
that size is only weight. It is now a soft grey-to-white wash on every
screen that draws one — setup, the builder, the lock preview, widgets and the
widget editor — with the device's own shadow doing the lifting the dark
surround used to.

**One accent**, and in the stepper it only marks progress: the active circle
with its ring, its *Current* caption, and the rules behind it. Steps ahead are
grey, and the button that moves you on is black like every other primary
button.

### Setup is where the violet lives

The flow showed almost none of the accent it was built around: a stepper, one
selected radio, and a very large amount of white. Three things changed, and
only one of them is colour.

**The stepper became a band.** It was four circles floating on the admin's
grey. It is the one element every step shares, so it is now a tinted card the
work card sits under — `--v-50` fading to white, inside a `--v-200` hairline.
The question under it sits on the same wash, with a rule where the wash ends,
so the head of the card and the band above it read as one object.

**The icon tile in front of every choice stopped being a grey square.** Eight
of them on step 1 alone, and they are the most repeated object in the flow;
tinted `--v-50` with a 600 glyph, they are what makes a step read as part of
a coloured app rather than a form on a white page. The selection bar does the
same while it is empty — it is waiting for you, and it says so in the accent.
Full, it stays green, because then it is done.

### Step 1 had a 223px hole in it

Measured at 1534×850: the work card is 677px tall, step 1's two columns are
320px, and `align-content: start` left 223px of white underneath them. The
flow was built to *fit* the window — a stack of height tiers trims content
when the window is short — and nobody had looked at what it does when the
window is tall.

Both short steps now use `align-content: safe center`, so the slack becomes
even margins above and below instead of a hole at the bottom. `safe` matters:
plain `center` on a column that can overflow pushes the top out of reach, and
this column scrolls below 694px.

**The band costs height, and step 3 fits the window to the pixel**, so it
gives that height back where it matters: the tiers that already trim content
on a short window collapse the band's padding too. Step 3 has 0px of overflow
at 900, 850 and 700; below 694 its column scrolls, which is what it has always
done.

**One surface was left alone on purpose.** A pass that softened the hairlines,
grew the radii, put a violet wash behind the card and gave a chosen card a
glow was tried and reverted — the flow keeps Polaris's own weights, so it
still looks like something that belongs inside the Shopify admin rather than
beside it. The focus ring kept its violet from that pass: it was the last
`#005bd3` in the folder, and that was the palette change, not the restyle.

### Step 1 builds a real lock

Setup used to pick a resource *type* and move on, which meant "Create my
lock" had nothing to create. Step 1 now collects all three things a lock
needs:

- a **name**,
- a **type**, and
- the **items** themselves, through the same picker the builder uses —
  search, Title/Vendor/ID sort, Add filter, Refresh from Shopify, Select all.

**Store** and **Checkout (Plus)** cover everything, so there is nothing to
pick: the row reads *"Every page of your storefront will be locked"* and the
button says *Nothing to choose* rather than offering a dead control.

**Choosing a type opens the picker straight away**, as it does in the shipped
builder — picking the type is the merchant saying "these ones", so the app
asks which rather than waiting for a second click. The Choose button stays as
the way back in to change the selection. Switching type clears what was
picked instead of silently keeping stale items.

The picker also matches the type it was opened for: collections list product
counts, pages list handles, themes list Live/Draft, and the heading, search
placeholder and item count follow.

**Continue stays disabled until the lock could actually be built** — a name
plus either items or a whole-store type.

Nothing is pre-selected on step 1, because a type on its own is not enough.
Steps 2 and 3 do carry a sensible default, and the panel now says so on load
instead of showing a selected card beside "Not chosen yet".

### Setup carries the whole builder

Every field the create-lock page used to carry now appears in the flow, across its steps,
with every modal. Behaviour lives in `assets/setup.js` so the markup stays
readable.

**Step 1 — What to lock.** Lock name; the eight content types; the item picker;
and **When locked, do this**, whose options depend on the type. Choosing *Hide price rule* swaps the action for its
own settings — price hidden message, hide on all pages, disallow Add to Cart.

**Step 2 — Who gets in, and on what terms.** One step, three columns across
the whole card.

*The first column* is the checks: a row per condition with the AND/OR operator
over them, **Add condition** as a dashed tile under them, and the condition's
own form in a modal. Conditions that take a list carry **Add in bulk**, which
opens the paste box and reports what it parsed.

*The second and third* are what used to be Settings: how long access lasts,
redirect URL, hide from search engines with the app's noindex copy, the
Enabled toggle, variant behaviour (product locks only), and the schedule with
both its hints.

They are the same subject — the checks a visitor has to pass, and the terms
that apply once they do: how long the access lasts, when the lock starts and
stops, where the ones who fail are sent, what happens to a locked variant.

There is no preview on this step, which is what makes three columns fit.
Settings alone already filled a two-column grid at a 900px window, so the
conditions needed a third, and the step after this one — *What visitors see* —
is the preview, one click away. Step 1 has no preview either, for the same
reason: it is the step that decides what a preview would be of.

It is the tallest step in the flow now, so it trims first: below 820px the
Settings hints go, along with the operator sentence and the condition count
that repeat the controls above them; below 720px the sections close up their
spacing. Measured at the tallest it gets — three conditions — it fits with
nothing scrolling from 900px down to 640.

**Step 3 — Design it, then switch it on.** One step, two halves, one device
between them.

*On the left,* what the lock shows: Form and Text widget selects, shown only
when the conditions call for them — pick one of each and it says *"This lock
needs both widgets"*. **Create widget** opens the editor in place and takes
the whole column while it is open. **Edit wording and preview** opens the
paired editor, and the line above it names what you changed.

*On the right,* what makes it run: the app embed's state, **Enable in theme
editor**, **Check again**, and the three-step manual route under them.

Designing a popup and switching the app on were two steps, which meant the
screen showing the lock and the screen saying whether it was running were
never the same screen. One device serves both now: it draws the popup the
merchant designed, and greys itself with a *Not running yet* badge while the
embed is off. **Check again** turns it on and the device comes up with it.

**Either half can be absent, and the step adapts rather than vanishing.** A
lock that hides its content outright has no popup to design; a store whose
embed is already on has nothing to switch. With one half gone the step is a
single column and renames itself — *What should visitors see?* or *One switch
left* — and so does its circle in the stepper. With both gone, the step goes.

**Each half says what it is.** A small-caps heading over each — *What visitors
see*, with the Form/Text badge beside it, and *Turn it on* — and one hairline
rule between them, which becomes a rule above the second when they stack.

The left half was built when it had the step to itself: two grey info boxes,
each with a heading and a paragraph, for things that are one line of help under
the control they describe. In half the width they wrapped to four lines each.
They are what they are now — the half's heading, and `.help` text under the
field — and the column went from 459px to 218.

The design select was in a two-column grid with nothing in the second column —
the other widget kind is hidden unless the lock needs both — so it sat at half
width and clipped *"None (use default design)"*. It has the row to itself now,
and the **+ Create widget** link under it is flush with the field rather than
stretched and reading as centred. The pairs inside the widget editor below
still sit two across; that grid is scoped to the one row that needed changing.

Measured per half rather than per column, because the grid stretches them and
`scrollHeight` then reports the stretched height rather than the content: the
tall half is the switch, 504px against 353. So that is the half that trims
first — below 740px the line repeating the heading above it and the rule
naming the three cards below it, and a few pixels off the card; below 770px
the popup half drops the sentence explaining which widget kind applies, since
the badge in its heading says so; below 715px the looks/says explainer, which
the line under it reports anyway.

Nothing scrolls from 900px down to 660, with 30 to 130px spare throughout.
That margin is the point: fitting exactly is what turns into a scrollbar the
moment a string grows or a window loses a few pixels.

**The switch is in the flow at all** because a saved lock does nothing until
Airo's theme app embed is enabled, which is why the app carries an app-wide warning ("Your
locks are inactive. The app embed is turned off on your theme."). Putting it
in the flow means the merchant leaves setup with a lock that works rather than
meeting that toast later. It asks for one thing, so it is one thing: a centred
card carrying the state, what it means and the button — and the preview
beside it always draws the lock. Hiding the popup while the embed is off was
literal, since that is what the storefront does, but it read as the preview
being broken: the one screen about the lock was the one screen not showing it.
The off state is said by greying the page behind it and badging it *Not running
yet* instead. The card itself is painted by the same `paintPreview()` that
draws the other steps, so it carries the widget the merchant designed rather
than a hard-coded default.

The do-it-yourself route is demoted to three small cards under a labelled rule. The
card is white like every other card and keeps the colour in its icon tile —
amber off, green on — because a solid block of warning colour is louder than
anything else in the app, and the rule here is that colour marks state rather
than fills shapes. The step starts trimming at 830px rather than
when it runs out, so it always keeps 50–120px spare: fitting to the pixel
leaves nothing for a fractional layout to round into, and at 125% display
scaling that rounding is enough to put a scrollbar in the card. The button
deep-links to:

    https://<shop>/admin/themes/current/editor?context=apps
        &activateAppId=<api_key>/access_controll

which opens the editor with the block already switched on — `ThemeExtensionService::deepLink()`
builds it, and the merchant only presses Save. **In the mockup the state is
simulated: *Check again* finds it on, and the button's `href` is a
placeholder.**

**Step 4 — Done.** It shows its work before it shows the result: *Creating
your lock*, *Publishing it to your storefront*, *Checking the theme app embed*,
each with a drawing above it that acts the job out: a padlock whose shackle
swings down and body draws itself shut, the lock landing onto the page it is
protecting, and a glass sweeping a theme panel until the embed switches on.
Inline SVG rather than GIFs, so they take the accent colour, stay sharp at any
size and cost nothing to load. About 4.5 seconds end to end. The third reports
what the embed check actually found — green when it is on, amber with “App
embed is off — the lock is saved, not running” when it is not — so the result
that follows is never a surprise. Under `prefers-reduced-motion` the run is
skipped and the result appears at once.

Then the lock read back — name, what it protects, who it opens
for, what it shows — and a heading that tells the truth about what is
happening: *Your first lock is live* when the embed is on, *Your first lock is
saved* with an amber mark and "it will start running as soon as you turn the
app embed on" when it is not. The footer goes entirely on this step: a result
screen has no Back, Skip or Continue to offer, and a bar standing empty under
a centred panel reads as an unfinished page. **Quick view** — which opens the lock itself, the
first thing anyone wants to see after building one — and **Close** sit in the
panel itself, centred under the summary, with a close
in the card’s corner for anyone who wants out without choosing either, and a
line under them — *Not quite what you wanted? Chat with us and we’ll sort it.*
— for when the lock did not come out right. **That link is the same
placeholder `href` as the help note and needs the real support chat URL.**

The mark is a party popper, not a tick: it tilts in, overshoots and settles,
thirty paper pieces burst from behind it, and the copy and summary rise in
after. Making a first lock is worth the celebration whichever state it is in,
so the live/saved distinction is carried by a pill under the heading — green
*Running on your storefront* or amber *Waiting on the app embed* — rather than
by withholding the burst. Everything plays once and settles; nothing loops,
and `prefers-reduced-motion` removes all of it.

**A way out of every step.** Each step’s heading row carries a quiet offer of
a person — *Stuck on any of this? Chat with us and we’ll set it up with you* —
in the corner opposite the heading, where it costs no height because the
heading and its line are already taller. Where the head gives up its
description on a short window, the note gives up its own and keeps the
question. **Its `href` is a placeholder and needs the real support chat URL.**

**The checks read as a list, not a form.** AND/OR governs every condition under
it, so it is a segmented control you can read at a glance rather than a
dropdown — the operator by name with the plain reading under it, `AND / all
must match`, and just the operator once the window is short; the condition’s two fields sit side by side, which stops a select and
an input stretching to ~995px and roughly halves the card; and *Add condition*
is a dashed tile the width of the list — the obvious next move, not a small
button parked below it. A textarea condition (multiple passcodes, email lists,
email/passcode pairs) spans both columns.

**The conditions are rows; the form is a modal.** A full form card per
condition meant three of them outgrew the card and the list scrolled inside
it. A row is one line — number, the check, its summary, Form/Text, Remove — at
about 40px against ~150px for a card, so six fit without scrolling on a 660px
window and eight on an 800px one. Clicking a row opens it in the modal to
edit; *Add condition* opens the same modal empty. *Add in bulk* opens on top
and leaves the condition underneath, so closing it returns to the condition
still being edited.

**Price visibility uses the same cards.** Hide Price Rule’s two settings were
bare native checkboxes under a text field, directly beneath the action cards.
They are now the same card with a square mark, and they carry the group heading
“Visibility options” and the first option’s help line from `HidePriceRule.jsx`,
both of which the mockup had dropped. Their on/off state is a class set from
the change event, like the radios.

**“When locked, do this” is a radio group, not a select.** The consequence is
the decision — hiding a collection’s page is not the same as hiding its
products — and a select shows one option at a time with the rest closed. Each
action is now a card carrying its own `LOCK_ACTION_HELP` line, so the four
collection actions can be compared at a glance. Collections is the tallest
case; below 694px the lines give way and the labels stay. There is no longer a
second screen asking this with a select, so `fillActionChoices` is the only
filler left.

**Step 1 uses the card, in two columns.** It was one tall stack: a 430px field
with 690px of empty card beside it, and the eight content types spread four
across to fill a width the form never used. On a wide card the lock's own
settings — its name and what locking does — now sit in a 340px column on the
left, and what it covers sits on the right. Both columns come out about the
same height, so the card is used end to end and step 1 is barely more than half
as tall as it was.

The DOM order stays name → content → items → action, which is the order it has
to read in when the columns stack; `order` only regroups it above 1100px.

**Width buys height.** Because the two columns roughly halve step 1, its
short-window trims no longer fire at the same point everywhere: below 1100px
they start at 759px as before, above it they wait until 599px. Previously a
wide, short window hid every description while leaving ~90px of empty card
below them.

**The preview in a modal scrolled sideways over one pixel.** Same cause as
the focus rings below: `overflow-y: auto` makes `overflow-x` compute to
`auto` too, and the stage came out a pixel wider than its box, so the wording
editor's preview carried a horizontal scrollbar it had no use for. The device
inside it is a fixed width, so there is never anything to scroll sideways to:
`overflow-x: hidden`.

**Focus rings had nowhere to go.** The work column scrolls, and a box with
`overflow-y: auto` clips on all four edges — `overflow-x: visible` computes to
`auto` once the other axis scrolls. Focus rings are painted outside the
control, so every field’s ring was sliced off down its left edge. The column
now carries 3px/4px of padding and pulls it back with a matching negative
margin, so the ring has room and nothing moved.

### The widget editor is on the step, not over it

**Create widget** used to raise a 940px modal with its own live preview, on
top of a step that already had one — a second answer to a question the page
was answering, covering the conditions that decide what the widget has to
show. It opens in the step instead. The device beside the form is the preview,
and it repaints as you choose: the palette's four colours, the card's padding
and radius, the button's text.

There is room for all of it here. The step's column is 736px wide with about
250px of it unused, and while a widget is being made the things that are about
the lock rather than the design — the Form/Text note, the looks/says explainer,
the wording line and the select itself — stand aside and come back when it is
saved or cancelled.

Saving appends the design to the select it was started from and selects it. A
design is a set of colours under a name, which is the shape the options the
preview already reads are in, so nothing downstream changed. Cancelling puts
the previously selected design back on the device.

It asks what the editor the app actually has asks, not a list of hex boxes:

- **Colour palettes** — the six from `Widgets.jsx` with their real values:
  Classic Dark, Midnight Orchid, Minimal Light, Vibrant Sunset, Emerald, Ocean
  Blue. Each row shows the four colours it sets, in the order it sets them.
- **Colours** — Text, Card, Button BG, Button text, as editable swatches.
  Changing one by hand clears the palette selection, because the design no
  longer matches a named palette.
- **Style** — Card pad, Card rad and Button text, each redrawing the device
  as it is typed.
- **Language** — Popup language, defaulting to *Follow the storefront language
  (recommended)*, with the note that each visitor sees their own.

The old modal had to label its preview **Sample fields** and say in words that
*"actual fields will be auto-generated from lock conditions"*. The device does
that instead of saying it: the boxes it draws are the ones this lock's
conditions ask for, and a text widget draws none of them and no button, since
a text widget has nothing to submit.

Being taller than the select it replaces, it trims on its own ladder: below
860px the note under it goes and the palette tiles tighten; below 820px the
refinements — padding, radius, button text — go with them, because the palette
is the decision and those are adjustments to it. Measured open with the full
set of fields, it fits with nothing scrolling from 900px down to 660. The
palettes go three across at full width, two below 1180px and one below 900.

### No plan badges in the pickers

The content-type and condition lists used to carry Pro and Unlimited badges.
The shipped dropdowns do not: they list all eight types and all twelve
conditions plainly, because plan limits are enforced when the lock is saved,
not advertised while the merchant is still working out what they need.

A merchant deciding how to protect their catalogue is not shopping for a plan,
and a list where half the rows are marked unavailable reads as a smaller app
than it is.

### The preview is on the steps it is about

Not every step has one, and the two that do not are the two where it would
have been a promise the step could not keep.

Step 1 asks what to lock; nothing chosen there changes what a shopper sees, so
the preview beside it was a generic card reflecting none of the merchant's
answers. Step 2 asks who gets in and on what terms — and those answers do
decide the popup's fields, but the step needs all three of its columns, and
the step straight after it is **What visitors see**, which is the preview.

So steps 1 and 2 take the width back, and step 3 carries the device alone —
the step that designs the popup and the step that says whether it is running
being the same step now, it answers both questions at once.

### The card shrinks instead of clipping

On a 720px-tall laptop the card was shorter than the panel needed, and the
panel hid its own overflow — so the Enabled toggle and the progress bar
simply did not render. The merchant could not see which step they were on.

Hiding overflow was the wrong lever. Two height tiers now make the contents
shorter so everything stays visible:

- **Under 940px** the card gives up spacing: smaller panel padding, tighter
  step rows and summary, a shorter preview device.
- **Under 860px** it gives up detail: the step descriptions and the panel
  note go, the eight content types lose their one-line descriptions and move
  to three columns, and Settings flows into two columns so every field stays
  — including the schedule.

The panel keeps `overflow-y: auto` purely as a backstop, so nothing can ever
be invisible again. Measured at 720, 800, 900 and 1040: every step reports
zero overflow in both the panel and the working column.

### It works on a phone

Setup was desktop-only in two ways, and the first was the serious one.

**It locked the frame's scrolling unconditionally.** That is right when the card
fills the window, but on a phone the content was 2,263px inside a 744px frame —
so the page was clipped with no way to scroll and **Continue was unreachable**.
The lock now applies only above the layout breakpoint, and re-evaluates when
the window crosses it.

**Each step is trimmed on its own schedule.** The short-window tiers used to
apply to every step at once, so step 1 lost its option descriptions and help
text at 820px while still leaving ~105px of empty card below them. Step 1 now
keeps its text down to 795px; steps 2 and 4, which genuinely run out of room
first, are trimmed where they always were.

**The stepper stays one row.** Below 900px the circles and labels shrink rather
than wrap or scroll sideways, so every step stays visible on a phone; only
the *Current* caption goes. The old side rail, which ran for about 900px before
any of the work appeared on a narrow screen, is gone entirely.

**Settings is two real columns, not a flow.** A multi-column flow fragments
sideways once it outgrows two columns, which put a horizontal scrollbar inside
the card at short window heights. The sections are now grouped into two
columns that simply get taller, and a separating rule is dropped at the top of
each one.

Also: modals take the screen rather than floating in the middle of it, the
picker list fills the height available instead of leaving a gap under a fixed
cap, and the footer keeps its actions on one line.

Checked at 375, 768 and 1480. No horizontal overflow at any of them, and the
desktop behaviour is unchanged — every step still fits the window with
nothing scrolling.

### Modals are bounded too

A modal had no height limit, so the widget editor simply grew past the window
and its title and its Cancel/Create buttons were clipped off the top and
bottom — the actions were unreachable.

Every modal is now capped at the viewport and scrolls its own body, with the
header and footer pinned. The ones built from the split needed the same
height chain the page uses, or the body grows instead of scrolling.

Checked at 870px and at 680px: the picker, condition, bulk entry and wording
modals all fit at both. (The widget editor was what drove this rule; it is not
a modal any more.)

### It fits the window

Setup does not scroll. The card fills the app frame, and the options sit in two
columns so even the twelve conditions land on one screen — a first run that
makes you scroll to see your choices is a first run you misjudge.

Two things that had to be right for that:

- **The fit chain.** `.work-body` aligns children to `flex-start` by default,
  which leaves the options column unbounded, so it spilled past the card's clip
  and silently hid the last four conditions. The body now stretches and the
  column owns the leftover height.
- **Clipping is worse than scrolling.** The column keeps `overflow-y: auto` as
  a safety valve. It does not engage at normal window heights, but on a very
  short one it scrolls instead of hiding rows the merchant cannot tell are
  missing.

On step 2 the condition titles are short so they do not wrap — the app's real
label moved into the description line, so nothing was lost to make room.

### Every option on it is a real one

Nothing is offered here that the app cannot do. The three steps were checked
against the source and the invented parts removed:

| Was offered | Verdict |
| --- | --- |
| Popup position — centre / bottom bar / top bar | **Removed.** `access_ui.js` always renders a centred card over a fixed full-screen veil. There is no position setting |
| Behind the lock — blur or hide | **Removed.** The veil is hardcoded `rgba(0,0,0,0.6)` |
| Style presets — Basic, Golden, Midnight… | **Removed.** There are no presets. Colours, corner radius and padding live on a *widget*, and a lock picks a saved widget |

What replaced them is what the lock builder actually has:

- **Step 1** — the eight content types the builder offers: products,
  collections, pages, blogs, hide price rule, liquid theme, store, checkout.
- **Step 2** — all twelve conditions from `LockCreationFlow.jsx`. Each carries
  the app's own **Form / Text**
  split: only `singlePasscode`, `multiplePasscodes`, `ageVerification` and
  `pairedCredentials` ask the visitor for anything.
- **Step 3** — pick a saved **widget design** (or the default) and override the
  **wording for this lock**, with the real fields from `PopupTextModal.jsx`:
  title, message, button, and the label and hint for each box. The language
  selector is there because wording is stored per locale.

That Form/Text split drives the preview. A Text condition draws no input boxes
and **no button** — there is nothing to submit — and step 3 stops offering
button wording for it. Age confirmation replaces the button with its own.
Field wording only appears for boxes the chosen condition actually shows.

### Step 2 is two cards, and one switch fewer

It was three bare columns of fields on white, with uppercase grey labels as
the only structure: nothing said where one group ended and the next began
except a hairline. It is two cards now, with the header strip every other card
in the folder has — **Conditions**, with the AND/OR control in its header, and
**Settings**, marked *All optional*, holding the rest in two columns. Each card
ends where its content ends rather than stretching to match the other, because
half an empty card beside a full one is worse than two of different heights.

**Status came off.** A lock you are creating is on — that is what creating it
means — and a switch whose only useful position is the one it starts in is a
question asked for nothing. Turning a lock off is something you do later, and
there are two places to do it: the toggle on each row of the lock list, and
the Status section on the lock page, which also edits locks that already
exist. `lock-controls.js` guards the wiring, so the screen without the switch
and the screen with it share the same file.

The cards cost about 30px of chrome, which the height tiers give back: at 820
and below the header and body paddings tighten with everything else. Step 2
has 0px of overflow at 850 and 2px at 700; below 694 the column scrolls, which
is what it has always done.

## The flow covers the real pieces

Creating a lock carries the parts of the shipped builder that were missing
from the mockup:

- **The resource picker.** Opening a type and pressing Browse shows the real
  modal: search, a Title/Vendor/ID sort, Add filter, *Showing 17 of 17 items*,
  **Refresh from Shopify**, Select all, and rows with a thumbnail and vendor
  under each title. Add Selected fills the selection bar and unblocks Create.
- **The content types as they are today.** Products, Collections, Pages, Blogs,
  Liquid Theme, Store, **Checkout (Plus)**, Hide Price Rule — Variants is
  commented out in `LockCreationFlow.jsx`, so it is gone from the mockup and
  from the setup screen too.
- **The Widgets card.** The Form/Text badge, *Form widget applies to this
  lock*, the design select, Create widget, and the **What the popup says** box.
- **Active toggle**, in Settings.

## A wizard for the first lock, one page for every lock after

Creating a lock and running setup ask the same questions, so for a while they
were the same screen. They are not the same *task*.

Setup is a store's first lock, and a first lock is something you are being
walked through: four questions, one to a step — what to lock, who gets in,
what visitors see, turn it on — and a result at the end. A lock that hides
its content has no popup to design, and a store whose embed is already on has
nothing to switch, so the flow is three steps or four depending on the lock.
Every lock after that is a form you opened on purpose, and **editing** one is a
form you opened to change a single thing in. A wizard puts that thing four
clicks deep, makes you walk past three screens you did not come for, and never
shows you the whole lock at once.

So `/lock/create` and `/lock/{lock}/configure` are **one page** —
`lock-builder.html` — and `/onboarding` keeps its stepper, unchanged.

**The controls are the same objects, not copies of them.** The half of
`setup.js` that was about a lock rather than about a wizard moved into
`assets/lock-controls.js`: the state, the type cards, the item picker, the
twelve conditions and their modal, the widget selects, the inline widget
editor, the wording editor, the embed check, and the preview they all feed.
`setup.js` kept the steps, which step this lock actually has, and the done
screen. Both screens load the controls; neither owns them.

What a screen has to supply is five callbacks, and nothing else:

| Hook | The flow does | The page does |
| --- | --- | --- |
| `changed` | re-render the stepper | mark the save bar dirty |
| `gate` | enable **Continue** | enable **Save** |
| `actionChanged` | retitle step 3, show or hide its halves | grey out section 3's number, swap its subtitle |
| `makingChanged` | give the widget editor the whole step | scroll it into view |
| `embedChanged` | — | grey out section 5, drop the manual route |

**The page is five numbered sections**, in the order the lock reads: what to
lock, who gets in, what visitors see, how it behaves, turn it on. They are
numbered even though they are all visible, because they are still an order —
you cannot choose who gets in before you have said what the lock covers.

**The preview rides in the rail, stuck to the top of the window.** On the
stepper it was a step you had to arrive at; here it is beside whatever you are
changing, with the running summary under it — *Protects 3 collections · Opens
for A passcode · Shows Trade gate* — which is the one thing a wizard genuinely
cannot do. Under 1100px the rail stops being sticky and lies down as a row,
because pinning a 500px card over the form is worse than scrolling past it.

**Saving uses Shopify's contextual bar.** The page keeps Cancel and Save at the
top, and a bar appears at the bottom the moment something changes, so Save is
reachable from wherever you stopped typing. It says what is missing while the
lock is not saveable — *Name the lock and choose what it covers first* — which
is the same rule the flow's **Continue** gates on. Leaving with unsaved changes
asks the browser's own question, since nothing here is stored.

**Editing starts from the lock**, through the same controls: `?id=14` fills in
*Wholesale catalogue*, ticks Collections, sets the item count and the design,
and leaves the save bar down because nothing has changed yet. The title becomes
the lock's name, the id and a **Running** badge sit beside it, **Create lock**
becomes **Save**, and a **Delete** appears — with a confirmation that says what
deleting actually does: the content goes back to being open to everyone,
straight away.

### What setup still does that the page does not

**It drops steps.** "Turn it on" asks the merchant to enable the theme app
embed. A store creating its second lock turned it on to create its first, so
the question is already answered and the step is not shown. The circles are
numbered by their place in the path rather than by which step they are, so
what is left reads 1-2-3-4-5 with no gap where the fifth used to be, and
**Create my lock** moves to whichever step is now last.

That is one of two steps the flow drops on its own. The other is step 3, *What
visitors see*, which goes when the action hides the content outright — there is
no popup to design. A lock that hides a product on a store with the embed
already on is two questions and a result.

The one-pager has nowhere to drop a section to, so it greys the number and says
why inside the section instead: *This action hides the content outright, so
there is nothing for a shopper to read.* Section 5 greys the same way once the
embed is on, and loses the three-step manual route under it.

Which embed state either screen starts in is what the server would have told it
(`ThemeExtensionService::status()`). Setup starts with it off and the lock page
starts with it on, because that is what each case usually means. `?embed=on`
and `?embed=off` force either, so both paths can be looked at from either
screen.

### What the two screens used to differ by

Before this, the builder asked the same questions through a different set of
controls. Those were aligned first, and the alignment is what made one screen
possible:

| Was, on the builder | Is, on both screens now |
| --- | --- |
| A dropdown listing eight type names | Eight choice cards with an icon and a line each |
| A hand-written list of chosen items | The selection bar, with **Clear all** |
| A `<select>` for *When locked, do this* | A radio card per action, each showing its consequence |
| A `<select>` for AND / OR | The segmented control, both words visible |
| Condition forms stacked down the page | One row per condition, its form in a modal |
| A native checkbox in Settings | A checkbox card |
| Native checkboxes for price visibility | The same cards setup uses |
| A summary rail in black, 296px wide | Nothing — the step you are on is the summary |

That alignment is what makes two layouts safe. The shared pieces are
**"the lock form"** and **"the widget editor"** at the end of `app.css`; the
twelve conditions, the sample rows and the drawing helpers in
`assets/lock-form.js`; and the behaviour in `assets/lock-controls.js`.
`assets/builder.js` is gone, and so is `fillActions`, the second filler that
put the action list into a `<select>`.

### The item picker reports instead of decorating

The strip over the list said **"Showing 6 of 6 items"**. It was written once,
when the picker opened, and never again — tick five boxes, search, refresh,
and it still said the same thing. A count that cannot change is decoration in
the shape of information. Meanwhile the count that *did* change, "0 selected",
was at the far bottom of the modal, in the footer, as far from the list as the
modal allowed.

So the strip became a toolbar that reports and acts:

| Was | Is |
| --- | --- |
| *Showing 6 of 6 items*, fixed | **6 products** → **2 of 6 selected**, live |
| **Select all**, dead once everything was ticked | **Select all** ⇄ **Clear selection** |
| *↻ Refresh from Shopify*, a violet link mid-row | a quiet **Refresh from Shopify** button that spins, then re-reads — and **keeps the ticks you already made** |
| *0 selected* in the footer | the footer says what the choice means; the button counts it: **Add 2 products** |
| **Add selected**, always live | disabled until something is selected |

**A row says whether it is chosen.** It was a 16px checkbox and nothing else,
which is no way to find your four ticks in a list of twenty; the row now takes
a tint and an accent edge.

**The thumbnails take the type's colour** — violet for products, green for
pages, blue for collections — so a picker full of products looks like the
Products tile that opened it.

**The list shows whole rows.** 262px against a 57px row left a row and a half
showing at the bottom, which reads as a rendering accident rather than as
"there is more". It is 285px — exactly five.

### The language list comes from the store

**Popup language** listed three languages that somebody had typed into the
markup. A store’s languages are not a constant: Shopify’s Markets settings
decide which locales it publishes and Translate & Adapt fills them, so the
list has to be read rather than shipped.

The editor gains **Sync languages**, in its header row beside Cancel — it is
an action on the editor rather than a property of the field, since it re-reads
the store and does not change the widget. Same shape as the picker’s *Refresh
from Shopify*: it spins, re-reads, and the note under the select says what it
found: *“Synced — your
store publishes 4 languages, English first.”* The sample store publishes four,
so syncing visibly discovers one the hardcoded list did not have.

It fills **both** language selects: the widget editor’s and the wording
editor’s. They describe the same store, so they cannot be allowed to list
different languages for it. `STORE_LOCALES` in `lock-form.js` stands in
for the call; the four locales are sample data like every other figure here.

The four modals — item picker, condition, add in bulk, popup wording — are
markup, so each screen carries its own copy of it; every line of behaviour
behind them is the shared one. The widget editor is not a modal on either: it
is fields in place, beside the preview it belongs to.

## The dashboard answers one question first

### The data is the loudest thing on it now

Two objects were competing with the figures they sat next to.

**The call band was a saturated violet slab**, 70px tall, between the figures
and the chart. Once the pricing page was lightened it was comfortably the
heaviest object in the app — and it was heavy on the one screen whose job is
to let you read numbers. It was lightened to a tinted card, and has since gone
altogether: it and *Would you rather we set it up for you?* were two offers of
the same thing — a person who will do this with you or for you — at opposite
ends of one screen. The one that survives is the one that asks for less: a
request you leave behind rather than a calendar to negotiate. It now sits
directly under the figures, where the band was.

**The chart was fourteen grey slabs with violet feet.** Measured: 50px-wide
bars in a 132px-tall box, so each bar was nearly as wide as the chart was
tall, which is what made it read as a row of blocks rather than a series.
Fourteen days carried two labels — *7 Oct* and *Today* — so no bar could be
identified, there was no scale to read a height against, and the only tooltip
was the browser's own `title`, which takes a second to appear and looks like
a file manager.

It is a chart now: bars capped at 26px and centred in their column, a scale
down the left with three labelled gridlines, a date under every bar with the
busiest one in bold, the peak bar in the deepest tone of the ramp, and a
tooltip that sits on whichever bar you are over — *14 Oct · 72 stopped, 28
got through*. The caption that used to name the peak is gone, because the
scale and the bold label now say both halves of it.

The four figures are links, so they answer when you point at one: the number
goes violet.

### The other apps are on it, from the app's own list

The dashboard carries a **Recommended apps** shelf at the foot of the main
column: five apps, three to a view, the rest a swipe or a dot away.

Each card is a thing to do rather than a thing to buy — *Generate barcodes*,
*Build a workflow*, *Bulk edit products* — because an app listing pasted into
an app reads as an advertisement, and these are the same team's work running
on the same store. The App Store ratings and review counts went with that
reasoning: a rating is for choosing between strangers. The card is no longer
one big link either; the verb on the button is the only thing that leaves.

Nothing about it is invented. The app already cross-promotes through
`resources/views/partner-apps-dock.blade.php` — a pull-tab on the right edge,
included from `app.blade.php` with `exclude => 'locksmith'` — and the names,
taglines, URLs, logos, ratings and review counts here are read from that file.
This app is left out of its own list for the same reason the dock leaves it
out.

It started in the rail, on the grounds that it is the one thing on the screen
not about this merchant's locks. It reads better in the main column: five
stacked rows in a 282px rail is the narrowest place on the page and the
longest way to show five things, and the main column ends well above the rail
does, so the shelf fills space that was empty. Across, it is a thing to glance
at rather than a list to read.

Dots mark the pages and move it a page at a time; the track still scrolls and
swipes on its own, and it takes keyboard focus. The dots count themselves from
the track rather than assuming three to a page — measured at a 1150px window,
a fixed count put the last card where no dot could reach it. The logos load
from the App Store; if they do not, each tile falls back to the app's
monogram, which is what the dock does too.

### Busiest locks came off

The card used to carry a ranked list of the three locks under the chart —
the summary and the detail of the same thing in one card. It printed every
number twice (*“341 of 468 · 73%”*, then *“341”* again sixty pixels right),
drew its bars in a different colour from the chart above them, and quietly
mixed periods: the card said *the last 14 days* while the rows were 30-day
figures. Those were fixed; then the list went, because which locks earned the
figures is the locks list's job and that is one click away in the sidebar.

The card is the chart now, and its styles went with the list.

### What came off it

The screen had been growing, and the duplication was countable. Every
destination it offered, and how many ways it offered it:

| Destination | Ways to reach it from this page |
| --- | --- |
| Locks | header button, two of the four figures, *All 3 locks*, a tile, the sidebar |
| Widgets | header button, a tile, the sidebar |
| Subscriptions | a tile, *View plans* in the rail, the sidebar |
| Onboarding | a tile, the sidebar |
| A person to help | the band, a rail link, the chat, the done-for-you card |

**The six “Everything in Airo” tiles went.** They were added when this screen
was thin — a setup guide and an extension list — and it is not thin any more.
Six doors whose job the sidebar does permanently, and every one of them
reachable from something else already on the page.

**The two header buttons went with them**, having nothing left to add, and
so did the **date range**, which was a control that changed nothing while the
headings under it already said *last 30 days* and *last 14 days*. A dead
control telling a third story is worse than no control.

**Book a call lost its rail link**, then the band itself. What is left is two
offers rather than four: the chat, for a question now, and done-for-you, for
work you would rather hand over.

What is left is the figures, the fourteen days behind them, the locks that
earned them, what the app has installed, and the rail. Main column 870px
against an 859px rail, which is the closest the two have ever been.

### What it replaced

The first version of this screen was a setup guide: a 75% ring, one open task,
three folded-away done ones, and the extension list under it. That is the right
screen for the week you install an app and the wrong one for every week after.
It never said whether the locks were doing anything.

So the page opens with the figures, and everything under them is a way out of
it. No work happens here; the lock list is still where locks are edited.

**Four numbers, and each one is a link.** *1,752 visitors stopped · 653 got
through (37%) · 12 access requests waiting · 64 items secured.* A number on a
home screen is a question about somewhere else, so every cell is an anchor
rather than a figure you then have to go and find. It is the same divided card
the lock list and the widget list use, not four cards with four borders.

**Fourteen days under them.** One bar per day: the full bar is everyone a lock
stopped, the filled part is how many got through. One bar rather than two,
because the question is a proportion — the same reason the lock list shows a
bar per row. Hovering a day gives the pair in words.

The bars deliberately have **no entry animation**. The height of a bar is the
data, and a tab that loads in the background has its animation timeline
paused — a grow-from-zero would leave the chart empty until somebody looked at
it. This was not theoretical; it is what the first version did.

A ranked **Busiest locks** list used to sit under the chart in the same card.
It came off: which locks earned the figures is the locks list's job, and the
sidebar is one click away.

**Everything in Airo** — six tiles, one per part of the app, each with where it
stands: *Locks 3 · 2 running now*, *Widgets 5 designs · 1 not in use*, *Access
requests 12*, *Subscription Pro · 3 of 20 locks used*, *Shopify Flow*, *Setup
guide*. This is the half of a home screen's job that the figures do not do: be
the shortest way to everywhere else.

**The plan count is said in two places on purpose** — once in the tile, as a
destination, and once in the rail with its meter, as a state. The rail card is
the only one that shows how much of the quota is gone.

**Done-for-you and Contact us stay.** *Would you rather we set it up for you?*
sits directly under the figures, where the call band used to be, and the
Crisp-style chat is what **Contact us** opens.

**The extensions check leads the page**, in the main column rather than the
rail: icon, what it does, state, and a way in. The one that is off carries a
mark down its left edge and the only primary button in the card, which is why
the setup guide could go — its single open task *was* that row.

It is first because of one row in it. The **theme app embed** is the switch
everything else depends on: with it off, every lock on the store is inert and
the fourteen days of figures below are history. So the card opens with the
answer rather than the status — *Your locks are running on your storefront*
in green, or *Your locks are not running* in red with the way to fix it —
and that line is read from the embed row's own badge, so the headline and the
row cannot disagree. The *n switched off* count in the title is counted from
the rows for the same reason.

**What the figures are:** invented, like every number in this folder. What
they would come from is not — see *Where the numbers would come from* below,
which applies to this page as much as to the list.

## The list says whether the locks are working

The lock list said what each lock *is* and nothing about whether it is doing
anything. A lock is a question put to visitors — how many were asked, and how
many got through — and that was the one thing the page could not answer.

**Each row carries its last 30 days:** how many visitors it stopped, how many
of them got through, and the proportion as a bar. *312 unlocked · of 1,284
visitors · 24%.* A bar rather than a second number, because the question is a
proportion: a lock letting 73% through is doing something different from one
letting 24% through, and the figures alone make you work that out. A lock that
has not run yet — scheduled, or inactive — says so instead of showing a zero,
which would read as "nobody got in".

**The stat row gains the store's total**, *653 unlocked of 1,752 visitors
stopped*, beside the counts that were already there.

**Room for the column came from merging Created and Last updated**, which were
two columns of the same kind of thing, each with its label underneath. One
Dates column carries both: the date it was last updated, with *Updated ·
created 14 Sept 2026* under it.

### Where the numbers would come from

The app already emits exactly these events. `extensions/` carries three Flow
triggers for them: **access attempted**, which fires on every evaluation
whether it passes or fails, and **access granted** and **access denied** for
the outcome. A merchant can already route them into a Flow automation; what
they cannot do is see them added up.

So this proposes storing what is already being emitted, not instrumenting
anything new. The counts, the dates and the percentages shown are invented,
like every other figure in this folder.

### One summary, not four cards

Four separate cards for four counts meant four borders, four shadows and three
gaps, all saying nothing, for one summary of one store. It is one card divided
four ways now — hairline rules between the cells, and the cells themselves
tighter: 32px icon tiles, a 21px figure, 13px of padding. The band went from
115px to 71, and the page leads with the table rather than with the furniture
above it.

`app.css` gives `.stat` its own border, radius and shadow, for the grid of
separate cards it was written for; inside one card those all come off, which
is a rule the page has to write because the component predates this use.

Below 1180px the sentence under each number goes: four cells across a card
that wide have room for the figure and what it counts, not for a line of
explanation each.

### Every row can be edited from the list

The row actions were Preview, Duplicate, Delete — three buttons, none of
which was the one you open a list to use. **Edit** is first now, linking
straight to `lock-builder.html?id=14`.

**Preview came off to make room**, and it was the right one to lose: the
lock’s name is already a link to its preview page, so the icon was a second
route to somewhere the row could already take you. A fourth icon also cost
40px, which pushed the table into a horizontal scrollbar at 1250px; without
it the widths are exactly what they were.

The lock list and the widget list now carry the same three actions, which they
did not before.

### The search box is its own size

It had taken whatever the row had left — 1,130px at a full-width window, which
says the row has nothing better to do with the space. It is capped at 420px.
Below 760px the three controls stop sharing a line: tabs and **Sort** keep the
first, the search box takes the second whole.

### The id sits beside the name

Three lines per lock — name, description, id — where the id is an identifier,
not a sentence. It reads `Wholesale catalogue #14` on one line with the
description under it, and the rows came down from 90px to 69.

### The toolbar was four controls that did nothing

Measured, before touching anything:

| Control | What it did |
| --- | --- |
| All / Active / Inactive | moved a class; the rows never changed |
| Search locks… | a `<div>` with placeholder text in it — not an input |
| the select-all checkbox | checked zero rows |
| the row checkboxes | had no action to be selected for |
| Sort | a button with no handler |

A screen full of controls that pretend is worse than a screen without them,
and the point of a proposal is to show what the screen does. So the tabs
filter, the search is an input and filters as you type, Sort really sorts —
recently updated, name, most activity, most items — and selecting rows swaps
the filter row for a bulk row: *2 selected · Activate · Deactivate · Delete ·
Clear*. Select-all goes indeterminate when only some are picked, and a filter
that matches nothing says so and offers its way out.

**Every figure above the table is the table counted**, so none of them can go
stale behind it. Delete *Members area* and the row of figures goes 2 → 1
active, 653 → 312 unlocked, *of 1,752 visitors* → *of 1,284*, 64 → 46 items,
and the plan meter 3 of 20 → 2 of 20 with its bar. Switch one lock off on its
own row and it moves from Active to Inactive and drops out of the Active tab.
Those sums are not decoration: 312 + 341 = 653 and 1,284 + 468 = 1,752 were
already true in the markup — nothing was keeping them true.

### The table reaches the end of its rows

On a phone the table is 895px inside a 322px card whose overflow is hidden, so
Status and Actions were not merely cramped — they were unreachable, and had
been before this column was added. The table has its own horizontal scroller, and keeps a 1,000px floor while it
is scrolling, so the columns stay readable instead of wrapping every cell into
three lines to avoid the scrollbar they are going to get anyway.

The threshold is 1200px of **window**, not of table: the frame is about 293px
narrower than the window, so a 1150px window leaves the table about 860 — less
than it needs. Keying the breakpoint to the window and forgetting the sidebar
is what made it squeeze and scroll at the same time.

## Creating a widget is a page, not a wizard

A widget was made in a three-step modal: name it, pick a kind, then — two
clicks in — the colours, which are the only part anyone opens this screen for.
It was also the last black panel in the folder.

It is the same one-page form the lock uses, for the same reason: a widget is a
handful of settings you opened on purpose, and editing one is a form you
opened to change a single colour in. `/widget/create` and
`/widget/{widget}/edit` are `widget-builder.html`.

**Three sections, in the order a widget reads:** what it is (name, language,
Form or Text), its colours, and its shape. The preview rides in the rail with
a running summary — *Kind · Palette · Used by* — and the save bar behaves the
way the lock page's does.

**Editing one says who else is relying on it.** A widget is shared, so a
fourth section lists the locks using this design and links to each, under a
line the page owes you before you touch a colour: *saving one here changes it
on every lock below*. Delete says the same thing in its own terms — the locks
fall back to the default look and keep working — and says it differently when
nothing is using it.

**The palette name is derived, not stored.** A saved widget is four colours;
whether they happen to be one of the six named palettes is something the page
works out on load, so the chip can never claim "Ocean Blue" over colours that
are not. Two of the three sample widgets come back as *Custom*; the third
matches **Minimal Light** exactly, and the page says so.

**The shell moved to `app.css` first.** The header row, the two-column
layout, the numbered section cards, the sticky rail, the destructive button
and the save bar were all written for the lock page; a second page using them
is the moment to share them rather than copy them. They are the "one page"
section now. The rail's summary rows scope their `.sum-k` / `.sum-v` under
`.osums`, because the black panel already defines both and is still using
them on the lock preview screen.

## The widget list shows its widgets

It is a list of designs that showed none of them. Every row said *Trade gate ·
Form · 2 locks* and left you to open each one to find out what it looks like —
which is the only question you come to this page with.

**Each row carries its colours**, in the order the editor applies them: text,
card, button, button text. Four swatches recognise a design faster than its
name does, and they are the same four the palette tiles show in the editor, so
the two agree. A white swatch on a white row needs an outline to exist at all,
so the chips carry one.

**Room came from the Type column.** The Form/Text tag moved beside the widget
name, the way the lock list carries *Scheduled 1 Nov* beside a lock's, and the
freed column shows the design. Seven columns before, seven after.

The rest is what the lock list got, for the same reasons: the black strip
across the top is the same light summary card divided three ways — **Form
widgets**, **Text widgets**, **Not in use**, each with a line saying what the
kind is for; the search box is capped at 420px instead of taking the row; the
filter row wraps below 760px; and the table has the same scroller with the
same 1200px threshold. Rows are 49px.

## Emphasis goes to what you might buy

The Pro card was carrying three things at once: most popular, current plan,
and the only black surface on the page. Inverting a card says *buy this* about
a plan the merchant is already on, and it forced the least legible control on
the screen — a grey slab reading "Current plan" inside a black card — along
with a strikethrough price and a billing line at `#6e6e6e` on `#1a1a1a`.

So the rule is now: **emphasis marks what you might buy; the plan you are on
is a state.** All three cards are white. The recommended one keeps its ribbon
and a firmer border; the current one is said with a 1.5px ring, a **Current
plan** badge, and a button that reports rather than offers — *Your current
plan*, quiet, not a dead black rectangle.

The three also line up along the bottom as well as the top. A row of cards at
three different heights reads as three unrelated things rather than one
choice.

**The usage strip was the same bug a third time** — "Locks used", "Renews",
"17 remaining" in dark-rail greys on black, after the lock list and the widget
list had both been fixed. It is the same light card they use: badge, plan
name, renewal date, one meter.

**The free tier joined the sentence it belongs to.** It was a separate band
underneath, saying *"free forever · no credit card required"* twice over. It
now reads *"Free — or stay on it"* and says the thing the page was not saying:
downgrading cancels the subscription straight away.

### One claim per card

Pro was carrying two at once: **MOST POPULAR** and **CURRENT PLAN** — a
ribbon, a ring and a warm wash, all on the card you are already paying for.
Recommending the plan someone has is the same mistake as inverting it.

The recommendation moved to **Unlimited** and took the surface with it: a mint
gradient, a mint border and a **BEST VALUE** ribbon. Pro keeps only the thing
that is true of it, which is that you are on it.

The two markers are now different **colours** as well as different shapes —
mint for the one being recommended, violet for the one you have. That is what
lets both sit in one row without either being read as the other, and it is why
the recommendation could not stay violet once the accent became the
current-thing colour.

**The ribbon says “Best value”, not “Best offer for you.”** A personalised
claim has to be computed, and this store is on Pro using 3 of 20 locks — for
which Unlimited is demonstrably not the best offer. The per-lock calculator is
the part of this page that does make a claim about *your* numbers, and it is
willing to point at a cheaper plan.

**Lighter throughout.** The trial bar was a solid block of the information
colour and the loudest thing on a page about prices; it is a tint with a
hairline now. Cards took a softer shadow, 2px more padding, a 16px radius and
looser feature lines, and the calculator’s right-hand panel stopped being a
grey slab beside white.

### The first plan is free, and the cards line up

**The free tier was a band under the grid** saying “or stay on it” — which
put the cheapest option after the three you pay for and made the row of cards
start at $9.99. It is the first card now: **Free**, $0, one lock, one widget,
passcode and sign-in rules, no card and no expiry. The $9.99 Basic tier it
replaces is gone, and the comparison table’s first column follows it.

**The recommended card sat 8px lower than the other two.** Its header row
carried `margin-top: 8px` to clear the ribbon — but the ribbon is absolutely
positioned at `top: -9px`, outside the card, and was never in the flow. The
margin pushed the price, the button and all five ticks out of line with the
cards either side. Measured after: the three buttons start at the same pixel.

### Paying for the locks you run

A tier is a bet about how many locks a store will have, and a store with
three pays what a store with twenty pays. **Pay per lock** is a second mode
on its own switch: $3 a month for each lock that is switched on, every Pro
feature at any count, and a stepper so you can put your own number in —
per-unit pricing you cannot calculate is just a smaller tier.

It also says when a plan would be cheaper, which is the thing a pricing page
is usually least willing to admit: at 11 locks it tells you Pro is $29.99 for
up to 20, and at 41 it points at Unlimited.

How you pay is a different question from how often, so it is a different
control — and the billing period steps aside in per-lock mode, because a
per-lock bill is monthly by definition.

**The $3 is invented, like every other figure here.** What is not invented is
that the app already counts the thing being billed: `max_locks` and the
`limitReached` flag exist because the plans are metering locks already.

### The billing toggle now bills

Monthly / Annual moved a black pill and left all three prices exactly where
they were. The one control on the page that promises a saving could not show
one — which also meant the page never said what a year actually costs.

Each price and each billing line carries both answers, so the toggle swaps
them: `$29.99 billed monthly` becomes `$24.90 billed yearly · $299 a year`.
The saving moved onto the control that produces it, as a `−17%` pill on
**Annually**, and Pro’s struck-through promo price hides on the yearly view
because it is a monthly offer.

**The trial is stated once, at the top**, instead of in three lots of small
print under three prices: *every paid plan starts with 7 days free, Shopify
only charges when it ends*. It is dismissible, and the small print under each
price is now just the billing period.

**Compare plans** opens a table under the cards. Three feature lists cannot be
read against each other — that means holding three columns in your head — and
a table is also where the facts that do not fit a tick live: 5 / 20 /
Unlimited locks, 2 / 20 / Unlimited widgets, which conditions each plan has.
Eleven rows, folded away so they do not bury the free tier.

**The recommended plan got a surface**, a warm wash in its ribbon’s own tone.
It had a ribbon and a firmer border; the plan you are *on* had a violet ring
and a badge. Two markers, one of them only an outline — now the recommendation
reads at a glance and still cannot be confused with the current plan, because
they are different colours.

### Reviews and the questions that come before paying

Under the cards, two things a pricing page is asked for and this one did not
have.

**What merchants say** — one card holding the rating on the left and three
quotes beside it, so the summary and the evidence are the same object rather
than a number floating above a carousel.

**The reviews are the shape of the section, not real ones.** The rating, the
count and the three quotes are invented. They are attributed to a kind of
store and a country — *Apparel wholesaler · United Kingdom* — and no business
is named, because a mockup should not put words in an identifiable merchant's
mouth. The real ones are on the App Store listing, which the heading links to.

**Before you choose** — six questions in two columns, with the answers in
place rather than behind a disclosure, because every answer is one or two
lines and hiding them would cost a click for nothing.

**Both headings moved inside their cards.** They used to float above the
content with the link 920px away at the other end, and the spacing was
broken: `.wrap920 { margin: 0 auto }` is a shorthand declared after `.mt20`
in the cascade, so it reset margin-top to **0** on both sections. Measured:
0px between the free-tier card and *What merchants say*, and 0px between the
reviews card and *Before you choose* — each heading sitting on the edge of
the card above it.

More margin would have patched that. A title row inside the card fixes it
instead: title left, link right, a rule under both. It is the shape every
other card in this folder already has, the spacing cannot be clobbered by a
shorthand again, and the title and the place it points to are one object
rather than two at opposite ends of the page.

**The links are no longer blue.** They were `.sm` anchors, so they picked up
`--link` (then Shopify’s `#005bd3`) and an underline — the only blue on the
page. They are now grey, unlined, and underline on hover; `--link` itself went
violet later, when the accent did.

**The rating sits on its own tinted panel** at the head of the row, so it
reads as the summary of the three quotes rather than a fourth one. Each quote
carries a single large quote mark in `#e3e3e3` above it, and the inline curly
quotes came out — the glyph and `&ldquo;` were both there, which is the same
punctuation twice. Attributions hang off the bottom of their cells over a
hairline, so the who-said-it lines agree across the row whatever length the
quote is.

**Between 901 and 1100px the rating takes a row of its own.** The band is the
window less about 326px of frame, so at a 1000px window the four columns left
the quotes 163px each and every one ran to six lines. With the rating across
the top, the three quotes share the full width — 224px each, three or four
lines. Below 900 they stack, and the rating becomes one row: *4.9 ★★★★★ 128
reviews*.

Every answer is something the app does today, and each was checked against the
source rather than written to sound right:

| Question | Where the answer comes from |
| --- | --- |
| Do I have to edit my theme? | The `access_controll` theme app embed, and `ThemeExtensionService::deepLink()` |
| How am I billed? | Shopify billing; the trial comes off the charge (`trial_days`, `trial_ends_on`) |
| What happens if I downgrade? | `max_locks` and the `limitReached` flag, which blocks creating rather than deletes |
| Will Google index a locked page? | The lock's **Hide from search engines** setting and its noindex copy |
| Can several locks share one design? | Widgets are designs; wording is per lock (`PopupTextModal.jsx`) |
| Does it work at checkout? | `airo-lock-checkout-block` and `airo-lock-checkout-validation`, Plus only |

The page fits the window at 1534×850 up to the free tier; the reviews and the
questions are below it, which is where someone who has not decided yet goes
looking.

## What the restyle changed

**The plan banner stopped shouting.** It was a three-stop violet gradient with
decorative circles and a coloured glow, then for a while a flat black panel.
It is now a white card like every other card on the page: a Pro badge, the
renewal date, one usage meter and **View plans**. The black version was quieter
than the gradient but still put dark-rail type on a dark surface, which nobody
could read; a card reads as a line of account state rather than an
advertisement inside the merchant's own admin.

**The dashboard said each number twice.** The banner carried "Locks used 3 of
20" and "Items secured 64" while the cards below carried "Total locks 3" and
"Items secured 64" again. The meter keeps the quota, the cards keep the counts
it does not give: **Active locks**, **Inactive locks**, **Items secured** —
and, since the list learned to report it, **Unlocked**.

**The counts lead with the number.** Each card puts the figure first, names
what it counts in words rather than a caps label, and adds a line saying what
the state means — *"Running on your storefront now"*, *"Saved, not enforcing
anything"*. The icon is tinted by meaning: green for running, plain grey for
paused, the accent for the total under protection, so the row reads before it is
read. Below 700px the explanatory line is dropped, since there is no width for
a sentence under a number.

**Plan CTAs are all the same weight.** A white "Select plan" beside a black one
tells the merchant which to pick before they have compared anything. The two
they can buy carry the same black button; the one they are on carries a quiet
state instead of a button at all.

### A hidden input stretched the page past the app frame

The lock page grew a second scrollbar: scrolling the window moved the whole
admin chrome up and left white under it. The document was 922px tall in an
850px window — 72px of overflow with nothing visible in it.

`.act input` is the real radio behind each action card, hidden with
`position: absolute; width: 1px; height: 1px`. `.act` had no `position`, so each
input’s containing block was the page itself rather than its own card: four of
them, sitting at their static positions a long way down a scrolling column,
added their offsets to the document’s scrollable height. `.seg-b` had always
set `position: relative` for exactly this reason; `.act` does now too.

The tell is worth remembering: an element you cannot see cannot add to a
scroll height unless it has escaped its container.

### Every screen with a parent says which one

Two pages carried a bare ← in a 28px square with no border and no word,
nudged 2px down so it landed between the title and the line under it rather
than on either. It read as a stray character to the left of the heading.

The one-page builders already answered this: a labelled link above the title,
sharing its left edge. Both pages moved onto it and `.page-back` is gone, so
four screens now use one pattern — `‹ Locks`, `‹ Widgets`, `‹ Dashboard`.
The arrow slides 2px left on hover, which a glyph could not do.

**Labelling it exposed a wrong link.** Widgets pointed “back” to Locks, which
is not where it came from: Widgets and Locks are siblings in the sidebar, and
the page above both is the dashboard. An unlabelled arrow can be wrong
indefinitely, because nobody can see what it claims.

## Things worth knowing when reading these

**The lock builder is not a wizard.** The file is called
`LockCreationFlow.jsx` and there is a `StepIndicator` component beside it, but
the screen that ships is a single page with an `InlineGrid` of `1fr / 340px`.
The step indicator is not used by it.

**Two design languages sit side by side.** They share no tokens, so Polaris
grey `#616161` appears next to Tailwind grey `#9ca3af`, and Polaris radii next
to hand-set 12px and 14px ones.

**Lock conditions are one flat group.** The builder renders `groups[0]` only,
with an AND/OR operator and a row per condition. The data model allows more
than one group; the UI does not offer it.

**Popup wording lives in a modal** opened from a button inside the Widgets card
in the right-hand column, rather than in a card of its own.

**Plan gating is shown in place.** Content types the current plan cannot use
still appear in the resource-type list with a plan badge; choosing one sends
the merchant to `/pricing` instead of selecting it.

## Accuracy

Every label, heading, badge and option is taken from the source: the condition
list, the stat-card copy, the plan taglines and feature lists, the onboarding
slide content. Only the **colours** differ from what ships — that is the point
of this folder. Store names, counts, dates and email addresses are invented,
as are the rating and the three quotes on the subscriptions page — which name
no business, for the reason given there.

The exceptions are flagged where they appear: `welcome.html` and the setup
flow are a redesign rather than a restyle, and `dashboard.html` is a screen the
app does not have yet. Everything each of them claims the app *does* is still
checked against the source.
