/**
 * Access Control Utilities
 * Shared helper functions
 */

window.AccessUtils = (function () {
    // Simple hash function for conditions
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

    function getCacheKey(data) {
        // Include conditions hash to invalidate cache when conditions change,
        // and the customer identity so a grant earned by one account doesn't
        // leak to a logged-out visitor (or another account) on the same browser.
        const conditionsHash = data.lockData?.conditions ? hashConditions(data.lockData.conditions) : '';
        const customerKey = data.customerKey || 'guest';
        return 'access_' + data.type + '_' + data.handle + '_' + (data.lockId || '') + '_' + conditionsHash + '_' + customerKey;
    }

    function createElement(tag, attributes = {}, styles = {}, html = '') {
        const el = document.createElement(tag);

        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'dataset') {
                Object.entries(value).forEach(([dKey, dValue]) => {
                    el.dataset[dKey] = dValue;
                });
            } else {
                el.setAttribute(key, value);
            }
        });

        Object.entries(styles).forEach(([key, value]) => {
            el.style[key] = value;
        });

        if (html) el.innerHTML = html;
        return el;
    }

    function hexToRgba(hex, alpha = 1) {
        // Handle undefined or null
        if (!hex) return `rgba(0,0,0,${alpha})`;

        let c;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            c = hex.substring(1).split('');
            if (c.length === 3) {
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + alpha + ')';
        }
        return hex;
    }

    /**
     * Multi-language storefront content (5.6).
     *
     * Resolves a possibly-locale-keyed value to a plain string for the
     * current shop locale. Backward compatible with the previous shape
     * where every text field was a plain string — plain strings are
     * passed through unchanged so existing widgets keep working.
     *
     * Locale-keyed shape:
     *   {
     *     "default": "Login to see price",
     *     "fr": "Connectez-vous pour voir le prix",
     *     "de": "Anmelden, um den Preis zu sehen"
     *   }
     *
     * Resolution order: exact match (e.g. "fr-CA") → language only
     * (e.g. "fr") → default → first available value → empty string.
     */
    function localize(value, locale) {
        if (value == null) return '';
        if (typeof value === 'string') return value;
        if (typeof value !== 'object') return String(value);

        const loc = (locale || getCurrentLocale() || '').toLowerCase();
        if (loc && value[loc] != null && String(value[loc]).trim() !== '') {
            return String(value[loc]);
        }

        const language = loc.split('-')[0];
        if (language && value[language] != null && String(value[language]).trim() !== '') {
            return String(value[language]);
        }

        if (value.default != null) return String(value.default);

        // Last resort: the first non-empty value
        const firstNonEmpty = Object.values(value).find((v) => v != null && String(v).trim() !== '');
        return firstNonEmpty != null ? String(firstNonEmpty) : '';
    }

    function getCurrentLocale() {
        // Order of preference:
        //   1. Shopify.locale (set by themes that initialize the JS global)
        //   2. The init element's data-locale (set from Liquid request.locale.iso_code)
        //   3. document.documentElement.lang
        try {
            if (window.Shopify && window.Shopify.locale) return String(window.Shopify.locale);
        } catch { /* noop */ }
        const initEl = document.getElementById('access-control-init');
        if (initEl && initEl.dataset.locale) return initEl.dataset.locale;
        if (document.documentElement && document.documentElement.lang) {
            return document.documentElement.lang;
        }
        return '';
    }

    return {
        getCacheKey,
        createElement,
        hexToRgba,
        localize,
        getCurrentLocale,
    };
})();
