import { useCallback, useEffect, useState } from 'react';
import ExtensionNotice from './ExtensionNotice';

// Snooze the toast for a day when the merchant dismisses it.
const SNOOZE_KEY = 'airo:embed_notice_dismissed_until';

/**
 * App-wide host for the "app embed disabled" warning toast. Rendered once at the
 * root (app.jsx) so it appears on EVERY page — not just the dashboard — and
 * persists across Inertia navigations (it lives outside <App>, so it doesn't
 * remount on each visit).
 *
 * The embed status is resolved asynchronously via /extension/status, so page
 * loads are never blocked on the (slow) Admin API theme read. It re-verifies
 * when the merchant returns to the tab (e.g. right after enabling the embed in
 * the theme editor), so the toast disappears on its own — no hard refresh.
 */
export default function GlobalExtensionNotice() {
    const [enabled, setEnabled] = useState(null); // null = not resolved yet
    const [deepLink, setDeepLink] = useState('');
    const [dismissed, setDismissed] = useState(() => {
        try {
            return Number(localStorage.getItem(SNOOZE_KEY) || 0) > Date.now();
        } catch {
            return false;
        }
    });

    const check = useCallback(async (fresh) => {
        if (!window.axios) return;
        try {
            const { data } = await window.axios.get(`/extension/status${fresh ? '?fresh=1' : ''}`);
            if (data && typeof data.enabled === 'boolean') {
                setEnabled(data.enabled);
                if (data.deepLink) setDeepLink(data.deepLink);
                if (data.enabled) {
                    try { localStorage.removeItem(SNOOZE_KEY); } catch { /* ignore */ }
                }
            }
        } catch {
            // Network/auth hiccup — leave the current state untouched (fail quiet).
        }
    }, []);

    // Resolve once on load. Uses the server cache, so it's fast when warm.
    useEffect(() => {
        check(false);
    }, [check]);

    // While disabled, re-verify (bypassing the cache) whenever the merchant comes
    // back to the tab — typically right after enabling the embed in the editor.
    useEffect(() => {
        if (enabled !== false) return undefined;
        const onFocus = () => {
            if (document.visibilityState === 'visible') check(true);
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [enabled, check]);

    if (enabled !== false || dismissed || !deepLink) return null;

    return (
        <ExtensionNotice
            deepLink={deepLink}
            onDismiss={() => {
                setDismissed(true);
                try {
                    localStorage.setItem(SNOOZE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
                } catch {
                    /* ignore */
                }
            }}
        />
    );
}
