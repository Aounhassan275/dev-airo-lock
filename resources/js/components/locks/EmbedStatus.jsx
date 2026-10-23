import { useCallback, useEffect, useState } from 'react';
import { CheckIcon, WarningIcon } from './LockIcons';

/**
 * Whether Airo's theme app embed is on. Same source the app-wide notice reads
 * (GET /extension/status → ThemeExtensionService::status()), so the builder
 * and the toast cannot disagree. `enabled` is null until it has answered.
 */
export function useEmbedStatus() {
    const [enabled, setEnabled] = useState(null);
    const [deepLink, setDeepLink] = useState('');
    const [checking, setChecking] = useState(false);

    const check = useCallback(async (fresh = false) => {
        if (!window.axios) return;
        setChecking(true);
        try {
            const { data } = await window.axios.get(`/extension/status${fresh ? '?fresh=1' : ''}`);
            if (data && typeof data.enabled === 'boolean') {
                setEnabled(data.enabled);
                if (data.deepLink) setDeepLink(data.deepLink);
            }
        } catch {
            // Network/auth hiccup — keep whatever we knew.
        } finally {
            setChecking(false);
        }
    }, []);

    useEffect(() => {
        check(false);
    }, [check]);

    // While it is off, look again when the merchant comes back to the tab —
    // typically straight after switching it on in the theme editor.
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

    return { enabled, deepLink, checking, check };
}

/** Section 5's body: the embed's state, the way to turn it on, and the manual route. */
export default function EmbedStatus({ status }) {
    const { enabled, deepLink, checking, check } = status;
    const on = enabled === true;
    const unknown = enabled === null;

    return (
        <>
            <div className={`lb-embed${on ? ' on' : ''}`}>
                <span className="lb-embed-ic" aria-hidden="true">
                    {on ? <CheckIcon /> : <WarningIcon />}
                </span>
                <span style={{ minWidth: 0 }}>
                    <span className="lb-embed-t">
                        {unknown ? 'Checking the app embed…' : on ? 'App embed is on' : 'App embed is off'}
                    </span>
                    <span className="lb-embed-d">
                        {on
                            ? 'Your locks run on the storefront.'
                            : 'Your locks will not run on the storefront until you turn it on.'}
                    </span>
                </span>
                <span className="row g8 lb-embed-act">
                    {deepLink ? (
                        <a
                            className={`btn${on ? '' : ' primary'}`}
                            href={deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {on ? 'Open theme editor' : 'Enable in theme editor'}
                        </a>
                    ) : null}
                    <button
                        type="button"
                        className={`btn${checking ? ' syncing' : ''}`}
                        onClick={() => check(true)}
                        disabled={checking}
                    >
                        Check again
                    </button>
                </span>
            </div>
            <span className="lb-embed-note">
                {on
                    ? 'Nothing else to do here. Changing themes later turns it off again.'
                    : 'Opens the editor with the embed already switched on — you only have to press Save.'}
            </span>

            {on ? null : (
                <ol className="lb-howto">
                    <li>
                        <span className="lb-howto-n">1</span>
                        <span>
                            <strong>Online Store › Themes</strong>, then <strong>Customize</strong> your live theme.
                        </span>
                    </li>
                    <li>
                        <span className="lb-howto-n">2</span>
                        <span>
                            Open <strong>App embeds</strong> in the left panel.
                        </span>
                    </li>
                    <li>
                        <span className="lb-howto-n">3</span>
                        <span>
                            Switch on <strong>Airo Access Lock</strong> and press <strong>Save</strong>.
                        </span>
                    </li>
                </ol>
            )}
        </>
    );
}
