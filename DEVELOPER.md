# Airo Access Lock & Control — Developer Guide & Handover

This document is the handover for this codebase. It explains what the app does, how the
pieces fit, how to set it up from nothing, and how to run it in production. It assumes
Laravel familiarity but no prior exposure to this repo.

Read section 2 first — it gives a reading order. Section 14 lists the accounts and
credentials you must be handed before you can do anything.

---

## 1. What the product actually is

Airo Access Lock & Control lets a merchant restrict who can see or buy what in their store.
A merchant creates a **lock** (a named, optionally time-scheduled container), attaches one
or more **access rules** to it, and each rule binds a *resource* — a product, collection,
page, blog, the whole shop, or checkout — to a set of *conditions* a visitor must satisfy.

The conditions are things like: know a passcode, be signed in, hold a particular customer
tag, arrive from a secret link, verify their age, or be in an allowed country. A rule can
also do softer things than block outright: hide prices from guests, hide the add-to-cart
button, hide the resource from navigation and listings, or redirect elsewhere. Visitors who
fail can optionally submit a "request credentials" form that the merchant approves from the
admin.

What makes this app architecturally interesting is that enforcement happens in **four
different places**, because Shopify gives you no single hook that covers the storefront,
the cart and the checkout at once. Understanding those four places is most of
understanding the app — see section 4.

Production is <https://lock.airoapps.com>, Partner handle `acesslock-1`.

---

## 2. Where to start reading

1. **`app/Models/Lock.php`** and **`app/Models/AccessRule.php`** — the core domain. Note
   `Lock::isCurrentlyActive()` and the comment explaining why checkout scheduling is
   handled server-side but storefront scheduling client-side.
2. **`app/Services/MetafieldService.php`** — how rules get published to Shopify so the
   storefront can read them. Read the `transportError()` docblock; it explains a real bug
   class.
3. **`extensions/access-controll/assets/access_core.js`** and `access_validator.js` — the
   storefront enforcement that actually runs in the shopper's browser.
4. **`app/Http/Controllers/ProxyController.php`** — the live-rules App Proxy endpoint and,
   in its docblock, the single most important operational insight in this app (Shopify's
   uncacheable storefront HTML).
5. **`app/Http/Controllers/AccessLockcontroller.php`** — lock creation/configuration, and
   the checkout metafield write.
6. **`extensions/airo-lock-checkout-validation/src/run.js`** — the Plus-only hard block.
7. **`app/Services/BillingService.php`** — plan enforcement, which is entirely server-side.
8. **`routes/web.php`** — note the large `config('app.debug')`-gated debug block at the
   bottom; it is a useful map of the billing decision inputs.
9. **`extensions/access-controll/assets/access_i18n.js`** and `app/Services/PopupTextBaker.php`
   — the popup's language layer, resolved in two places for the reason given in section 18.

---

## 3. The stack

Laravel 12 on PHP 8.2+, with **`kyon147/laravel-shopify` v25** supplying the Shopify
integration. The package is installed as `kyon147/…` but every class it exposes still lives
in the `Osiset\ShopifyApp\` namespace — that is what the imports say. It owns OAuth, the
`verify.shopify` session-token middleware, the shop model contract, the App Proxy HMAC
middleware (`auth.proxy`), webhook registration and the `plans`/`charges` tables.

The frontend is **Inertia 2 + React 18 + Polaris 13** with **Tailwind 4**, built by
**Vite 7**. Unlike the sibling apps this one is configured for **SSR** (`resources/js/ssr.jsx`,
`npm run build:ssr`, `composer dev:ssr`) and has a real JS toolchain: ESLint 9, Prettier
with the Tailwind and organise-imports plugins, TypeScript for type-checking, and a
`node --test` suite under `tests/js/`. Notably `SHOPIFY_FRONTEND_TYPE` defaults to **SPA**
here, where the other Airo apps use MPA.

The internal ops panel is **Filament 3** at `/admin` behind the `admin` guard, with its
resources under `app/Filament/Admin/` rather than the more common `app/Filament/`.

Tests are **Pest 4** (plus PHPUnit-style feature tests) — `tests/Pest.php` exists, unlike
the other Airo apps which use plain PHPUnit.

This app does **not** run Octane; it is plain PHP-FPM behind nginx.

---

## 4. The four enforcement surfaces

This is the heart of the app. Each surface exists because the others cannot reach it.

### 4.1 The theme app embed (`extensions/access-controll`)

The primary storefront enforcement. `blocks/access_controll.liquid` targets `head` and
loads a set of focused ES modules from `assets/`: `access_core.js` (bootstrapping),
`access_validator.js` (condition evaluation), then per-surface modules `access_product.js`,
`access_collection.js`, `access_page.js`, `access_variants.js`, `access_price.js`, plus
`access_ui.js`, `access_a11y.js`, `access_events.js`, `access_i18n.js` (the popup's
translation catalog — section 18) and `access_debug.js`. Script order matters: they are
deferred, so they execute in document order, and `access_i18n.js` must load before
`access_validator.js` and `access_ui.js`, which resolve strings through it.

The critical operational fact: **Shopify ships app embeds deactivated by default after
install.** If the merchant never switches it on in Online Store → Themes → Customize → App
embeds, every lock they create silently does nothing, and they report "the app doesn't
work". `App\Services\ThemeExtensionService` exists solely to detect this — it inspects the
published theme's `settings_data.json` for a block type matching `/blocks/access_controll/`
(matching on that fragment rather than the full path, so it is independent of app handle
and extension UUID), caches the answer for 10 minutes, and builds a theme-editor deep link
that activates it in one save. `ExtensionNotice.jsx` / `GlobalExtensionNotice.jsx` surface
that in the admin, and `GET /extension/status` forces a fresh, uncached re-check.

### 4.2 Metafields (`app/Services/MetafieldService.php`)

Rules are published to Shopify as metafields so the storefront JS can read them from the
rendered page without a network round-trip. `SyncLockMetafieldsJob`,
`RemoveRuleMetafieldJob`, and the `metafields:resync` / `metafields:purge` artisan commands
manage that lifecycle.

Read `MetafieldService::transportError()`. The `gnikyt` Graph client reports HTTP 429/4xx/5xx
as `['errors' => true, …]` with **no** `body.errors` offset. Code that checked only
`body.errors` classified a throttled or failed write as a success and logged "set
successfully" having written nothing. That check is the fix; do not remove it, and follow
the same pattern in any new Shopify write.

### 4.3 The App Proxy (`app/Http/Controllers/ProxyController.php`)

Shopify rewrites `https://<shop>.myshopify.com/apps/airo-lock/<path>` to
`https://lock.airoapps.com/proxy/<path>` with a signed `signature` query parameter, which
the package's `auth.proxy` middleware verifies with constant-time HMAC-SHA256 and uses to
authenticate the shop.

