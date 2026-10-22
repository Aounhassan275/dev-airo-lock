// access_price.js - Handles hiding prices for locked items

(function () {

    // Translate a built-in string for the current storefront locale.
    function I18N(key) {
        return window.AccessI18n && typeof window.AccessI18n.t === 'function'
            ? window.AccessI18n.t(key)
            : key;
    }

    // Resolve a merchant-authored value that may be a per-locale object.
    function PT(value) {
        return window.AccessUtils && typeof window.AccessUtils.localize === 'function'
            ? window.AccessUtils.localize(value)
            : (typeof value === 'string' ? value : '');
    }

    // Simple hash function for conditions (same as in access_utils.js)
    function hashConditions(conditions) {
        if (!conditions || !Array.isArray(conditions)) return '';
        try {
            const str = JSON.stringify(conditions);
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash).toString(36);
        } catch (e) {
            return '';
        }
    }

    function checkPriceHiding() {
        const initEl = document.getElementById('access-control-init');
        if (!initEl) return;

        const handle = initEl.dataset.handle;
        const type = initEl.dataset.type;
        // Try data-local-rule first (new flow), fallback to data-lock-data (legacy)
        const lockDataStr = initEl.dataset.localRule || initEl.dataset.lockData;

        if (!lockDataStr || lockDataStr === 'null') return;

        try {
            const lockData = JSON.parse(lockDataStr);

            // Honour the widget's language settings here too, so a merchant
            // who pinned one language gets it on price messages as well.
            if (window.AccessI18n && typeof window.AccessI18n.configure === 'function') {
                const s = lockData && lockData.settings;
                const widgetSettings =
                    (s && s.widget_json && s.widget_json.settings) ||
                    (s && s.text_widget_json && s.text_widget_json.settings) ||
                    null;
                window.AccessI18n.configure(widgetSettings && widgetSettings.language);
            }

            const hidePrice = lockData && (lockData.hide_price || (lockData.settings && lockData.settings.hide_price));
            const hideAddToCart = lockData && (lockData.hide_add_to_cart || (lockData.settings && lockData.settings.hide_add_to_cart));

            if (hidePrice || hideAddToCart) {
                // Generate cache key with conditions hash for proper invalidation.
                // Must mirror AccessUtils.getCacheKey (which core's unlock flow
                // writes with): conditions hash + customer identity suffix.
                const conditionsHash = lockData.conditions ? hashConditions(lockData.conditions) : '';
                const customerKey = initEl.dataset.customerId || 'guest';
                const cacheKey = 'access_' + type + '_' + handle + '_' + (lockData.rule_id || '') + '_' + conditionsHash + '_' + customerKey;
                const cachedAccess = localStorage.getItem(cacheKey);

                if (cachedAccess === 'granted') {
                    showPricesAndButtons();
                    return;
                }

                const message = PT(lockData.price_message) || I18N('price.signInToSee');

                if (hidePrice) {
                    // Hide both prices and add-to-cart buttons
                    hidePricesAndButtons(message);
                } else if (hideAddToCart && !window.__accessCartManagedByLock) {
                    // Hide only add-to-cart buttons, leave prices visible
                    // Skip if access_controll.js is already handling this
                    hideAddToCartButtons();
                }
            }
        } catch (e) {
        }
    }

    function hidePricesAndButtons(message) {
        // Robust list of selectors for various themes
        const priceSelectors = [
            '.price',
            '.product-price',
            '[data-price]',
            '.price__regular',
            '.price__sale',
            '.card__price',
            '.product-item__price',
            '.product__price',
            '#price',
            '.money',
        ];

        const addToCartSelectors = [
            'form[action="/cart/add"]',
            'button[name="add"]',
            '.product-form__submit',
            '.add-to-cart',
            '#AddToCart',
            '.shopify-payment-button', // Hide dynamic checkout buttons too
        ];

        // Hide/Replace Prices
        priceSelectors.forEach((sel) => {
            const els = document.querySelectorAll(sel);
            els.forEach((el) => {
                if (el.dataset.priceHidden === 'true') return;

                // Don't hide if it's inside a cart drawer/popup potentially?
                // For now, strict hiding on product/collection pages is safer.

                el.style.display = 'none'; // Hide original

                const msgEl = document.createElement('div');
                msgEl.className = 'access-price-lock-message';
                msgEl.style.color = '#d93f3f';
                msgEl.style.fontWeight = 'bold';
                msgEl.style.fontSize = '14px';
                msgEl.style.padding = '5px 0';
                msgEl.innerText = message;

                // Insert after the hidden element so it stays in layout flow
                el.parentNode.insertBefore(msgEl, el.nextSibling);

                el.dataset.priceHidden = 'true';
                el.dataset.originalDisplay = el.style.display; // Track for potential restore
            });
        });

        // Disable/Hide Add to Cart & Checkout Buttons
        addToCartSelectors.forEach((sel) => {
            const els = document.querySelectorAll(sel);
            els.forEach((el) => {
                // Hide dynamic checkout buttons completely as they are uncontrollable
                if (el.classList.contains('shopify-payment-button')) {
                    el.style.display = 'none';
                    return;
                }

                if (el.tagName === 'FORM') {
                    // Disable submit button inside form
                    const btns = el.querySelectorAll('button[type="submit"], input[type="submit"]');
                    btns.forEach((btn) => disableButton(btn));
                } else {
                    disableButton(el);
                }
            });
        });
    }

    function hideAddToCartButtons() {
        const addToCartSelectors = [
            'form[action="/cart/add"]',
            'button[name="add"]',
            '.product-form__submit',
            '.add-to-cart',
            '#AddToCart',
            '.shopify-payment-button',
        ];

        addToCartSelectors.forEach((sel) => {
            const els = document.querySelectorAll(sel);
            els.forEach((el) => {
                if (el.classList.contains('shopify-payment-button')) {
                    el.style.display = 'none';
                    return;
                }

                if (el.tagName === 'FORM') {
                    const btns = el.querySelectorAll('button[type="submit"], input[type="submit"]');
                    btns.forEach((btn) => disableButton(btn));
                } else {
                    disableButton(el);
                }
            });
        });
    }

    function disableButton(btn) {
        if (btn.dataset.accessDisabled === 'true') return;

        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
        const originalText = btn.innerText || btn.value;
        btn.dataset.originalText = originalText;
        btn.innerText = I18N('button.locked');
        btn.dataset.accessDisabled = 'true';
    }

    function showPricesAndButtons() {
        const hiddenPrices = document.querySelectorAll('[data-price-hidden="true"]');
        hiddenPrices.forEach((el) => {
            el.style.display = ''; // Restore default
            delete el.dataset.priceHidden;
            // Remove message
            const next = el.nextSibling;
            if (next && next.classList && next.classList.contains('access-price-lock-message')) {
                next.remove();
            }
        });

        // Re-enable buttons
        const disabledBtns = document.querySelectorAll('[data-access-disabled="true"]');
        disabledBtns.forEach((btn) => {
            btn.disabled = false;
            btn.style.opacity = '';
            btn.style.cursor = '';
            if (btn.dataset.originalText) {
                btn.innerText = btn.dataset.originalText;
            }
            delete btn.dataset.accessDisabled;
        });

        // Show payment buttons
        const paymentBtns = document.querySelectorAll('.shopify-payment-button');
        paymentBtns.forEach((el) => (el.style.display = ''));
    }

    // Run on load and observe changes
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkPriceHiding);
    } else {
        checkPriceHiding();
    }

    // Aggressive observer for SPA/Dynamic Themes — coalesced to one paint
    // frame so AJAX-heavy themes don't run checkPriceHiding() on every
    // microtask (PR #8 perf hardening).
    let pricePending = false;
    const observer = new MutationObserver(() => {
        if (pricePending) return;
        pricePending = true;
        requestAnimationFrame(() => { pricePending = false; checkPriceHiding(); });
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();
