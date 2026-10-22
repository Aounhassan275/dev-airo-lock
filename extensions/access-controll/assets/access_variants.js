/**
 * Access Control — Variant-level locking (5.4)
 *
 * Renders per-variant locks on product pages when a rule has
 * scope: "variant" and a non-empty variant_ids array.
 *
 * - "hide" mode (default): removes locked variants from the variant
 *   selector entirely. Customer never sees them as options.
 * - "disable" mode: keeps the option visible but disabled, with a
 *   visual greyed-out state and a tooltip explaining access is restricted.
 *
 * If every variant on the product is locked AND the parent product is
 * not itself the target of a separate full-product lock, applies
 * all_variants_locked_behavior: "hide_product" or "show_disabled".
 *
 * Re-applies via MutationObserver to catch theme-side variant picker
 * re-renders (Dawn redraws on selection, Impulse on AJAX add-to-cart,
 * Prestige on quick-view, etc).
 *
 * IMPORTANT: untested against live themes. Smoke test on Dawn first,
 * then Impulse + Prestige (or whatever the merchant base uses) before
 * merging PR #4 to main. Variant-selector DOM varies by theme.
 */

window.AccessVariants = (function () {
    const VARIANT_SELECTORS = [
        // Radio inputs (Dawn and most modern themes use these)
        'input[type="radio"][name^="options"]',
        'input[type="radio"][name="id"]',
        // Native <select> dropdowns (older themes, some custom themes)
        'select[name^="options"] option',
        'select[name="id"] option',
        // Custom button-style swatches (varies by theme; treat as best-effort)
        '[data-variant-id]',
        '[data-product-variant-id]',
    ];

    const PRICE_AND_CART_SELECTORS_FOR_DISABLED = [
        '[data-product-price]',
        '.product-price',
        '.product__price',
        'form[action*="/cart/add"] [name="add"]',
        '.product-form__submit',
        '#AddToCart',
    ];

    /**
     * Apply variant-level locks to the current product page.
     *
     * @param {Object} lockData - the active lock metafield payload
     * @param {Object} context  - { locked: bool, customerData }
     */
    function apply(lockData, context) {
        if (!lockData) return;

        const scope = lockData.scope || (lockData.settings && lockData.settings.scope);
        if (scope !== 'variant') return;

        const variantIds = (lockData.variant_ids
            || (lockData.settings && lockData.settings.variant_ids)
            || []).map(toNumericId).filter(Boolean);

        if (variantIds.length === 0) return;

        const display = lockData.locked_variant_display
            || (lockData.settings && lockData.settings.locked_variant_display)
            || 'hide';

        const allLockedBehavior = lockData.all_variants_locked_behavior
            || (lockData.settings && lockData.settings.all_variants_locked_behavior)
            || 'hide_product';

        const applyOnce = () => {
            const matchedElements = collectVariantElements(variantIds);

            matchedElements.forEach((el) => {
                if (el.dataset.accessVariantHandled === '1') return;
                el.dataset.accessVariantHandled = '1';

                if (display === 'hide') {
                    el.style.display = 'none';
                    // For radio inputs, also remove the associated label visually
                    if (el.tagName === 'INPUT' && el.type === 'radio') {
                        const label = document.querySelector(`label[for="${el.id}"]`);
                        if (label) label.style.display = 'none';
                    }
                } else {
                    // disable mode
                    if ('disabled' in el) el.disabled = true;
                    el.style.opacity = '0.4';
                    el.style.pointerEvents = 'none';
                    el.style.cursor = 'not-allowed';
                    el.title = (window.AccessI18n ? window.AccessI18n.t('prompt.default') : 'Access restricted.');
                }
            });

            // Detect all-variants-locked condition
            const totalKnownVariants = countAllVariantsOnPage();
            if (totalKnownVariants > 0 && variantIds.length >= totalKnownVariants) {
                handleAllVariantsLocked(allLockedBehavior);
            }
        };

        // Initial pass
        applyOnce();

        // Re-apply on theme-side re-renders (variant change, quick view, AJAX cart).
        // Coalesced to one paint frame so AJAX-heavy themes don't run applyOnce()
        // on every microtask (PR #8 perf hardening).
        if (!window.__accessVariantObserver) {
            let variantPending = false;
            window.__accessVariantObserver = new MutationObserver(() => {
                if (variantPending) return;
                variantPending = true;
                requestAnimationFrame(() => { variantPending = false; applyOnce(); });
            });
            window.__accessVariantObserver.observe(document.body, {
                childList: true,
                subtree: true,
            });
        }

        // Also listen on variant input changes (cheap signal that the price/
        // availability JSON probably got updated by theme JS)
        document.addEventListener('change', (e) => {
            const t = e.target;
            if (!t || !t.matches) return;
            if (t.matches('input[name^="options"], input[name="id"], select[name^="options"], select[name="id"]')) {
                applyOnce();
            }
        });

    }

    // Shopify variant ids appear in two shapes: the numeric storefront id
    // (e.g. "47494429507778" in input[name="id"]) and the admin GID
    // ("gid://shopify/ProductVariant/47494429507778"). Reduce both to the
    // trailing numeric id so a rule stored with GIDs still matches the DOM.
    function toNumericId(value) {
        return String(value == null ? '' : value).replace(/[^0-9]/g, '');
    }

    function collectVariantElements(variantIds) {
        const set = new Set();
        VARIANT_SELECTORS.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => {
                const elVariantId =
                    el.value
                    || el.dataset.variantId
                    || el.dataset.productVariantId
                    || el.getAttribute('value');
                if (elVariantId && variantIds.includes(toNumericId(elVariantId))) {
                    set.add(el);
                }
            });
        });
        return Array.from(set);
    }

    function countAllVariantsOnPage() {
        // Best-effort: count unique variant IDs visible in the variant selector.
        // Reads from the most reliable signal: the master variant input
        // (input[name="id"]) which themes use for the cart-add payload.
        const masterOptions = document.querySelectorAll('select[name="id"] option, input[name="id"]');
        const ids = new Set();
        masterOptions.forEach((el) => {
            const v = el.value || el.getAttribute('value');
            if (v) ids.add(String(v));
        });
        return ids.size;
    }

    function handleAllVariantsLocked(behavior) {
        if (behavior === 'show_disabled') {
            // Disable add-to-cart and grey out price; leave page visible
            PRICE_AND_CART_SELECTORS_FOR_DISABLED.forEach((sel) => {
                document.querySelectorAll(sel).forEach((el) => {
                    if (el.dataset.accessAllVariantsHandled === '1') return;
                    el.dataset.accessAllVariantsHandled = '1';
                    if ('disabled' in el) el.disabled = true;
                    el.style.opacity = '0.5';
                    el.style.pointerEvents = 'none';
                });
            });
        } else {
            // hide_product (default): hide the main product container
            const mainSelectors = ['main', '#MainContent', '.main-content', '[role="main"]'];
            mainSelectors.forEach((s) => {
                const el = document.querySelector(s);
                if (el) el.style.display = 'none';
            });
        }
    }

    return { apply };
})();