The reason this endpoint exists is documented in the `rules()` docblock and is worth
internalising: **Shopify caches rendered storefront HTML — with metafield values baked in —
for anonymous visitors, offers no purge API, and can serve pre-save metafields for 30+
minutes.** That is why merchants used to have to toggle the app embed (a theme edit busts
the cache) to make a lock take effect. The storefront JS now calls `/proxy/rules` whenever
the rendered HTML is older than a few minutes, so enforcement no longer depends on
Shopify's cache at all. `/proxy/ping` is a health check, `/proxy/robots-disallow.txt`
keeps locked pages out of search indexes, and `/proxy/event` records access events.

### 4.4 Checkout (two extensions, Plus only for the hard block)

`extensions/airo-lock-checkout-block` is a React checkout UI extension rendering the
passcode field and banner. It **declares API version 2025-10 but is built with the 2025-07
React package**, and that mismatch is forced rather than careless:

- Shopify stopped accepting 2025-07 for checkout UI extensions. A deploy on it now fails
  validation outright (`"2025-07" is not a valid API version: Checkout ui requires one of
  ["2025-10", …]`), so the old pin became undeployable.
- `@shopify/ui-extensions-react` has still never shipped past its `2025-07` dist-tag
  (2025.7.4). Its only newer version, `2026.0.0`, carries **no** API-version tag and
  peer-pins an untagged `@shopify/ui-extensions@2025.8.0`, so it is not the 2026-01 React
  release. The non-React `@shopify/ui-extensions` does have 2025-10 / 2026-01 / 2026-04 /
  2026-07 tags — it is the React wrapper specifically that stopped.
- `@shopify/ui-extensions-react@2025.7.4` hard peer-pins `@shopify/ui-extensions@2025.7.4`,
  so the pair cannot be bumped independently.

Everything the extension imports (`reactExtension`, the buyer-identity and attribute hooks,
`Banner`/`BlockStack`/`Text`/`TextField`) is long-stable and unchanged across these
versions, so declaring the newer API version works in practice — but it IS a declared/built
mismatch, so re-test the checkout field after any bump. **The real fix is migrating off the
React wrapper to the Preact/web-component authoring model 2025-10+ expects**; until someone
does that, the `api_version` line is what keeps deploys working.

The extension also targets
`purchase.checkout.header.render-after` rather than `delivery-address`: the previous target
is absent on no-ship carts, which left the server-side Function hard-blocking passcode locks
with no input field to satisfy them. The extension declares the
`access_control/checkout_rule` metafield explicitly, because without that declaration
`useAppMetafields` receives nothing and the extension renders null. The Laravel side writes
that metafield in `AccessLockcontroller::updateCheckoutMetafield`.

`extensions/airo-lock-checkout-validation` is a Shopify **Function** (WASM, target
`cart.validations.generate.run`, API 2026-04) providing Plus-only hard enforcement. The
Function has **no reliable clock**, which is why scheduled checkout locks are activated
server-side: `ReconcileCheckoutSchedulesJob` runs every minute and writes the rule into the
metafield when `starts_at` arrives, and `ExpireLocksJob` removes it on expiry. Storefront
resource types instead carry `starts_at`/`expires_at` in their payload and gate client-side.

---

## 5. Shopify Flow integration

The app ships five Flow **triggers** and three Flow **actions**, each as its own extension
directory:

- Triggers: `access-attempted`, `access-granted`, `access-denied`, `request-submitted`,
  `request-approved`.
- Actions: `grant-access` (optionally time-limited), `revoke-access`, `tag-customer`.

