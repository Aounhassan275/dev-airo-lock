/**
 * Access Control — Accessibility helpers (PR #9 / 5.9 BFS prep).
 *
 * Provides:
 *   - trapFocus(root): keyboard focus stays inside the modal; Shift+Tab
 *     wraps to the last focusable, Tab past the last wraps to the first.
 *   - releaseFocus(root): tear down trap when modal closes.
 *
 * Storefront UX standards Shopify Built for Shopify checks for:
 *   - Modals are role="dialog" aria-modal="true" with labelled title/desc
 *   - Tab and Shift+Tab cycle within the dialog
 *   - Escape closes closable dialogs and restores focus to the trigger
 *   - First interactive control receives focus on open
 *
 * The full-lock modal is intentionally NOT escape-closable — closing it
 * would reveal locked content. The closable variant (Hide Add to Cart
 * mode) opts in via `closable: true` on options.
 */
window.AccessA11y = (function () {
    const FOCUSABLE = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    function focusableElements(root) {
        if (!root) return [];
        return Array.from(root.querySelectorAll(FOCUSABLE)).filter(
            (el) => el.offsetParent !== null || el.tagName === 'A'
        );
    }

    function trapFocus(root, options) {
        if (!root) return null;
        const opts = options || {};
        const closable = !!opts.closable;
        const onClose = typeof opts.onClose === 'function' ? opts.onClose : null;

        const previouslyFocused = document.activeElement;
        const items = focusableElements(root);
        if (items.length > 0) {
            // Defer to next frame so newly-rendered modals can settle layout
            requestAnimationFrame(() => items[0].focus());
        }

        function handleKeydown(e) {
            if (e.key === 'Escape' && closable && onClose) {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key !== 'Tab') return;

            const focusables = focusableElements(root);
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;

            if (e.shiftKey) {
                if (active === first || !root.contains(active)) {
                    e.preventDefault();
                    last.focus();
                }
            } else {
                if (active === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        }

        document.addEventListener('keydown', handleKeydown, true);

        return {
            release: function () {
                document.removeEventListener('keydown', handleKeydown, true);
                if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                    try { previouslyFocused.focus(); } catch { /* noop */ }
                }
            },
        };
    }

    return { trapFocus, focusableElements };
})();
