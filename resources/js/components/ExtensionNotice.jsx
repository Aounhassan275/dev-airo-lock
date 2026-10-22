import { AlertTriangle, ArrowUpRight, X } from 'lucide-react';

/**
 * Slim warning toast, pinned to the top, shown when the Airo Lock storefront app
 * embed is NOT activated on the merchant's published theme. Without the embed,
 * every lock silently does nothing — the #1 "locks aren't working" cause.
 *
 * Deliberately minimal: a single-row amber warning bar (no gradients/animations
 * beyond a subtle slide-in), like a native toast. The primary action deep-links
 * straight into the theme editor with the embed pre-toggled on.
 *
 * Purely presentational — the parent owns the enabled state, dismissal and the
 * re-check that auto-hides this once the embed is on.
 */
export default function ExtensionNotice({ deepLink, onEnableClick, onDismiss }) {
    return (
        <>
            <style>{`
                @keyframes airo-toast-in {
                    from { opacity: 0; transform: translate(-50%, -12px); }
                    to   { opacity: 1; transform: translate(-50%, 0); }
                }
                .airo-toast {
                    position: fixed;
                    top: 16px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 520;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    max-width: calc(100vw - 32px);
                    padding: 8px 10px 8px 13px;
                    background: #fffbeb;
                    border: 1px solid #fde68a;
                    border-left: 3px solid #f59e0b;
                    border-radius: 8px;
                    box-shadow: 0 4px 16px rgba(17, 24, 39, 0.10);
                    font-family: inherit;
                    animation: airo-toast-in 0.26s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
                .airo-toast__text {
                    font-size: 13px;
                    color: #92400e;
                    line-height: 1.35;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .airo-toast__text strong { font-weight: 600; color: #78350f; }
                .airo-toast__btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    flex-shrink: 0;
                    padding: 5px 10px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    background: #b45309;
                    color: #fff;
                    font-size: 12px;
                    font-weight: 600;
                    text-decoration: none;
                    white-space: nowrap;
                    transition: background 0.15s ease;
                }
                .airo-toast__btn:hover { background: #92400e; }
                .airo-toast__close {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    width: 22px;
                    height: 22px;
                    border: none;
                    border-radius: 5px;
                    background: transparent;
                    color: #b45309;
                    cursor: pointer;
                    transition: background 0.15s ease;
                }
                .airo-toast__close:hover { background: #fde68a; }
                @media (max-width: 480px) {
                    .airo-toast__text { white-space: normal; }
                }
            `}</style>

            <div className="airo-toast" role="alert" aria-live="polite">
                <AlertTriangle size={17} color="#d97706" style={{ flexShrink: 0 }} />
                <span className="airo-toast__text">
                    <strong>Your locks are inactive.</strong> The app embed is turned off on your theme.
                </span>
                <a
                    className="airo-toast__btn"
                    href={deepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onEnableClick}
                >
                    Enable
                    <ArrowUpRight size={13} />
                </a>
                <button className="airo-toast__close" aria-label="Dismiss" onClick={onDismiss}>
                    <X size={14} />
                </button>
            </div>
        </>
    );
}