`App\Services\FlowService` fires triggers via Shopify's `flowTriggerReceive` Admin API
mutation. The trigger handle constants in that class **must** match the `handle` in the
corresponding `extensions/airo-lock-flow-*/shopify.extension.toml` — that is a hard coupling
with no runtime check, so if you rename one, rename both.

Actions arrive as HMAC-signed POSTs to `/flow/action/{grant-access|revoke-access|tag-customer}`,
verified by `FlowController::verifyFlowSignature`. Time-limited grants are revoked later by
`RevokeFlowGrantJob`.

---

## 6. Routing, middleware and gating

`bootstrap/app.php` is short: it aliases `onboard` (`App\Http\Middleware\Onboard`) and
`plan.gate` (`App\Http\Middleware\EnsurePlan`), appends `HandleInertiaRequests` and the
preload-link middleware, and **disables CSRF for every route** — the usual embedded-app
compromise, since authentication comes from App Bridge session tokens.

Admin routes sit behind `verify.shopify` + `plan.gate` + `onboard`. Pricing routes are
deliberately outside the plan gate, because a shop without a plan is redirected there and
must be able to load it. Proxy routes are behind `auth.proxy`. Flow action callbacks verify
their own signature.

`routes/web.php` ends with a large block guarded by `if (config('app.debug'))` containing
email previews and half a dozen billing-diagnostic endpoints (`/debug/billing-info`,
`/debug/sync-store`, `/debug/force-test-mode-global`, …). These never load in production
because `APP_DEBUG` is false there. They are genuinely useful when diagnosing a wrong charge
type, since `/debug/billing-info` dumps every input to the test-charge decision at once.

---

## 7. Billing and plan enforcement

`App\Services\BillingService` is the single place plan rules are enforced, and enforcement
is **entirely server-side** — lock counts and per-feature checks (condition types, resource
types, scheduling, price hiding) are all validated before anything is written. The same
service builds the `billing` payload shared with every Inertia page, so the banners the
merchant sees always reflect what the backend will actually do.

`config/plans.php` is the feature catalogue: every gateable capability (`basic_locks`,
`passcode_access`, `secret_link`, `tag_access`, `email_access`, `age_verification`,
`geo_ip_rules`, `hide_prices`, `scheduling`, `variant_locks`, `store_lock`) mapped to a
merchant-facing label, plus per-tier defaults used when a `plans` row carries no explicit
`features` JSON.

`SHOPIFY_BILLING_ENABLED` defaults to false in `config/shopify-app.php` but is set true in
the production `.env`. Keep `SHOPIFY_BILLING_FREEMIUM_ENABLED=false` — the comment in
`.env.example` explains why: true would flag every new install as freemium and bypass the
plan gate permanently. Free access is granted per-shop from the admin panel instead.

`App\Services\ShopifyChargeHelper` decides test versus real charges, with dev and
partner-development stores getting test charges automatically.

**`App\Services\StoreStatusReconciler` is the most subtle piece here.** Shopify only
webhooks app *uninstalls*. A store that is CLOSED or FROZEN (unpaid Shopify bill) simply
goes silent — its token stops working, but the local `plan_id` and ACTIVE charge rows live
on, inflating MRR and the paying-shop count. Merchants also game this by installing on a
high tier and closing the store days later. The reconciler makes one probe query per shop
that answers both questions at once: the HTTP status classifies the store lifecycle, and
`currentAppInstallation.activeSubscriptions` is reconciled against local ACTIVE/ACCEPTED
charges, which also catches cancellation webhooks that never arrived. It runs daily at
06:45 via `stores:check-status`.

---

## 8. Background work

`routes/console.php` is where the scheduled work is declared, and this app has more of it
than its siblings:

- `ExpireLocksJob` — every minute. Deactivates locks past `expires_at`.
- `ReconcileCheckoutSchedulesJob` — every minute. Activates scheduled checkout locks at
  `starts_at`, because the checkout Function has no clock.
- `LockNotificationsJob` — every minute. Lock activation and expiring-soon emails.
- `mail:weekly-digest` — Mondays 08:00, opt-in only (no-op unless `MAIL_DIGESTS=true`).
- `billing:trial-reminders` — daily 09:00, once per trial, window in `config/plans.php`.
- `stores:check-status` — daily 06:45, the reconciler described above.

Catalogue sync lives in `app/Jobs/Products/` (`SyncStoreJob` orchestrating `SyncProductsJob`,
`SyncCollectionsJob`, `SyncPagesJob`, `SyncBlogsJob`, `SyncThemesJob`) with older top-level
duplicates of some of those still present. Shopify webhooks map to the usual per-topic job
classes.

`App\Services\ShopifyRetry` wraps Admin API calls in exponential backoff with jitter (4
attempts, 250 ms base, 4 s cap) for THROTTLED responses and HTTP 429, per Shopify's Built
for Shopify guidance. Use it for any new API call that could be rate-limited:
`ShopifyRetry::run(fn () => $shop->api()->graph($q, $vars))`.

**A queue worker and the scheduler are both mandatory.** Without the scheduler, locks never
expire and scheduled checkout locks never activate — which merchants experience as the app
being broken.

---

## 9. Data model

