import { useMemo } from 'react';
import Icon from './icons';
import { openChat } from './constants';

const CONFETTI = ['#1a1a1a', '#5c5c5c', '#8a8a8a', '#c9c9c9', '#cdfee1', '#ffd79d'];

/** Thirty pieces from behind the mark — the celebration comes from the thing
    that just succeeded rather than from the edges. */
function makeConfetti() {
    return Array.from({ length: 30 }, (_, i) => {
        const round = i % 4 === 0;
        return {
            '--x': `${((Math.random() - 0.5) * 560).toFixed(0)}px`,
            '--y': `${(150 + Math.random() * 200).toFixed(0)}px`,
            '--r': `${((Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 540)).toFixed(0)}deg`,
            background: CONFETTI[i % CONFETTI.length],
            animationDelay: `${(Math.random() * 180).toFixed(0)}ms`,
            ...(round ? { borderRadius: '50%', width: 8, height: 8 } : {}),
        };
    });
}

const PROG = ['Creating your lock', 'Publishing it to your storefront', 'Checking the theme app embed'];

/**
 * Step 4 — Done. It shows its work (the three jobs, each acted out by a
 * drawing) before it shows the result: the lock read back, a party popper and
 * a pill that says whether it is running or waiting on the app embed.
 */
export default function DoneStep({ rows, scene, revealed, embedOn, summary, firstLock, onQuickView, onClose, leaving }) {
    const confetti = useMemo(() => (revealed ? makeConfetti() : []), [revealed]);

    const which = firstLock ? 'Your first lock' : 'Your lock';
    const prog3 = rows[2] === 'ok' ? 'App embed is on'
        : rows[2] === 'warn' ? 'App embed is off — the lock is saved, not running'
            : PROG[2];

    return (
        <div className="wiz" data-wiz="6">
            <button type="button" className="done-x" onClick={onClose} aria-label="Close setup" disabled={leaving}>
                <Icon name="close" strokeWidth={1.9} />
            </button>
            <div className="work-body" style={{ paddingTop: 0 }}>
                <div className={`work-opts done-wrap${revealed ? ' play' : ''}`}>
                    <span className="confetti" aria-hidden="true">
                        {confetti.map((style, i) => <i key={i} style={style} />)}
                    </span>

                    <div className="scenes" aria-hidden="true">
                        <svg className={`scene${scene === 1 ? ' on' : ''}`} data-s="1" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                            <circle className="sc-ring" cx="60" cy="70" r="33" strokeWidth="2" />
                            <path className="sc-shackle" d="M46 58V45a14 14 0 0 1 28 0v13" />
                            <rect className="sc-body" x="33" y="58" width="54" height="38" rx="9" />
                            <path className="sc-keyhole" d="M60 72v9" />
                        </svg>
                        <svg className={`scene${scene === 2 ? ' on' : ''}`} data-s="2" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                            <rect className="sc-page" x="28" y="20" width="64" height="76" rx="9" />
                            <path className="sc-line" d="M41 40h26" />
                            <path className="sc-line" d="M41 53h38" />
                            <path className="sc-line" d="M41 66h20" />
                            <g className="sc-badge">
                                <circle cx="60" cy="86" r="15" fill="#fff" />
                                <rect x="53" y="84" width="14" height="10" rx="2.6" strokeWidth="3" />
                                <path d="M56 84v-3a4 4 0 0 1 8 0v3" strokeWidth="3" />
                            </g>
                        </svg>
                        <svg className={`scene${scene === 3 ? ' on' : ''}`} data-s="3" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                            <rect className="sc-panel" x="20" y="38" width="80" height="46" rx="11" />
                            <path d="M32 53h22M32 66h14" strokeWidth="3" opacity=".45" />
                            <rect className="sc-track" x="66" y="52" width="26" height="16" rx="8" strokeWidth="3" />
                            <circle className="sc-knob" cx="74" cy="60" r="4.4" fill="currentColor" stroke="none" />
                            <g className="sc-glass">
                                <circle cx="46" cy="60" r="12" fill="#fff" />
                                <path d="M55 69l9 9" />
                            </g>
                        </svg>
                    </div>

                    <ol className="prog" aria-live="polite">
                        {PROG.map((text, i) => (
                            <li key={text} className={rows[i] || ''}>
                                <span className="prog-m" aria-hidden="true" />
                                <span className="prog-t">{i === 2 ? prog3 : text}</span>
                            </li>
                        ))}
                    </ol>

                    <div className="done-res">
                        <span className="done-ic" aria-hidden="true"><Icon name="popper" strokeWidth={1.7} /></span>
                        <h2 className="done-h">{which}{embedOn ? ' is live' : ' is saved'}</h2>
                        <span className={`done-pill${embedOn ? '' : ' wait'}`}>
                            {embedOn ? 'Running on your storefront' : 'Waiting on the app embed'}
                        </span>
                        <p className="sm sub" style={{ maxWidth: 420 }}>
                            {embedOn
                                ? 'Shoppers who do not pass your conditions will see your popup from now on.'
                                : 'It will start running as soon as you turn the app embed on in your theme.'}
                        </p>

                        <div className="done-sum">
                            <div className="done-row"><span className="done-k">Name</span><span className="done-v">{summary.name}</span></div>
                            <div className="done-row"><span className="done-k">Protects</span><span className="done-v">{summary.protects}</span></div>
                            <div className="done-row"><span className="done-k">Opens for</span><span className="done-v">{summary.opens}</span></div>
                            <div className="done-row"><span className="done-k">Shows</span><span className="done-v">{summary.shows}</span></div>
                        </div>

                        <div className="done-act">
                            {onQuickView ? (
                                <button type="button" className="btn primary" onClick={onQuickView} disabled={leaving}>
                                    <Icon name="eye" strokeWidth={1.8} />
                                    Quick view
                                </button>
                            ) : null}
                            <button type="button" className="btn" onClick={onClose} disabled={leaving}>Close</button>
                        </div>
                        <span className="done-help">
                            Not quite what you wanted? <a href="#chat" onClick={openChat}>Chat with us</a> and we&rsquo;ll sort it.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
