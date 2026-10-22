/**
 * Access Control Core
 * Entry Point
 */

window.AccessCore = (function () {
    // Dependencies
    const Utils = window.AccessUtils;
    const Validator = window.AccessValidator;
    const UI = window.AccessUI;

    // Country name to ISO code mapping
    const COUNTRY_NAME_TO_CODE = {
        'Afghanistan': 'AF',
        'Albania': 'AL',
        'Algeria': 'DZ',
        'Argentina': 'AR',
        'Australia': 'AU',
        'Austria': 'AT',
        'Bangladesh': 'BD',
        'Belgium': 'BE',
        'Brazil': 'BR',
        'Canada': 'CA',
        'China': 'CN',
        'Denmark': 'DK',
        'Egypt': 'EG',
        'Finland': 'FI',
        'France': 'FR',
        'Germany': 'DE',
        'Greece': 'GR',
        'India': 'IN',
        'Indonesia': 'ID',
        'Iran': 'IR',
        'Iraq': 'IQ',
        'Ireland': 'IE',
        'Italy': 'IT',
        'Japan': 'JP',
        'Malaysia': 'MY',
        'Mexico': 'MX',
        'Netherlands': 'NL',
        'New Zealand': 'NZ',
        'Nigeria': 'NG',
        'Norway': 'NO',
        'Pakistan': 'PK',
        'Philippines': 'PH',
        'Poland': 'PL',
        'Portugal': 'PT',
        'Russia': 'RU',
        'Saudi Arabia': 'SA',
        'Singapore': 'SG',
        'South Africa': 'ZA',
        'South Korea': 'KR',
        'Spain': 'ES',
        'Sweden': 'SE',
        'Switzerland': 'CH',
        'Thailand': 'TH',
        'Turkey': 'TR',
        'United Arab Emirates': 'AE',
        'United Kingdom': 'GB',
        'United States': 'US',
        'Vietnam': 'VN',
    };

    // AbortSignal.timeout with a fallback for older browsers.
    function timeoutSignal(ms) {
        try {
            if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) return AbortSignal.timeout(ms);
            const ctrl = new AbortController();
            setTimeout(() => ctrl.abort(), ms);
            return ctrl.signal;
        } catch {
            return undefined;
        }
    }

    // Does any condition actually need the third-party geo lookup?
    function conditionsNeedGeo(conditions) {
        try {
            return (Array.isArray(conditions) ? conditions : []).some((g) =>
                ((g && g.conditions) || [g]).some((c) => c && (c.type === 'location' || c.type === 'ip'))
            );
        } catch {
            return false;
        }
    }

    // Detect IP and Location using external APIs
    async function detectIPAndLocation() {
        try {
            // Step 1: Get IP from Cloudflare. Hard timeout: this used to block
            // ALL enforcement with no limit while the pre-paint gate lifts at
            // 2.5s — a blackholed request meant the lock never ran at all.
            const cfRes = await fetch("https://www.cloudflare.com/cdn-cgi/trace", { signal: timeoutSignal(2000) });
            const text = await cfRes.text();
            const ip = text.match(/ip=(.+)/)?.[1]?.trim();

            if (!ip) {
                return { ip: null, country: null, countryCode: null, city: null, region: null };
            }

            // Step 2: Get location from GeoJS (CORS allowed)
            const geoRes = await fetch(`https://get.geojs.io/v1/ip/geo/${ip}.json`, { signal: timeoutSignal(2000) });
            const data = await geoRes.json();

            // Convert country name to country code
            const countryName = data.country || null;
            const countryCode = countryName ? (COUNTRY_NAME_TO_CODE[countryName] || data.country_code || countryName) : null;


            return {
                ip: ip,
                country: countryCode, // Use country code for matching
                countryName: countryName, // Keep name for display
                city: data.city || null,
                region: data.region || null
            };
        } catch (error) {
            return { ip: null, country: null, countryCode: null, city: null, region: null };
        }
    }

    async function init() {
        const initEl = document.getElementById('access-control-init');
        if (!initEl) return;

        const type = initEl.dataset.type;
        const handle = initEl.dataset.handle;
        let globalConfigStr = initEl.dataset.globalConfig || '{}';
        let localRuleStr = initEl.dataset.localRule || 'null';
        // True when the injected rule is a collection lock inherited by this
        // product page (the product belongs to a collection locked with
        // "protect products"). Lets a collection-typed lock match here.
        const inheritedCollection = initEl.dataset.inheritedCollection === 'true';

        // Stale-HTML recovery: Shopify caches rendered pages (metafield values
        // included) for anonymous visitors with no purge on metafield writes —
        // merchants used to toggle the app embed (a theme edit) just to bust
        // it. When this HTML was rendered more than 5 minutes ago (or predates
        // data-rendered-at), fetch the live rules through the app proxy and
        // use those instead. On any failure we fall back to the rendered data.
        const renderedAt = parseInt(initEl.dataset.renderedAt || '0', 10);
        const htmlAgeSeconds = renderedAt > 0 ? (Date.now() / 1000) - renderedAt : Infinity;
        if (htmlAgeSeconds > 300) {
            try {
                const proxyType = ['product', 'collection', 'page', 'blog'].includes(type) ? type : 'shop';
                const res = await fetch(
                    '/apps/airo-lock/rules?type=' + encodeURIComponent(proxyType) + '&handle=' + encodeURIComponent(handle || ''),
                    { signal: timeoutSignal(2000) }
                );
                if (res.ok) {
                    const fresh = await res.json();
                    if (fresh && fresh.local && Array.isArray(fresh.local.locks)) {
                        if (fresh.local.locks.length) {
                            localRuleStr = JSON.stringify(fresh.local);
                        } else if (!inheritedCollection) {
                            // Empty response + inherited rule: the rule baked
                            // into the HTML belongs to a COLLECTION (protect
                            // products cascade), which a product-keyed proxy
                            // lookup can't see — keep the rendered rule rather
                            // than unlocking a protected product.
                            localRuleStr = 'null';
                        }
                        globalConfigStr = JSON.stringify(fresh.global || {});
                        // Re-run the site-wide hide pass with the fresh config.
                        try { hideLockedResources(fresh.global || null); } catch { /* ignore */ }
                    }
                }
            } catch (e) {
            }
        }

        let lockData = null;

        // 1. Try Local Rule (Metafield First)
        try {
            let localRule = JSON.parse(localRuleStr);
            if (localRule && typeof localRule.value === 'string') {
                try {
                    localRule = JSON.parse(localRule.value);
                } catch {
                    localRule = null;
                }
            }
            if (localRule && Array.isArray(localRule.locks)) {
                const locksArr = localRule.locks.filter((l) => l && l.enabled);
                const pickBest = (arr) => {
                    let best = null;
                    let bestScore = -1;
                    arr.forEach((item, idx) => {
                        const s = item && item.settings ? item.settings : {};
                        let score = 0;
                        if (s.widget_json) score += 5;
                        if (item.widget) score += 3;
                        if (typeof item.lock_id !== 'undefined') score += 2;
                        if ((s && s.requires_input === true) || (item.lock_settings && item.lock_settings.requires_input === true)) score += 1;
                        // Prefer later entries on tie (assume appended = latest)
                        score = score * 10 + idx;
                        if (score >= bestScore) {
                            best = item;
                            bestScore = score;
                        }
                    });
                    return best;
                };
                const shopCandidates = locksArr.filter((l) => l.target_type === 'shop' || l.resource_type === 'shop');
                const typeCandidates = locksArr.filter((l) => (l.target_type === type || l.resource_type === type));
                // Inherited: on a product page, a collection lock with
                // protect_products applies to every product in that collection.
                const inheritedCandidates = inheritedCollection
                    ? locksArr.filter((l) =>
                        (l.target_type === 'collection' || l.resource_type === 'collection') &&
                        l.settings && l.settings.protect_products)
                    : [];
                // Legacy fallback: older metafields don't carry target_type/resource_type.
                // Since the metafield is attached to this specific resource, any unlabelled
                // lock found here implicitly applies to it.
                const untaggedCandidates = locksArr.filter((l) => !l.target_type && !l.resource_type);

                const matchedLock = (shopCandidates.length && pickBest(shopCandidates)) ||
                    (typeCandidates.length && pickBest(typeCandidates)) ||
                    (inheritedCandidates.length && pickBest(inheritedCandidates)) ||
                    (untaggedCandidates.length && pickBest(untaggedCandidates));

                if (matchedLock) {
                    const ls = matchedLock.lock_settings || {};
                    const s = matchedLock.settings || {};
                    localRule = {
                        rule_id: matchedLock.lock_id || matchedLock.rule_id,
                        enabled: matchedLock.enabled !== false,
                        // Conditions exist in multiple shapes; prefer lock_settings, then settings, then top-level
                        conditions: (ls.conditions) || (s.conditions) || matchedLock.conditions || [],
                        // Prompt and misc flags may be in lock_settings or top-level
                        prompt: ls.prompt || matchedLock.prompt,
                        widget: matchedLock.widget || s.widget_json || null,
                        text_widget: matchedLock.text_widget || s.text_widget_json || null,
                        settings: ls && Object.keys(ls).length ? ls : (s || {}),
                        redirect_url: ls.redirect_url || matchedLock.redirect_url || null,
                        resource_type: matchedLock.target_type || type,
                        hide_price: (ls.hide_price !== undefined ? ls.hide_price : (matchedLock.hide_price !== undefined ? matchedLock.hide_price : s.hide_price)),
                        hide_add_to_cart: (ls.hide_add_to_cart !== undefined ? ls.hide_add_to_cart : (matchedLock.hide_add_to_cart !== undefined ? matchedLock.hide_add_to_cart : s.hide_add_to_cart)),
                        price_message: ls.price_message || matchedLock.price_message || s.price_message,
                        allow_email_request: (ls.allow_email_request !== undefined ? ls.allow_email_request : (matchedLock.allow_email_request !== undefined ? matchedLock.allow_email_request : s.allow_email_request)),
                        starts_at: matchedLock.starts_at || ls.starts_at || s.starts_at || null,
                        expires_at: matchedLock.expires_at || ls.expires_at || s.expires_at || null,
                        scope: matchedLock.scope || ls.scope || s.scope || 'product',
                        variant_ids: matchedLock.variant_ids || ls.variant_ids || s.variant_ids || [],
                        locked_variant_display: matchedLock.locked_variant_display || ls.locked_variant_display || s.locked_variant_display || 'hide',
                        all_variants_locked_behavior: matchedLock.all_variants_locked_behavior || ls.all_variants_locked_behavior || s.all_variants_locked_behavior || 'hide_product',
                    };
                }
            }

            // Special handling for Shop/Store lock
            const isShopLock = type === 'shop' || (localRule && localRule.resource_type === 'shop');

            if (localRule && (localRule.enabled || isShopLock)) {
                lockData = {
                    lock_id: localRule.rule_id,
                    enabled: localRule.enabled !== false, // Default to true if undefined for shop lock
                    conditions: localRule.conditions || [],
                    prompt: localRule.prompt || null,
                    resource_type: isShopLock ? 'shop' : type,
                    widget: localRule.widget || (localRule.settings && localRule.settings.widget_json) || null,
                    text_widget: localRule.text_widget || (localRule.settings && localRule.settings.text_widget_json) || null,
                    lock_settings: {
                        ...localRule.settings, // protect_products, etc
                        prompt: localRule.prompt,
                        hide_price: localRule.hide_price,
                        hide_add_to_cart: localRule.hide_add_to_cart || (localRule.settings && localRule.settings.hide_add_to_cart),
                        price_message: localRule.price_message,
                        allow_email_request: localRule.allow_email_request || (localRule.settings && localRule.settings.allow_email_request),
                        scope: localRule.scope,
                        variant_ids: localRule.variant_ids,
                        locked_variant_display: localRule.locked_variant_display,
                        all_variants_locked_behavior: localRule.all_variants_locked_behavior,
                    },
                    redirect_url: localRule.redirect_url,
                    starts_at: localRule.starts_at,
                    expires_at: localRule.expires_at,
                    scope: localRule.scope,
                    variant_ids: localRule.variant_ids,
                    locked_variant_display: localRule.locked_variant_display,
                    all_variants_locked_behavior: localRule.all_variants_locked_behavior,
                };
            }
        } catch (e) {
        }

        // 2. Fallback to Global Config if no local rule found
        if (!lockData) {
            let config = {};
            try {
                config = JSON.parse(globalConfigStr);
            } catch {
            }

            const locks = config.locks || [];

            // Find relevant lock
            // Priority: 1. Shop/Store Lock (Global) 2. Specific Resource Lock
            const shopLock = locks.find((l) => l.target_type === 'shop');
            const resourceLock = locks.find((l) => l.target_type === type && (l.target_handle === handle || l.target_handle === null));

            const lock = shopLock || resourceLock;

            if (lock) {
                lockData = {
                    lock_id: lock.lock_id,
                    enabled: true,
                    conditions: lock.lock_settings.conditions,
                    prompt: lock.lock_settings.prompt,
                    widget: lock.widget || (lock.lock_settings && lock.lock_settings.widget_json) || null,
                    text_widget: lock.text_widget || (lock.lock_settings && lock.lock_settings.text_widget_json) || null,
                    lock_settings: lock.lock_settings,
                    redirect_url: lock.lock_settings.redirect_url,
                    starts_at: lock.starts_at || lock.lock_settings.starts_at || null,
                    expires_at: lock.expires_at || lock.lock_settings.expires_at || null,
                };
            }
        }

        if (!lockData) {
            UI.showContent(); // Ensure content visible
            return;
        }

        // Schedule window: if starts_at is in the future or expires_at is in the past,
        // treat the lock as inactive and reveal content.
        const nowMs = Date.now();
        const startsMs = lockData.starts_at ? Date.parse(lockData.starts_at) : null;
        const expiresMs = lockData.expires_at ? Date.parse(lockData.expires_at) : null;
        if (startsMs && !Number.isNaN(startsMs) && nowMs < startsMs) {
            UI.showContent();
            return;
        }
        if (expiresMs && !Number.isNaN(expiresMs) && nowMs >= expiresMs) {
            UI.showContent();
            return;
        }


        // Geo lookup only when a condition needs it — this used to run
        // unconditionally BEFORE any lock decision, so two third-party fetches
        // (with no timeout) gated every page while the pre-paint gate lifted
        // at 2.5s, leaving locked content visible whenever they were slow.
        let detectedLocation = { ip: null, country: null, countryName: null, city: null, region: null };
        if (conditionsNeedGeo(lockData.conditions)) {
            detectedLocation = await detectIPAndLocation();
        }

        // Context Data
        const context = {
            type,
            handle,
            shop: initEl.dataset.shop,
            loggedIn: initEl.dataset.customerLoggedIn === 'true',
            customerId: initEl.dataset.customerId || '',
            customerEmail: initEl.dataset.customerEmail || '',
            customerTags: initEl.dataset.customerTags ? initEl.dataset.customerTags.split(',') : [],
            // Use detected location if available, fallback to Shopify's localization
            customerCountry: detectedLocation.country || initEl.dataset.customerCountry || '',
            customerIP: detectedLocation.ip || '',
            customerCity: detectedLocation.city || '',
            customerRegion: detectedLocation.region || '',
            locked: true, // It is in the list
            lockData: lockData,
        };

        checkAccess(context);
    }

    /**
     * Where a lock's "this visitor is in" flag may be kept, per the merchant's
     * `reprompt` setting on the lock:
     *
     *   remember (default) — localStorage: unlocked until they clear site data
     *   session            — sessionStorage: re-asked on a new visit, not while browsing
     *   always             — nowhere: re-asked on every page load
     *
     * Returns null for 'always', which is what makes both the read and the
     * write no-ops without a special case at each of the four call sites.
     *
     * Unknown or missing values fall back to localStorage, so a lock saved
     * before this setting existed — or by a newer admin this bundle does not
     * understand — keeps the behaviour it has always had.
     */
    function grantStore(data) {
        const settings = (data && data.lockData && (data.lockData.lock_settings || data.lockData.settings)) || {};
        const mode = settings.reprompt;

        try {
            if (mode === 'always') return null;
            if (mode === 'session') return window.sessionStorage;

            return window.localStorage;
        } catch {
            // Private mode and blocked site data both throw on access, not on
            // use — treat that as "cannot remember" rather than failing the lock.
            return null;
        }
    }

    /** Read the grant flag, honouring the lock's reprompt setting. */
    function readGrant(data, key) {
        const store = grantStore(data);
        try {
            return store ? store.getItem(key) : null;
        } catch {
            return null;
        }
    }

    /** Remember a grant, unless the lock is set to ask every time. */
    function writeGrant(data, key) {
        const store = grantStore(data);
        try {
            if (store) store.setItem(key, 'granted');
        } catch {
            /* nothing we can do; the visitor is simply asked again */
        }
    }

    function checkAccess(data) {
        const cacheKey = Utils.getCacheKey({
            type: data.type,
            handle: data.handle,
            lockId: data.lockData.lock_id,
            lockData: data.lockData, // Include lockData for conditions hash
            customerKey: data.customerId || 'guest',
        });

        // Cached grants exist so a customer who once entered a passcode isn't
        // re-prompted on every page view. A lock with NO input conditions
        // (signedIn / tag / location / ip / secret link) re-evaluates for free,
        // so for those we skip the cache in both directions — otherwise the
        // grant outlives the state that earned it (logout, tag removed, VPN
        // off) and the lock looks broken when merchants test re-locking.
        const inputTypesForCache = (Validator && Validator.INPUT_TYPES) || [];
        const lockNeedsInput = (Array.isArray(data.lockData.conditions) ? data.lockData.conditions : [])
            .some((g) => ((g && g.conditions) || []).some((c) => c && inputTypesForCache.includes(c.type)));

        // 1. Check Cache
        if (lockNeedsInput && readGrant(data, cacheKey) === 'granted') {
            UI.showContent();
            if (window.AccessEvents) window.AccessEvents.granted(data);
            return;
        }

        // 1.5 Variant-scope rules (5.4): page stays visible, only the locked
        // variant options are hidden/disabled. Customer who passes the rule
        // sees all variants; customer who fails sees only non-locked variants.
        const scopeForVariant = data.lockData.scope
            || (data.lockData.lock_settings && data.lockData.lock_settings.scope);
        if (scopeForVariant === 'variant' && data.type === 'product') {
            UI.showContent();
            const customerData = {
                loggedIn: data.loggedIn,
                tags: data.customerTags,
                email: data.customerEmail,
                country: data.customerCountry,
                ip_address: data.customerIP,
            };
            const passesForVariant = Validator.evaluateConditionsWithInputs(
                data.lockData.conditions, customerData, []
            );
            if (!passesForVariant && window.AccessVariants) {
                window.AccessVariants.apply(data.lockData, { locked: true, customerData });
            }
            return;
        }

        // 2. Hide Price Rule
        const settings = data.lockData.lock_settings || {};
        if (settings.hide_price) {
            UI.showContent();
            UI.hidePrice(settings.price_message); // Apply hide logic
            return;
        }

        // 3. Auto-Validation (Tags, LoggedIn, etc)
        // If conditions met without input, grant access.

        const customerData = {
            loggedIn: data.loggedIn,
            tags: data.customerTags,
            email: data.customerEmail,
            country: data.customerCountry,
            ip_address: data.customerIP,
            city: data.customerCity,
            region: data.customerRegion,
        };

        if (Validator.evaluateConditionsWithInputs(data.lockData.conditions, customerData, [])) {
            // Empty inputs
            if (lockNeedsInput) writeGrant(data, cacheKey);
            UI.showContent();
            if (window.AccessEvents) window.AccessEvents.granted(data);
            return;
        }

        // 3.4 Hide completely — an ineligible visitor should see no trace of this
        // resource. The pre-paint gate already hid the body; send them away so the
        // page behaves as if it doesn't exist. (Eligible visitors returned above.)
        if (settings.hide_completely) {
            if (window.AccessEvents) window.AccessEvents.denied(data, 'hidden');
            const dest = data.lockData.redirect_url || '/';
            try {
                window.location.replace(dest);
            } catch {
                window.location.href = dest;
            }
            return;
        }

        // 3.5 Hide Add to Cart mode — page visible, only button hidden
        if (settings.hide_add_to_cart) {
            UI.showContent();
            window.__accessCartManagedByLock = true;

            // Hide Add to Cart buttons with observer for dynamically loaded ones
            const addToCartSelectors = [
                'form[action="/cart/add"]', 'form[action*="/cart/add"]',
                'button[name="add"]', '.product-form__submit', '.add-to-cart',
                '#AddToCart', '.shopify-payment-button', '.sticky-add-to-cart',
                '.product-sticky-form', '[data-section-type="sticky-cart"]',
                '.cart-notification', '.quick-add-modal', '.quick-add__submit',
                '.product-form__cart-submit', 'buy-it-now-button', '.shopify-payment-button__button',
                // Horizon-family themes (2025+) render buy UI as custom elements:
                // the Buy-it-now wallet row is <shopify-accelerated-checkout>, and
                // card quick-add lives in <quick-add-component> (inline form for
                // single-variant products, dialog opener otherwise).
                'shopify-accelerated-checkout', 'quick-add-component', 'add-to-cart-component',
            ];
            const doHide = () => {
                addToCartSelectors.forEach((sel) => {
                    document.querySelectorAll(sel).forEach((el) => {
                        if (el.classList && el.classList.contains('access-unlock-purchase-btn')) return;
                        if (el.closest('#access-unlock-modal')) return;
                        if (el.dataset.accessHidden === 'true') return;
                        el.dataset.accessHidden = 'true';
                        el.dataset.originalDisplay = el.style.display;
                        el.style.display = 'none';
                    });
                });
            };
            // Hiding only the cart button leaves the Size/Color picker live, so the
            // shopper can still flip variants and the lock reads as half-applied.
            // Lock the variant selector too: dim + disable it, then restore on
            // unlock. We dim the outermost matching container per subtree so nested
            // wrappers (e.g. <variant-selects> around .product-form__input) don't
            // compound opacity, and disable the native radios/selects inside for
            // keyboard users (pointer-events:none already blocks mouse swatches).
            const variantContainerSelectors = [
                'variant-selects', 'variant-radios', 'variant-picker', 'product-variant-picker',
                '.product-variant-picker', '.variant-picker', '.product-form__variants',
                'fieldset[name^="options"]', '.product-form__input', '.variant-input-wrap',
                'select[name^="options"]', 'select[name="id"]',
                'input[name^="options"]', 'input[name="id"]',
                '[data-variant-id]', '[data-product-variant-id]',
            ];
            const doDisableVariants = () => {
                const candidates = [];
                variantContainerSelectors.forEach((sel) => {
                    document.querySelectorAll(sel).forEach((el) => {
                        if (el.closest('#access-unlock-modal')) return;
                        candidates.push(el);
                    });
                });
                // Keep only top-level matches so a parent and its child aren't both dimmed.
                const tops = candidates.filter(
                    (el) => !candidates.some((other) => other !== el && other.contains(el))
                );
                tops.forEach((el) => {
                    if (el.dataset.accessVariantLocked !== 'true') {
                        el.dataset.accessVariantLocked = 'true';
                        el.dataset.accessVariantPrevPointer = el.style.pointerEvents;
                        el.dataset.accessVariantPrevOpacity = el.style.opacity;
                        el.dataset.accessVariantPrevCursor = el.style.cursor;
                        el.style.pointerEvents = 'none';
                        el.style.opacity = '0.4';
                        el.style.cursor = 'not-allowed';
                        el.title = 'Unlock to choose options';
                        if ('disabled' in el) el.disabled = true;
                    }
                    // Disable native controls inside so keyboard nav can't change them.
                    // Skip ones the theme already disabled (e.g. sold-out) so we don't
                    // wrongly re-enable them on restore.
                    el.querySelectorAll && el.querySelectorAll('input, select').forEach((ctrl) => {
                        if (ctrl.dataset.accessVariantCtrl === 'true' || ctrl.disabled) return;
                        ctrl.dataset.accessVariantCtrl = 'true';
                        ctrl.disabled = true;
                    });
                });
            };
            const applyLockUI = () => { doHide(); doDisableVariants(); };
            applyLockUI();
            // PR #8: debounce so AJAX-heavy themes (infinite scroll, cart drawers)
            // don't trigger applyLockUI() on every microtask. rAF coalesces calls
            // to one per paint frame; the no-op pending flag prevents queueing
            // multiple frames.
            let hidePending = false;
            const scheduleHide = () => {
                if (hidePending) return;
                hidePending = true;
                requestAnimationFrame(() => { hidePending = false; applyLockUI(); });
            };
            const hideObserver = new MutationObserver(scheduleHide);
            hideObserver.observe(document.body, { childList: true, subtree: true });

            // Insert unlock button(s). On a product page there's one cart form;
            // on a collection/listing page EVERY product card has its own cart
            // form, so we place a button on each. The old code used querySelector
            // and only ever locked the FIRST card \u2014 leaving the rest purchasable.
            const restoreAfterUnlock = () => {
                const modal = document.getElementById('access-unlock-modal');
                if (modal) modal.remove();
                hideObserver.disconnect();
                window.__accessCartManagedByLock = false;
                document.querySelectorAll('[data-access-hidden="true"]').forEach((el) => {
                    el.style.display = el.dataset.originalDisplay || '';
                    delete el.dataset.accessHidden;
                    delete el.dataset.originalDisplay;
                });
                // Restore the variant selectors we dimmed/disabled
                document.querySelectorAll('[data-access-variant-locked="true"]').forEach((el) => {
                    el.style.pointerEvents = el.dataset.accessVariantPrevPointer || '';
                    el.style.opacity = el.dataset.accessVariantPrevOpacity || '';
                    el.style.cursor = el.dataset.accessVariantPrevCursor || '';
                    el.removeAttribute('title');
                    if ('disabled' in el) el.disabled = false;
                    delete el.dataset.accessVariantLocked;
                    delete el.dataset.accessVariantPrevPointer;
                    delete el.dataset.accessVariantPrevOpacity;
                    delete el.dataset.accessVariantPrevCursor;
                });
                document.querySelectorAll('[data-access-variant-ctrl="true"]').forEach((ctrl) => {
                    ctrl.disabled = false;
                    delete ctrl.dataset.accessVariantCtrl;
                });
                // Also restore access_price.js disabled buttons
                document.querySelectorAll('[data-access-disabled="true"]').forEach((b) => {
                    b.disabled = false;
                    b.style.opacity = '';
                    b.style.cursor = '';
                    if (b.dataset.originalText) b.innerText = b.dataset.originalText;
                    delete b.dataset.accessDisabled;
                    delete b.dataset.originalText;
                });
                document.querySelectorAll('.shopify-payment-button').forEach((el) => (el.style.display = ''));
                // Remove every unlock button we placed (collection pages have many)
                document.querySelectorAll('.access-unlock-purchase-btn').forEach((b) => b.remove());
            };

            const openUnlockModal = () => {
                const reqs = Validator.getPasscodeRequirements(data.lockData.conditions);
                UI.renderClosableModal(data, reqs, function (codes) {
                    if (Validator.evaluateConditionsWithInputs(data.lockData.conditions, customerData, codes)) {
                        writeGrant(data, cacheKey);
                        restoreAfterUnlock();
                    } else {
                        UI.showError(UI.t('error.denied'));
                        UI.clearInputs();
                    }
                });
            };

            const buildUnlockButton = () => {
                const btn = document.createElement('button');
                btn.className = 'access-unlock-purchase-btn';
                btn.type = 'button';
                btn.innerHTML = '\uD83D\uDD12 Unlock to Purchase';
                btn.style.cssText = 'width:100%;padding:15px;background:#1a1a1a;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin-top:10px;transition:background 0.2s;';
                btn.onmouseenter = function () { btn.style.background = '#333'; };
                btn.onmouseleave = function () { btn.style.background = '#1a1a1a'; };
                btn.onclick = openUnlockModal;
                return btn;
            };

            // Place a button after EVERY cart form (dedup; the two selectors can
            // match the same node). Idempotent so the mutation observer / AJAX
            // re-renders don't add duplicates.
            const placeUnlockButtons = () => {
                const cartForms = Array.from(
                    document.querySelectorAll('form[action="/cart/add"], form[action*="/cart/add"]')
                ).filter((f, i, arr) => arr.indexOf(f) === i);

                if (cartForms.length > 0) {
                    cartForms.forEach((form) => {
                        if (form.dataset.accessUnlockPlaced === 'true') return;
                        form.dataset.accessUnlockPlaced = 'true';
                        form.parentNode.insertBefore(buildUnlockButton(), form.nextSibling);
                    });
                    return;
                }

                // No cart form (e.g. a product page that renders buy buttons
                // differently) \u2014 fall back to the product info container, once.
                const target = document.querySelector('.product-form, .product-form__buttons, .product__info-container');
                if (target && target.dataset.accessUnlockPlaced !== 'true') {
                    target.dataset.accessUnlockPlaced = 'true';
                    target.appendChild(buildUnlockButton());
                }
            };

            placeUnlockButtons();
            // Re-place for product cards that load after first paint (lazy grids,
            // infinite scroll). Cheap thanks to the accessUnlockPlaced guard.
            const buttonObserver = new MutationObserver(() => placeUnlockButtons());
            buttonObserver.observe(document.body, { childList: true, subtree: true });
            return;
        }

        // 4. Show Modal
        if (window.AccessEvents) window.AccessEvents.denied(data, 'requires_input');
        UI.hideContent(data);

        let reqs = Validator.getPasscodeRequirements(data.lockData.conditions);
        if (!reqs || reqs.length === 0) {
            try {
                const inputTypes = (window.AccessValidator && window.AccessValidator.INPUT_TYPES) || [
                    'singlePasscode',
                    'passcode',
                    'multiplePasscodes',
                    'passcodeFromList',
                    'specificEmail',
                    'emailContains',
                    'emailFromList',
                    'ageVerification',
                ];
                const conditions = Array.isArray(data.lockData.conditions) ? data.lockData.conditions : [];
                const fallbackReqs = [];
                // Field shape comes from the validator so this fallback cannot
                // disagree with it — a paired credential needs two fields, and
                // guessing from the type string cannot express that.
                const fieldsFor = (window.AccessValidator && window.AccessValidator.inputFieldsFor)
                    || function (type) {
                        if (type === 'pairedCredentials') return ['email', 'passcode'];
                        if (!inputTypes.includes(type)) return [];
                        if (String(type).toLowerCase().includes('email')) return ['email'];
                        if (type === 'ageVerification') return ['dob'];
                        return ['passcode'];
                    };

                conditions.forEach(function (group, groupIndex) {
                    const conds = (group && group.conditions) || [];
                    conds.forEach(function (c, subIndex) {
                        if (!c) return;

                        // c.label is a locale-keyed object on a
                        // multi-language store — resolve it to a string or
                        // the renderer prints "[object Object]".
                        const customLabel = (window.AccessUtils && window.AccessUtils.localize)
                            ? window.AccessUtils.localize(c.label)
                            : (typeof c.label === 'string' ? c.label : (c.label && c.label.default) || '');

                        fieldsFor(c.type).forEach(function (field, fieldIndex) {
                            const labelKey = field === 'email'
                                ? 'label.email'
                                : field === 'dob' ? 'label.dob' : 'label.passcode';
                            // A typed label names the condition, so it applies
                            // to its first field only.
                            const own = fieldIndex === 0 ? customLabel : '';

                            fallbackReqs.push({
                                type: c.type,
                                field,
                                fieldIndex,
                                labelKey,
                                customLabel: own || null,
                                displayLabel: own || UI.t(labelKey),
                                groupIndex,
                                subIndex,
                            });
                        });
                    });
                });
                if (fallbackReqs.length > 0) {
                    reqs = fallbackReqs.map(function (r, i) {
                        return { ...r, inputIndex: i };
                    });
                }
            } catch {
                // ignore
            }
        }

        UI.renderModal(data, reqs, function () {
            // On Validate
            const codes = UI.getEnteredCodes();

            // Validate
            if (Validator.evaluateConditionsWithInputs(data.lockData.conditions, customerData, codes)) {
                writeGrant(data, cacheKey);
                if (window.AccessEvents) window.AccessEvents.granted(data);

                if (data.lockData.redirect_url) {
                    window.location.href = data.lockData.redirect_url;
                } else {
                    UI.showContent(); // Removes modal automatically
                }
            } else {
                if (window.AccessEvents) window.AccessEvents.denied(data, 'invalid_input');
                UI.showError(UI.t('error.denied'));
                UI.clearInputs();
            }
        });
    }

    // Site-wide enforcement on EVERY page, driven by the global config:
    //  - hide_completely / hide_lists / hide_navigation: strip links/cards to the
    //    locked resource entirely, so it vanishes from grids, search and menus
    //    (its own page is blocked by init() above).
    //  - hide_add_to_cart: keep the card visible but hide the buy UI inside it
    //    (quick-add form / choose-options button), so a locked product can't be
    //    purchased from the homepage or any listing — the product's own page is
    //    handled by the checkAccess() hide-ATC branch, which also offers unlock.
    // Single live observer for the hide pass — a fresh-config re-run replaces
    // the stale target list instead of stacking a second observer that would
    // keep re-hiding items the fresh config unlocked.
    let hideObserver = null;

    function hideLockedResources(configOverride) {
        const initEl = document.getElementById('access-control-init');
        if (!initEl) return;

        if (hideObserver) {
            hideObserver.disconnect();
            hideObserver = null;
            // Reset previous hides so the new target list is authoritative.
            document.querySelectorAll('[data-airo-hidden="true"]').forEach((el) => {
                el.style.display = '';
                delete el.dataset.airoHidden;
            });
        }

        let config = configOverride || {};
        if (!configOverride) {
            try {
                config = JSON.parse(initEl.dataset.globalConfig || '{}');
            } catch {
                return;
            }
        }
        const locks = (config && config.locks) || [];
        if (!locks.length) return;

        const customerData = {
            loggedIn: initEl.dataset.customerLoggedIn === 'true',
            tags: initEl.dataset.customerTags ? initEl.dataset.customerTags.split(',') : [],
            email: initEl.dataset.customerEmail || '',
            country: initEl.dataset.customerCountry || '',
        };
        const customerKey = initEl.dataset.customerId || 'guest';
        const nowMs = Date.now();
        const basePath = { product: '/products/', collection: '/collections/', page: '/pages/', blog: '/blogs/' };

        const targets = [];
        const atcTargets = [];
        locks.forEach((l) => {
            const ls = l.lock_settings || {};
            const wantsStrip = ls.hide_completely || ls.hide_lists || ls.hide_navigation;
            const wantsAtc = ls.hide_add_to_cart;
            if (!wantsStrip && !wantsAtc) return;
            // Fail-safe: never mass-hide a lock with no conditions.
            if (!Array.isArray(ls.conditions) || ls.conditions.length === 0) return;
            // Respect the schedule window.
            const startsMs = l.starts_at ? Date.parse(l.starts_at) : NaN;
            const expiresMs = l.expires_at ? Date.parse(l.expires_at) : NaN;
            if (!Number.isNaN(startsMs) && nowMs < startsMs) return;
            if (!Number.isNaN(expiresMs) && nowMs >= expiresMs) return;
            const base = basePath[l.target_type];
            if (!base || !l.target_handle) return;
            // Eligible visitors keep seeing it (passcode-type → not auto-eligible → hidden).
            let eligible = false;
            try {
                eligible = !!(window.AccessValidator
                    && window.AccessValidator.evaluateConditionsWithInputs(ls.conditions, customerData, []));
            } catch {
                eligible = false;
            }
            if (eligible) return;
            if (wantsStrip) {
                targets.push(base + l.target_handle);
                return;
            }
            // hide_add_to_cart only. On the resource's OWN page the checkAccess
            // branch owns the hide/unlock lifecycle — running both would leave
            // the form re-hidden by this pass after a successful unlock.
            if (initEl.dataset.type === l.target_type && initEl.dataset.handle === l.target_handle) return;
            // Respect a grant earned through the unlock modal on the product
            // page (stored under the rule-keyed cache key by checkAccess).
            try {
                const grantKey = Utils.getCacheKey({
                    type: l.target_type,
                    handle: l.target_handle,
                    lockId: l.rule_id || l.lock_id,
                    lockData: { conditions: ls.conditions },
                    customerKey: customerKey,
                });
                // Same reprompt rule as checkAccess: a lock set to ask every
                // time must not be let through here by a stale flag either.
                if (readGrant({ lockData: { lock_settings: ls } }, grantKey) === 'granted') return;
            } catch { /* ignore */ }
            atcTargets.push(base + l.target_handle);
        });
        if (!targets.length && !atcTargets.length) return;

        // `product-card` (bare tag) is Horizon's card custom element.
        const cardSelector = '.card, .card-wrapper, .grid__item, .product-card, .collection-card, .grid-product, .product-grid-item, product-card, li';
        const toMatchers = (arr) => arr.map((href) => ({
            href,
            re: new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[/?#])'),
        }));
        const matchers = toMatchers(targets);
        const atcMatchers = toMatchers(atcTargets);
        // Buy UI inside a matched card: classic themes (cart form, name=add
        // button, Dawn's .quick-add wrapper) and Horizon custom elements
        // (<quick-add-component> holds the inline form OR the choose-options
        // dialog opener; <shopify-accelerated-checkout> is Buy-it-now).
        const atcInCardSelector = 'form[action*="/cart/add"], quick-add-component, .quick-add, ' +
            'button[name="add"], add-to-cart-component, .product-form__submit, .add-to-cart, ' +
            '.quick-add__submit, .shopify-payment-button, shopify-accelerated-checkout';

        const strip = () => {
            matchers.forEach((m) => {
                document.querySelectorAll('a[href*="' + m.href + '"]').forEach((a) => {
                    if (!m.re.test(a.getAttribute('href') || '')) return;
                    const card = a.closest(cardSelector);
                    const el = card || a;
                    if (el.dataset.airoHidden === 'true') return;
                    el.dataset.airoHidden = 'true';
                    el.style.display = 'none';
                });
            });
            atcMatchers.forEach((m) => {
                document.querySelectorAll('a[href*="' + m.href + '"]').forEach((a) => {
                    if (!m.re.test(a.getAttribute('href') || '')) return;
                    const card = a.closest(cardSelector);
                    // No recognizable card container → nothing we can safely
                    // scope the hide to; leave the link alone.
                    if (!card) return;
                    card.querySelectorAll(atcInCardSelector).forEach((el) => {
                        if (el.dataset.airoHidden === 'true') return;
                        el.dataset.airoHidden = 'true';
                        el.style.display = 'none';
                    });
                });
            });
        };
        strip();
        // Re-run for lazy grids / AJAX search, coalesced to one pass per frame.
        let pending = false;
        hideObserver = new MutationObserver(() => {
            if (pending) return;
            pending = true;
            requestAnimationFrame(() => { pending = false; strip(); });
        });
        hideObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Remember secret-link codes from ANY page (?access=CODE / ?code=CODE) so
    // a shared link to the homepage or an unlocked page still unlocks the
    // gated content the customer navigates to afterwards.
    function captureSecretCode() {
        try {
            const params = new URLSearchParams(window.location.search);
            const code = (params.get('access') || params.get('code') || '').trim();
            if (!code) return;
            const seen = JSON.parse(localStorage.getItem('airo_secret_codes') || '[]');
            if (!seen.includes(code)) {
                seen.push(code);
                localStorage.setItem('airo_secret_codes', JSON.stringify(seen));
            }
        } catch { /* ignore */ }
    }

    function run() {
        captureSecretCode();
        // Strip hidden items site-wide first (sync), then evaluate the current page.
        try { hideLockedResources(); } catch (e) { }
        init();
    }

    // Run when DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }

    return { init };
})();