`locks` holds the container (name, handle, status, type, `starts_at`/`expires_at`,
`widget_id`, `text_widget_id`, `allow_email_request`, `seo_block`, plus notification
timestamps so reminder emails are sent once). `access_rules` holds the per-resource rules:
`resource_type` (a string since the 2026-05 migration, previously an enum), `handle`, a JSON
`conditions` array, a JSON `settings` blob, and the behavioural flags `protect_products`,
`hide_navigation`, `hide_lists`, `force_open`, `hide_price`, `hide_add_to_cart`.
`AccessRule::forResource()` is the lookup used everywhere.

`access_logs` records attempts. `products`, `variants`, `collections`, `pages`, `blogs`,
`themes` and `stores` mirror Shopify resources so the admin can offer pickers without live
API calls. `widgets` holds the merchant's styling presets, and its `configuration` JSON
carries the popup `language` block (section 18.5) alongside the design options. `onboardings` tracks setup
progress. `plans`, `charges`, `settings`, `store_details` cover billing and cached shop
metadata; `store_details` gained an `embed_status` column for the theme-embed detection, a
`store_status` column for the reconciler, and `primary_locale` / `shop_locales` /
`locales_synced_at` for the shop's published storefront languages.

---

## 10. The Filament admin panel

Every Airo app ships an internal operations panel built with **Filament**, and this one
runs **Filament 3** at **`/admin`**. It is staff-only and separate from the merchant-facing
embedded app.

### How authentication works here — and how it differs from the sibling apps

This app is the odd one out. It declares an **`admin` guard**, but that guard's provider is
**`users`**, not a separate `admins` table (`config/auth.php`). In other words there is no
`App\Models\Admin` class here: **an admin is a row in the same `users` table as the Shopify
shops, distinguished by an `is_admin` boolean** (added by the
`2026_05_13_074500_add_is_admin_to_users_table` migration).

That works because shops authenticate through App Bridge session tokens and never have a
usable password, so only rows you deliberately give a password to can log in through the
Filament form. But it does mean the shop model and the admin identity share a table — keep
that in mind when writing queries against `users`, and always scope on `is_admin` when you
mean "a member of staff".

`AdminPanelProvider::panel()` sets `->id('admin')`, `->path('admin')`,
`->authGuard('admin')` and `->login()`. Note that unlike the other Airo apps, this one
discovers its Filament classes from **`app/Filament/Admin/`** rather than `app/Filament/` —
resources in `app/Filament/Admin/Resources`, pages in `app/Filament/Admin/Pages`, widgets in
`app/Filament/Admin/Widgets`. If you scaffold a resource with the default generator it will
land in the wrong directory and silently not appear; move it.

### Creating an admin account

The seeder is `database/seeders/AdminSeeder.php`. It uses `updateOrCreate` keyed on email,
so **re-running it resets the password** — that is the intended recovery path if you are
locked out.

```bash
php artisan db:seed --class=AdminSeeder
```

The seeder hardcodes a default email and password. **Rotate it immediately after handover.**
To create a real account by hand:

```bash
php artisan tinker
>>> App\Models\User::updateOrCreate(
...   ['email' => 'you@airoapps.com'],
...   ['name' => 'Your Name',
...    'password' => Illuminate\Support\Facades\Hash::make('a-real-password'),
...    'is_admin' => true],
... );
```

Setting `is_admin => false` on a row is how you revoke staff access without deleting it.

### What is in the panel

Resources under `app/Filament/Admin/Resources` cover **Locks**, **Access Rules**,
**Access Logs**, **Users**, **Store Details**, **Charges** and **Plans**. There is a
dedicated **Billing Settings** page (`app/Filament/Admin/Pages/BillingSettings.php`) — this
is where the global test-charge mode lives and where per-shop free access is granted, which
is the panel feature you will use most. Widgets give an access-activity chart, a billing
stats overview, an installs chart, a general stats overview, and a deployment-info widget
backed by `App\Support\GitInfo`.

In support work, **Access Logs** is the screen that answers "why was this customer let in /
kept out", and **Store Details** now carries both the theme-embed status and the store
lifecycle status written by `StoreStatusReconciler` (section 7), so it is where you check
whether a "broken" store is actually closed or frozen.

### Adding to the panel

Generate the resource, then **move it into `app/Filament/Admin/`** and fix its namespace to
`App\Filament\Admin\Resources`. Discovery is automatic from there; there is no
registration step. `composer.json` runs `php artisan filament:upgrade` on
`post-autoload-dump`, so `composer install` keeps published Filament assets in step.

---

## 11. Frontend

`resources/js/pages/` holds `Dashboard`, `Addlock`, `LockConfigurePage`, `Onboarding`,
`Plans` and `RequestCode`. `resources/js/lib/` holds the pure logic that is shared with the
storefront and unit-tested in `tests/js/`: `lockItems.js`, `lockList.js`, `listValue.js`,
`bulkList.js`, `pairList.js`, `downloadFile.js`, `resourceTypes.js`.

That JS test suite (`npm run test:js`, plain `node --test`) covers `accessValidator`,
`checkoutValidation`, `listValue`, `bulkList`, `lockItems` and `lockList` — the
condition-evaluation logic that has to behave identically in the admin, the storefront
bundle and the checkout Function. If you change condition semantics, change it there and
keep all three in step.

### 11.1 Bulk lists (`multiplePasscodes`, `emailFromList`)

The two list-valued conditions are the ones merchants fill at scale — granting a couple of
hundred customers access one field at a time is not a workflow — so
`components/locks/PasscodeListField.jsx` has an **Add in bulk** modal that takes a pasted
blob or an uploaded `.csv`/`.txt`. `lib/bulkList.js` does the parsing: it splits on
newlines, commas, semicolons, tabs and the reserved backslash (`listValue.js` explains why
backslash is reserved), unwraps CSV quotes, drops blanks, de-dupes against what is already
in the list, and — for email lists — rejects anything that is not an address, so a pasted
`Customer email` header row lands in the "skipped" count rather than in the allow-list. The
modal previews those counts before anything is committed. Past ten entries the field grows
a search box and pages twenty at a time, because two hundred Polaris `TextField`s rendered
at once are neither fast nor navigable.

Both directions exist, and they are the same format: **Download CSV** in the field header
exports the whole list (not the current page or search), and **Download a template** in the
modal produces the same file with example rows, so a merchant can build the list in a
spreadsheet and upload it back. The file is one column — a `passcode` or `email` heading,
then one value per row, CRLF-terminated, led by a UTF-8 BOM so Excel does not fall back to
the local codepage. `parseBulkList` strips that BOM and drops a leading `HEADER_WORDS`
token, which is what makes the round trip work: an `email` heading fails the address check
on its own, but `passcode` is a perfectly valid passcode string and would otherwise be
imported as an entry. A heading word is only dropped when it is the FIRST value, so a
passcode further down that happens to read `code` survives.

One asymmetry to know: a value containing a comma is quoted correctly in the file but does
NOT survive re-upload, because commas are a separator on the way in. Such values can only
be created by typing into a single field by hand — bulk entry never produces one.

`lib/downloadFile.js` is the only download in the codebase. Shopify's app iframe permits
downloads, but an older admin or a browser setting can still refuse one silently, so
`downloadTextFile` returns a boolean and both callers fall back visibly — the export copies
the list to the clipboard, the template drops itself into the paste box.

### 11.1.1 How long access lasts (`locks.reprompt`)

Passing a lock writes a `granted` flag to `localStorage` under a key built by
`Utils.getCacheKey()` (resource + lock + a hash of the conditions + the customer), so a
customer who enters the passcode once is not asked again. That was hard-coded.
`locks.reprompt` now chooses where — or whether — that flag is kept:

| Value | Storage | Customer experience |
|---|---|---|
| `remember` (default) | `localStorage` | Unlocked until they clear site data |
| `session` | `sessionStorage` | Browses freely, asked again on a later visit |
| `always` | none | Asked again on every page load, including a refresh |

`grantStore()` in `access_core.js` is the single place this is decided; it returns `null`
for `always`, which makes both the read and the write no-ops without a special case at each
of the five call sites. **Unknown or missing values fall back to `localStorage`**, so locks
saved before this existed — and locks saved by a newer admin than the bundle on the store —
keep the behaviour they have always had. Site data that throws on access (private mode,
blocked cookies) is treated as "cannot remember" rather than failing the lock.

Switching a lock to `always` also ignores a flag an earlier setting left behind, so it takes
effect for customers who are *already* unlocked rather than only new ones.

The value rides in the metafield's `lock_settings` (both the per-rule payload and the
global config), so **this needs `shopify app deploy`** — the storefront is what caches the
grant, and no server change can make an old bundle forget one.

### 11.2 Paired credentials (`pairedCredentials`)

An email allow-list and a passcode list are two **independent** conditions: any listed
passcode opens the lock for any listed address. "This customer's own code" is a different
question, so it is its own condition type rather than a flag on the other two.

Storage reuses the same container — one newline-joined string — with one pair per line,
written `email,passcode`. The separator is the **first** comma, semicolon, tab or colon on
the line: an email address can contain none of them, so the left side is unambiguous and
everything after it belongs to the passcode (`a@x.com,VIP,24` is the code `VIP,24`). That
split is duplicated in four places and they must agree or a credential the merchant can see
in the admin silently fails to unlock: `parsePair()` in `lib/pairList.js`, `splitPair()` in
`access_validator.js`, `splitPair()` in both checkout extensions, and
`AccessRule::splitPair()`.

**It is the only condition that consumes two popup inputs.** Everything else takes exactly
one, and the validator used to assume that everywhere. `inputFieldsFor(type)` in
`access_validator.js` is now the single declaration of how many fields a condition needs and
what kind each one is; both `getPasscodeRequirements()` (field generation) and
`evaluateGroup()` (input consumption) read it, so they cannot drift apart and start reading
a passcode out of the email box. Requirements carry `field` (`email` | `passcode` | `dob`)
and the renderers draw the box from that instead of sniffing the type string — which is also
why the type is **not** named with "email" in it, since several call sites test for that
substring and would have drawn both fields as email boxes.

A merchant-typed label names the condition, so it applies to the first field only; the
second keeps its own translated default.

It is evaluable at checkout without any extra field — the address comes from buyer identity,
the code from the cart's access-code attribute — so it is in `CHECKOUT_CONDITION_TYPES`,
`EVALUABLE_TYPES` and `PASSCODE_TYPES`.

**Older extension bundles do not know this type**, and an unknown input type generates no
field, which leaves an input-less popup nobody can pass. A store must be on a bundle that
ships it before a merchant creates one — unlike the other conditions, there is no graceful
degradation here.

**Storage does not change.** A list is still ONE newline-joined string in the condition's
`value`, exactly as before — bulk entry is purely an input affordance. That matters because
the value is republished to the rule metafield and read by every storefront visitor;
`MAX_LIST_ITEMS` in `bulkList.js` caps a single condition at 1,000 entries to keep that
payload sane. Note the existing consequence: like every condition value, a passcode or
email list is **publicly readable** from the storefront metafield. It is an access
convenience, not a secret.

`emailFromList` itself is not new to the stack — the storefront validator, the checkout
Function, `PopupTextBaker` and `config/plans.php` (`email_access`) have always handled it;
it simply had no entry in the admin's `CONDITION_TYPES`, so no merchant could create one.
It is evaluable at checkout (see `EVALUABLE_TYPES` in `airo-lock-checkout-validation`), so
it is in `CHECKOUT_CONDITION_TYPES` too. `AccessRule::evaluateCondition()` gained
`emailFromList` and `passcodeFromList` branches and a `splitListValue()` that mirrors the
storefront's.

---

## 12. Setting the project up from nothing

You need PHP 8.2+, Composer, Node 20.19+ and a database.

```bash
git clone <repo> && cd "Airo lock"
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed          # admin user, plans
npm install
npm run build                # or: npm run build:ssr
```

`composer setup` bundles most of that; `composer dev` runs server + queue + Vite together,
and `composer dev:ssr` adds the Inertia SSR process.

Set `APP_URL` to exactly match the `application_url` in `shopify.app.toml` — it backs both
the OAuth redirect and the session-token JWT audience, and a mismatch presents as a blank
iframe with no error. Set `SHOPIFY_API_KEY`/`SHOPIFY_API_SECRET` from the Partner dashboard.

For the storefront and checkout work you also need the **Shopify CLI**: `shopify app dev`
tunnels the embedded admin, and `shopify app deploy` ships the extensions. Note that the
extensions are a **separate release channel** from the Laravel deploy — pushing to `main`
updates the server but does **not** update the theme extension, checkout block or checkout
Function that merchants' themes load from Shopify's CDN. Forgetting this is the classic
"I fixed it but nothing changed" trap in this repo.

Checkout enforcement (the Function) only hard-blocks on **Shopify Plus** stores, so you
need a Plus dev store to test it end to end.

---

## 13. Quality tooling

```bash
php artisan test          # Pest 4 + feature tests
npm run test:js           # node --test over tests/js/
npm run lint              # eslint --fix
npm run format            # prettier
npm run types             # tsc --noEmit
vendor/bin/pint           # PHP formatting
```

The PHP feature tests worth knowing: `AccessRuleMultiLockTest`, `GlobalLockListTest`
(asserts `hide_add_to_cart` and `rule_id` are included in the global lock list),
`LockResourceTypesTest`, `StoreStatusTest`, `GdprWebhookJobsTest`, `CrispSessionTest`, plus
`MetafieldServiceTest` as a unit test.

---

## 14. Access you need to be handed

- **GitHub** — write access to `najaf299/airolock`. The Airo apps are split across two
  GitHub accounts (`najaf299` and `najafali2961`); this one is on `najaf299`. A cloned
  working copy may carry an embedded personal access token in its git remote — replace it
  with SSH or your own credential helper rather than reusing it.
- **GitHub repo secret `DEPLOY_WEBHOOK_URL`** — the aaPanel deploy webhook including its
  access key.
- **Shopify Partner account** — access to `acesslock-1` (client ID
  `b1e2b0a22c97cc05cee44f76c16bd9c7`) for the API secret, scopes, App Proxy config, the
  extension registrations and the App Store listing. You need this to run
  `shopify app deploy` at all.
- **A Shopify Plus development store** — required to test checkout Function enforcement.
- **aaPanel / VPS** — SSH and panel login for `lock.airoapps.com`, to read deploy logs,
  restart queue workers, run the scheduler and edit `.env`.
- **The production `.env`** — the only place the Shopify API secret, database password,
  mail credentials and Redis password exist.
- **Filament admin login** for `/admin` (seeded by `AdminSeeder`; rotate after handover).
- **Crisp** — the support chat integration (`App\Support\CrispSession`).

---

## 15. Production runbook

**Deploying the server.** Push to `main`; `.github/workflows/deploy.yml` calls the aaPanel
webhook in the repo secret `DEPLOY_WEBHOOK_URL`. The hook runs `composer install` and the
npm build **synchronously**, which is why the workflow allows `--max-time 600`. `-k` accepts
the panel's self-signed certificate.

**Deploying the extensions is a separate step**: `shopify app deploy`. Nothing in CI does
this. Any change under `extensions/` requires it.

**`public/build` is intentionally committed** — read the comment in `.gitignore`. The VPS
runs Node 18 while Vite 7 needs Node 20.19+, so `vite build` fails on the server and the
frontend would never rebuild. Committing compiled assets makes the deploy's `git reset` ship
them directly. **This means you must run `npm run build` locally and commit the output as
part of any frontend change**, or your change will not reach production. Once the VPS is on
Node 20+, re-ignore the directory and remove this workaround.

**Common incidents.**
- *"Locks aren't working at all."* Check the theme app embed is activated —
  `GET /extension/status` gives the ground truth. This is the single most common support
  case.
- *"The lock takes 30 minutes to apply."* That is Shopify's storefront HTML cache; the
  `/proxy/rules` path exists to bypass it. Confirm the storefront JS is actually calling it.
- *"Locks never expire" / "scheduled locks never start."* The scheduler is not running.
- *"Checkout isn't blocked."* Only Plus stores get hard enforcement from the Function;
  everything else is the checkout UI extension, which is soft.
- *"A wrong charge type was created."* Enable `APP_DEBUG` on a non-production environment
  and hit `/debug/billing-info`, which dumps every input to the decision.
- *MRR looks wrong / closed stores still counted.* Run `stores:check-status` and read
  `StoreStatusReconciler`.

---

## 16. Known rough edges

- Several sync jobs exist twice: `app/Jobs/SyncProductsJob.php` and
  `app/Jobs/Products/SyncProductsJob.php` (same for blogs, collections, pages, themes). The
  `Products/` namespace is the current one; the top-level copies are legacy. Verify before
  deleting.
- `app/helper.php` and `app/Http/helper.php` both exist; only the latter is autoloaded via
  composer's `files`.
- There are two migrations dated `2026_01_13_000002` with different names — harmless, but
  it means migration order between them is filename-alphabetical, not intentional.
- `/logs` is unauthenticated in this app.
- The checkout block extension is pinned to an older API version than everything else, on
  purpose; do not "align" it without checking `@shopify/ui-extensions-react` releases first.
- `public/build` being committed means merge conflicts in built assets are routine; resolve
  by rebuilding rather than hand-merging.

---

## 17. Things that will surprise you

- The shop's myshopify domain lives in `users.name`. `$shop->shopify_domain` returns `null`
  silently; use `$shop->getDomain()->toNative()`.
- Package classes are `Osiset\ShopifyApp\…` despite the `kyon147/` vendor name.
- App embeds are **off by default** after install — this is the number one support issue.
- Shopify caches storefront HTML with metafields baked in and gives you no purge API.
- The checkout Function has no clock; scheduling is done server-side for checkout only.
- Extension deploys are separate from server deploys — and nothing in CI runs the Shopify
  CLI, so storefront JS only ships when a human does it.
- A popup with correct colours but English text means the store is on an old extension
  version (section 18.2).
- `settings.widget_json` is a snapshot, not a live read (section 18.4).
- `public/build` is committed on purpose.
- CSRF is globally disabled; authenticate properly instead.
- Frontend type is SPA here, MPA in the sibling apps.

---

## 18. Popup language (multi-language)

The lock popup renders in whatever language the merchant picks per widget. There are two
independent halves and you need to understand why both exist, because the second one is
what actually reaches merchants today.

### 18.1 The catalog

`extensions/access-controll/assets/access_i18n.js` is the single source of truth: 40 keys
across 22 locales (`en es fr de it pt nl sv da nb fi pl cs tr ru uk el ja ko zh-cn zh-tw
ar`). Every customer-facing string in the popup has a key — title, the auto-generated
condition messages, field labels, placeholders, buttons, the age hint, the access-denied
error, the hidden-price line.

Resolution order in `AccessI18n.t()`:

```
merchant override (exact locale -> language -> "default")
  -> built-in catalog (exact locale -> language)
  -> English -> the key itself
```

`ALIASES` maps what Shopify publishes onto what the catalog keys (`pt-BR` → `pt`,
`zh-Hant` → `zh-tw`, `no` → `nb`). RTL locales get `dir="rtl"`, mirrored label alignment
and a close button that flips side.

The file is a plain IIFE assigning to `globalThis`, deliberately: the admin imports it
(`resources/js/lib/widgetLanguages.js`) so the editor preview resolves strings through the
exact same code the storefront runs, and it must not explode under SSR where `window` is
undefined.

### 18.1.1 Per-lock wording (`locks.popup_text`)

The title, button and placeholders live on the WIDGET, which is shared by every lock
pointing at it — so wording one lock differently used to mean cloning the whole design.
`locks.popup_text` (JSON) holds per-lock overrides for `header`, `button`,
`passcode_label`, `passcode_placeholder`, `email_label` and `email_placeholder`; the
message line is `locks.description`, which already flowed to the rule `prompt`.
`AppServicesPopupTextOverrides` applies them, and the lock builder edits them all in one
card (`components/locks/PopupTextCard.jsx`).

**No storefront change was needed, and none is possible to need.**
`buildRuleMetafieldData()` resolves a fresh copy of the widget payload for *each rule* and
writes it into that rule's own metafield, so overwriting strings in that per-rule copy
affects only this lock — and the popup already reads those exact fields. Overrides therefore
work on every extension version, including ones already published.

**Order matters.** The overlay runs BEFORE `PopupTextBaker`, which only fills *blank*
fields. Applied first, an override looks like merchant-authored text and the baker leaves it
alone, which produces the precedence:

```
lock override  >  widget value  >  translated default
```

Reverse the two and every override is silently lost. The overlay also runs outside the
`isNoop()` guard, because a single-English store makes the baker a no-op but must still get
its overrides. A label typed on an individual condition is more specific than a lock-wide
one and beats it.

**Known gap:** `pairedCredentials` renders two fields from one condition and the popup
applies a condition's label to the FIRST of them, so that type takes `email_label` only —
its passcode box keeps the translated default. Reaching the second field needs a second
label on the condition, which the storefront would have to be taught to read (and therefore
a deploy).

An override is written verbatim for every visitor in every language — it is merchant wording,
so it is deliberately not translated. Leave a field blank to keep the translated default.

**Do not hand-edit any other copy of these strings.** `resources/lang/popup_translations.json`
is generated from this file — regenerate with `php artisan popup:build-translations` after
editing the catalog.

### 18.2 Why the text is also baked server-side

The storefront's translation layer only exists on stores running an extension version that
shipped it. Theme app extension assets live on Shopify's CDN and only update on
`shopify app deploy` — `git pull` + `npm run build` on the VPS does not touch them, and
nothing in CI runs the CLI. A store on an older extension therefore renders English no
matter what the metafield says, while still picking up widget colours, because the old code
reads `designOptions` fine and simply has no concept of `language`. That combination —
correct colours, English text — is the signature of this situation.

So the text is *also* resolved when the metafield is written, into fields the popup has
read since long before translations existed:

| Metafield field | Renders as |
|---|---|
| `designOptions.headerSettings.text` | title |
| `designOptions.layout.buttonText` | submit button |
| `designOptions.placeholderText` / `emailPlaceholderText` | input placeholders |
| `condition.label` | each generated field's label |
| rule `prompt` | description line |

`App\Services\PopupTranslator` is the PHP twin of `AccessI18n` (same lookup order, same
aliases). `App\Services\PopupTextBaker` decides what to write and is called from
`AccessLockcontroller::buildRuleMetafieldData()`.

Both language modes are honoured:

- **fixed** — one language for every visitor, so plain strings are written.
- **auto** — the visitor's own language wins, so locale-keyed objects are written
  (`{"default": "…", "fr": "…"}`), which `AccessUtils.localize()` has always resolved.
  The locale list comes from `store_details.shop_locales`.

**The `[object Object]` trap.** In auto mode a baked value is an *object*, so any code path
that interpolates one straight into HTML renders `[object Object]` — which is exactly what
a multi-language store used to show above the popup's input. The popup's own title, prompt,
button and placeholders were always resolved through `localize()`, but `condition.label`
reached the renderers raw: `getPasscodeRequirements()` copied it into `customLabel`, `label`
and `displayLabel` untouched, and `access_controll.js` prints `${req.label}` directly.

The fix resolves it **at the boundary** rather than at each render site:
`access_validator.js` has a `resolveText()` that runs `sub.label` through `localize()` while
building requirements, so `customLabel` / `label` / `displayLabel` are always plain strings
and every consumer — the two renderers in `access_ui.js`, the fallback builder in
`access_core.js`, the legacy monolith, anything added later — is safe by construction. The
renderers were hardened too, so a stale requirement object from an older bundle still cannot
leak one through.

That also fixes a quieter bug: `label` doubles as the grouping key for field numbering, and
an object stringifies to one shared `"[object Object]"` bucket, so two email fields on a
multi-language store were counted as if they were the same field.

If you add a new bakeable field, resolve it through `localize()` (or `resolveText()`) at the
point it enters the requirement/settings object — never assume the renderer will do it.

Anything the merchant typed themselves is never overwritten — their wording outranks a
translation, in both halves.

**Known gap:** for text-only locks (no passcode/email input) the old storefront code calls
its own English `generateConditionMessage()` and ignores the stored prompt, so baking
cannot reach it. That case only becomes correct once the extension is deployed.

### 18.3 Store languages

`App\Services\ShopLocaleService` reads `shopLocales` from the Admin API and caches it on
`store_details` (`primary_locale`, `shop_locales`, `locales_synced_at`). The widget editor
offers exactly those languages instead of asking merchants to remember locale codes;
`POST /widgets/refresh-locales` re-pulls after they add one in Shopify admin.

If a shop publishes only English and the widget is on **auto**, no visitor can ever be
browsing in another language — the editor warns about this rather than silently doing
nothing. Pinning with **fixed** is the way to force a language on a single-language store.

### 18.4 The stale-snapshot trap

`settings.widget_json` on a rule is a *snapshot*, rewritten only when the widget is saved.
`buildRuleMetafieldData()` used to prefer that snapshot and look the widget up only when it
was missing entirely, so a snapshot captured before a field existed got republished forever
— editing the widget changed nothing on the storefront. It now always reads the `widgets`
row and falls back to the snapshot only for a deleted widget. Keep it that way.

Related: the metafield writers must not inject an English prompt when a rule has none.
`AccessLockcontroller::merchantPrompt()` returns `null` for an unset prompt and for the two
known auto-generated English defaults, so the translated default can take over.

### 18.5 Widget config shape

```json
"language": {
  "mode": "auto" | "fixed",
  "locale": "zh-TW",
  "translations": { "fr": { "button.submit": "Envoyer" } }
}
```

`translations` is no longer editable in the admin — the per-language wording editor was
removed — but it is still read by both halves, so anything saved previously still applies.

### 18.6 Tests

`tests/js/accessValidator.test.mjs` covers the locale fallback chain, aliases, merchant
overrides, pinned locales, numbered field labels across languages, and the full metafield
payload shape. Run with `npm run test:js`.
