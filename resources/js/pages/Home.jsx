import { Head, Link } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../css/pages/home.css';

/**
 * The app's home (`/`, DashboardController@index). It answers one question
 * first — are the locks doing anything? — so it opens with the figures, then
 * whether the theme app embed is on, then the fourteen days behind the
 * figures. Everything else is a way out of the page; no work happens here.
 *
 * Design: design-mockup-ink/dashboard.html.
 */

// The rest of what this team makes, from resources/views/partner-apps-dock.blade.php
// (this app — 'locksmith' — is left out of its own list, as the dock does).
// The verb on each button is the mockup's: a thing to do, not a thing to buy.
const PARTNER_APPS = [
    {
        key: 'barcode',
        name: 'Airo Retail Barcode Generator',
        tagline: 'Barcode generator & retail labels — UPC, GTIN, EAN & more',
        url: 'https://apps.shopify.com/airo-sku-barcode-generator',
        logo: 'https://cdn.shopify.com/s/files/1/0718/7723/0786/files/SKU.png?v=1772877734',
        monogram: 'B',
        cta: 'Generate barcodes',
    },
    {
        key: 'flows',
        name: 'Ai Workflow Automation & Flow',
        tagline: 'Enterprise automation platform with integrations & workflows',
        url: 'https://apps.shopify.com/airoflows',
        logo: 'https://cdn.shopify.com/s/files/1/0786/1197/2334/files/Automation.png?v=1772704626',
        monogram: 'W',
        cta: 'Build a workflow',
    },
    {
        key: 'bulk-editor',
        name: 'Airo Bulk Product Editor',
        tagline: 'Smart AI bulk edit — prices, titles, metafields & tags',
        url: 'https://apps.shopify.com/airo-bulk-editor',
        logo: 'https://cdn.shopify.com/app-store/listing_images/a11463ebdf910068e50a071f6bb5affa/icon/CObLs6_Ro5IDEAE=.png',
        monogram: 'E',
        cta: 'Bulk edit products',
    },
    {
        key: 'pos',
        name: 'Restaurant | Cafe: Coffee Shop',
        tagline: 'Run restaurant & cafe POS with KDS, modifiers, tickets & more',
        url: 'https://apps.shopify.com/airo-resturant-pos',
        logo: 'https://cdn.shopify.com/s/files/1/0805/0507/8001/files/Resturant_POS.png?v=1782885897',
        monogram: 'P',
        cta: 'Set up a POS',
    },
    {
        key: 'ymm',
        name: 'Airo YMM Search: Year Make Model',
        tagline: 'Year/Make/Model fitment search — shoppers find parts that fit',
        url: 'https://apps.shopify.com/airo-ymm-search',
        logo: 'https://cdn.shopify.com/app-store/listing_images/4f4b7df715421f63e90c7d56f648f572/icon/CP3Ev-Og9ZUDEAE=.png',
        monogram: 'Y',
        cta: 'Add fitment search',
    },
].filter((app) => app.key !== 'locksmith');

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

// 'YYYY-MM-DD' read as a local date (new Date('2026-10-07') would be UTC).
function dayLabel(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    return {
        day: String(date.getDate()),
        full: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    };
}

/** Opens the Crisp chat (loaded by app.blade.php), optionally with a draft. */
function openChat(draft) {
    const crisp = typeof window !== 'undefined' ? window.$crisp : null;
    if (!crisp || typeof crisp.push !== 'function') return false;
    if (draft) crisp.push(['set', 'message:text', [draft]]);
    crisp.push(['do', 'chat:show']);
    crisp.push(['do', 'chat:open']);
    return true;
}

/* ---------------------------------------------------------------- icons -- */
const svgProps = {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8,
    strokeLinecap: 'round', strokeLinejoin: 'round',
};
const IconLock = () => (
    <svg {...svgProps}><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></svg>
);
const IconUnlock = () => (
    <svg {...svgProps}><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7.5a4 4 0 0 1 7.5-2" /></svg>
);
const IconRunning = () => (
    <svg {...svgProps}><path d="M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
);
const IconBox = () => (
    <svg {...svgProps}><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" /></svg>
);
const IconChat = ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.6-4.8A8.4 8.4 0 0 1 3.6 11 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
    </svg>
);

/* ---------------------------------------------------------------- chart -- */
function AccessChart({ series }) {
    const days = useMemo(() => (series || []).map((d) => ({
        ...dayLabel(d.date),
        total: Number(d.total) || 0,
        granted: Number(d.granted) || 0,
    })), [series]);

    const peak = days.reduce((m, d) => Math.max(m, d.total), 0);
    const peakAt = peak > 0 ? days.findIndex((d) => d.total === peak) : -1;
    const empty = peak === 0;
    // The scale: the busiest day, half of it, and nothing.
    const scale = empty ? ['', '', 0] : [peak, Math.round(peak / 2), 0];

    return (
        <div className="ch-wrap">
            <div className="ch-grid" aria-hidden="true">
                {scale.map((v, i) => (
                    <span key={i} className={`ch-g${i === 2 ? ' base' : ''}`}><b>{v === '' ? '' : fmt(v)}</b></span>
                ))}
            </div>
            <div className="chart" role="list" aria-label="Visitors stopped and let through, per day">
                {days.map((d, i) => {
                    const h = empty ? 0 : Math.round((d.total / peak) * 100);
                    const fill = d.total > 0 ? Math.round((d.granted / d.total) * 100) : 0;
                    const edge = i >= days.length - 2 ? ' edge-r' : (i === 0 ? ' edge-l' : '');
                    const label = `${d.full}: ${fmt(d.total)} stopped, ${fmt(d.granted)} got through`;
                    return (
                        <div
                            key={i}
                            className={`ch-col${i === peakAt ? ' peak' : ''}${edge}`}
                            role="listitem"
                            tabIndex={empty ? -1 : 0}
                            aria-label={label}
                        >
                            <span className="ch-bar" style={{ height: `${h}%` }}>
                                <i style={{ height: `${fill}%` }} />
                            </span>
                            {!empty && (
                                <span className="ch-tip" style={{ bottom: `calc(${h}% + 9px)` }} aria-hidden="true">
                                    <b>{d.full}</b> &middot; {fmt(d.total)} stopped<br />{fmt(d.granted)} got through
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="ch-days" aria-hidden="true">
                {days.map((d, i) => {
                    const last = i === days.length - 1;
                    const cls = i === peakAt ? 'peak' : (last ? 'today' : undefined);
                    return <span key={i} className={cls}>{last ? 'Today' : (i === 0 ? d.full : d.day)}</span>;
                })}
            </div>
            {empty && (
                <div className="ch-empty">
                    <span>No visitor has reached a lock in the last 14 days.</span>
                </div>
            )}
        </div>
    );
}

/* ---------------------------------------------------------------- shelf -- */
function AppShelf() {
    const trackRef = useRef(null);
    const [pages, setPages] = useState(1);
    const [at, setAt] = useState(0);

    // A page is whatever is in view, so the dots count themselves rather
    // than assuming three to a page.
    const measure = useCallback(() => {
        const t = trackRef.current;
        if (!t) return;
        const n = Math.max(1, Math.ceil((t.scrollWidth - 2) / Math.max(1, t.clientWidth)));
        const max = t.scrollWidth - t.clientWidth;
        setPages(n);
        setAt(max <= 0 ? 0 : Math.round((t.scrollLeft / max) * (n - 1)));
    }, []);

    useEffect(() => {
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [measure]);

    const go = (i) => {
        const t = trackRef.current;
        if (!t) return;
        t.scrollTo({ left: Math.min(i * t.clientWidth, t.scrollWidth - t.clientWidth) });
    };

    return (
        <section className="card card-p">
            <span className="sec-t">Recommended apps</span>
            <p className="sec-d">The same team builds these. They run on this store the way your locks do.</p>
            <div
                className="promo-track"
                ref={trackRef}
                tabIndex={0}
                aria-label="Other apps from this team"
                onScroll={measure}
            >
                {PARTNER_APPS.map((app) => (
                    <div className="promo-c" key={app.key}>
                        <div className="promo-h">
                            <span className="app-ic" data-m={app.monogram}>
                                {app.logo && (
                                    <img
                                        src={app.logo}
                                        alt=""
                                        width="34"
                                        height="34"
                                        loading="lazy"
                                        onError={(e) => e.currentTarget.remove()}
                                    />
                                )}
                            </span>
                            <span className="promo-n">{app.name}</span>
                        </div>
                        <p className="promo-t">{app.tagline}</p>
                        <a className="btn" href={app.url} target="_blank" rel="noopener noreferrer">{app.cta}</a>
                    </div>
                ))}
            </div>
            {pages > 1 && (
                <div className="dots" role="tablist" aria-label="More apps">
                    {Array.from({ length: pages }, (_, i) => (
                        <button
                            key={i}
                            type="button"
                            className={`dot${i === at ? ' on' : ''}`}
                            role="tab"
                            aria-selected={i === at}
                            aria-label={`Page ${i + 1}`}
                            onClick={() => go(i)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

/* ------------------------------------------------------- done for you -- */
function SetupRequestModal({ onClose }) {
    const [who, setWho] = useState('');
    const [what, setWhat] = useState('');
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const send = () => {
        const draft = [
            'Please set up a lock for me.',
            who.trim() && `Who should get through: ${who.trim()}`,
            what.trim() && `What everyone else should see: ${what.trim()}`,
        ].filter(Boolean).join('\n');
        if (openChat(draft)) onClose();
        else setFailed(true);
    };

    return (
        <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="modal" style={{ maxWidth: 480 }} role="dialog" aria-modal="true" aria-labelledby="dfyTitle">
                <div className="modal-head">
                    <span className="h-md" id="dfyTitle">Request setup for me</span>
                    <button type="button" className="btn icon" onClick={onClose} aria-label="Close">&times;</button>
                </div>
                <div className="card-p stack g12" style={{ overflowY: 'auto' }}>
                    <p className="sm sub">Describe the result you want in your own words. We build it on your
                        store, test it against your live theme, and leave it switched off until you have
                        looked at it.</p>
                    <label className="field">
                        <span className="label">Who should get through?</span>
                        <textarea
                            className="textarea"
                            rows={3}
                            value={who}
                            onChange={(e) => setWho(e.target.value)}
                            placeholder="Customers tagged wholesale, plus anyone with the passcode TRADE26…"
                        />
                    </label>
                    <label className="field">
                        <span className="label">What should everyone else see?</span>
                        <textarea
                            className="textarea"
                            rows={2}
                            value={what}
                            onChange={(e) => setWhat(e.target.value)}
                            placeholder="Hide the price and show a 'Request trade access' form."
                        />
                    </label>
                    <p className="xs sub">This opens a chat with our team with your answers filled in.</p>
                    {failed && (
                        <p className="xs" style={{ color: 'var(--p-critical-fg)' }}>
                            The chat has not loaded yet. Please try again in a moment.
                        </p>
                    )}
                </div>
                <div className="modal-foot">
                    <button type="button" className="btn" onClick={onClose}>Cancel</button>
                    <button
                        type="button"
                        className="btn primary"
                        onClick={send}
                        disabled={!who.trim() && !what.trim()}
                    >
                        Send request
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ----------------------------------------------------------------- page -- */
export default function Home({
    shopName,
    stats = {},
    series = [],
    extensionEnabled,
    extensionDeepLink,
    plan,
}) {
    const stopped = Number(stats.stopped) || 0;
    const granted = Number(stats.granted) || 0;
    const itemsSecured = Number(stats.itemsSecured) || 0;
    const lockCount = Number(stats.locks) || 0;
    const activeLocks = Number(stats.activeLocks) || 0;
    const pct = stopped > 0 ? Math.round((granted / stopped) * 100) : 0;
    const quiet = stopped === 0;

    /* -------------------------------------------- the theme app embed -- */
    const [embedOn, setEmbedOn] = useState(extensionEnabled !== false);
    const [deepLink, setDeepLink] = useState(extensionDeepLink || '');
    const [checking, setChecking] = useState(false);
    const [checkedLabel, setCheckedLabel] = useState('Checked when this page loaded.');
    const [chatMissing, setChatMissing] = useState(false);
    const [dfyOpen, setDfyOpen] = useState(false);

    const recheck = useCallback(async ({ animate = true } = {}) => {
        if (!window.axios) return;
        if (animate) setChecking(true);
        const started = Date.now();
        try {
            const { data } = await window.axios.get('/extension/status?fresh=1');
            if (data && typeof data.enabled === 'boolean') {
                setEmbedOn(data.enabled);
                if (data.deepLink) setDeepLink(data.deepLink);
            }
            setCheckedLabel('Checked just now.');
        } catch {
            setCheckedLabel('The check did not go through. Try again in a moment.');
        } finally {
            if (animate) {
                // Long enough for the rows to read as being asked again.
                const wait = Math.max(0, 900 - (Date.now() - started));
                setTimeout(() => setChecking(false), wait);
            }
        }
    }, []);

    // While the embed is off, check again when the merchant comes back to the
    // tab — usually straight after switching it on in the theme editor.
    useEffect(() => {
        if (embedOn) return undefined;
        const onFocus = () => {
            if (document.visibilityState === 'visible') recheck({ animate: false });
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [embedOn, recheck]);

    const contact = (draft) => {
        setChatMissing(!openChat(draft));
    };

    /* ---------------------------------------------------------- plan -- */
    const unlimited = plan ? (plan.hasUnlimitedLocks || Number(plan.maxLocks) === 0) : false;
    const used = plan ? Number(plan.currentLocks ?? lockCount) || 0 : 0;
    const max = plan ? Number(plan.maxLocks) || 0 : 0;
    const usedPct = !unlimited && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;

    const greetingName = (shopName || '').trim();

    return (
        <div className="airo pg-home">
            <Head title="Dashboard" />
            <main className="page full">

                {/* Who you are and what this is. */}
                <div className="hi between wrap g12">
                    <div>
                        <h1 className="hi-t">{greetingName ? `Hi ${greetingName}` : 'Hi there'}</h1>
                        <p className="sm sub mt4">
                            {quiet
                                ? (lockCount === 0
                                    ? 'You have no locks yet. Once you add one and a visitor reaches it, what it did shows up here.'
                                    : 'Nothing has reached a lock in the last 30 days. When a visitor does, it shows up here.')
                                : 'Here is what your locks did over the last 30 days.'}
                        </p>
                    </div>
                    {lockCount === 0 && (
                        <Link className="btn primary" href="/lock/create">Create a lock</Link>
                    )}
                </div>

                {/* The figures, and where each of them is answered. */}
                <div className="stat-row">
                    <Link className="stat" href="/locks">
                        <span className="stat-ico info" aria-hidden="true"><IconLock /></span>
                        <span>
                            <span className="stat-v">{fmt(stopped)}</span>
                            <span className="stat-l">Visitors stopped</span>
                            <span className="stat-note">Reached something locked</span>
                        </span>
                    </Link>
                    <Link className="stat" href="/locks">
                        <span className="stat-ico good" aria-hidden="true"><IconUnlock /></span>
                        <span>
                            <span className="stat-v">{fmt(granted)}</span>
                            <span className="stat-l">Got through</span>
                            <span className="stat-note">
                                {stopped > 0 ? `${pct}% of everyone stopped` : 'Nobody stopped yet'}
                            </span>
                        </span>
                    </Link>
                    <Link className="stat" href="/locks">
                        <span className="stat-ico warn" aria-hidden="true"><IconRunning /></span>
                        <span>
                            <span className="stat-v">{fmt(activeLocks)}</span>
                            <span className="stat-l">Locks running</span>
                            <span className="stat-note">
                                {lockCount === 0 ? 'No locks yet' : `Of ${fmt(lockCount)} ${lockCount === 1 ? 'lock' : 'locks'}`}
                            </span>
                        </span>
                    </Link>
                    <Link className="stat" href="/locks">
                        <span className="stat-ico brand" aria-hidden="true"><IconBox /></span>
                        <span>
                            <span className="stat-v">{fmt(itemsSecured)}</span>
                            <span className="stat-l">Items secured</span>
                            <span className="stat-note">Products, pages, collections</span>
                        </span>
                    </Link>
                </div>

                {/* Set it up for you, directly under the figures. */}
                <div className="dfy">
                    <div className="grow">
                        <span className="dfy-t">Would you rather we set it up for you?</span>
                        <p className="dfy-d">Tell us who should get through and what they should see. We build
                            the locks on your store, test them against your theme, and hand them back
                            ready to switch on.</p>
                    </div>

                    <button type="button" className="btn primary dfy-go" onClick={() => setDfyOpen(true)}>
                        Request setup for me
                    </button>

                    <svg className="dfy-art" viewBox="0 0 148 112" fill="none" stroke="currentColor"
                         strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <g className="gearA" opacity=".34">
                            <circle cx="34" cy="40" r="13" />
                            <path d="M34 22v5M34 53v5M16 40h5M47 40h5M22 28l3.5 3.5M42.5 48.5L46 52M46 28l-3.5 3.5M25.5 48.5L22 52" />
                        </g>
                        <g className="gearB" opacity=".34">
                            <circle cx="112" cy="72" r="10" />
                            <path d="M112 58v4M112 82v4M98 72h4M122 72h4M102 62l3 3M119 79l3 3M122 62l-3 3M105 79l-3 3" />
                        </g>
                        <g className="dfy-lock">
                            <rect x="55" y="52" width="36" height="27" rx="7" fill="var(--p-surface, #fff)" />
                            <path d="M63 52v-8a10 10 0 0 1 20 0v8" />
                            <path d="M73 63v6" />
                        </g>
                        <path className="spark" d="M104 28v8M100 32h8" strokeWidth="2.6" opacity="0" />
                        <path className="spark" d="M30 82v6M27 85h6" strokeWidth="2.6" opacity="0" />
                    </svg>
                </div>

                <div className="home">
                    <div className="home-main">

                        {/* With the theme app embed off, every lock is inert and
                            everything below is history. The headline is read
                            from the same state as the embed row. */}
                        <section className="card">
                            <div className="card-sec">
                                <div className="sec-head">
                                    <div className="grow">
                                        <span className="sec-t">
                                            App extensions
                                            {!embedOn && <span className="badge warning">1 switched off</span>}
                                        </span>
                                        <p className="sec-d">What Airo has installed in your theme, your checkout
                                            and Shopify Flow.</p>
                                    </div>
                                    <button type="button" className="btn" onClick={() => recheck()} disabled={checking}>
                                        {checking ? 'Checking…' : 'Re-check'}
                                    </button>
                                </div>
                                <div className={`run${embedOn ? '' : ' off'}`}>
                                    <span className="run-ic" aria-hidden="true" />
                                    <span className="grow">
                                        <span className="run-t">
                                            {embedOn ? 'Your locks are running on your storefront' : 'Your locks are not running'}
                                        </span>
                                        <span className="run-d">
                                            {embedOn
                                                ? 'The theme app embed is on, so every lock you switch on takes effect.'
                                                : 'The theme app embed is off, so nothing below is being enforced.'}
                                        </span>
                                    </span>
                                    {!embedOn && deepLink && (
                                        <a className="btn primary" href={deepLink} target="_blank" rel="noopener noreferrer">
                                            Turn it on
                                        </a>
                                    )}
                                </div>
                                <p className="xs sub" style={{ marginTop: 10 }} aria-live="polite">{checkedLabel}</p>
                            </div>

                            <div className={`ext${embedOn ? '' : ' off'}${checking ? ' checking' : ''}`}>
                                <span className="ext-ico" aria-hidden="true">
                                    <svg width="17" height="17" {...svgProps}>
                                        <path d="M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9" /><path d="M9 20v-6h6v6" />
                                    </svg>
                                </span>
                                <div className="grow">
                                    <span className="ext-n">Theme app embed
                                        <span className="xs sub" style={{ fontWeight: 450 }}>Access Control</span></span>
                                    <p className="ext-d">Loads your locks on every storefront page.</p>
                                    <p className="ext-h">Reading the live theme&rsquo;s settings&hellip;</p>
                                </div>
                                <span className="ext-spin" aria-hidden="true" />
                                <span className={`badge${embedOn ? ' success' : ''}`}>{embedOn ? 'On' : 'Off'}</span>
                                {deepLink && (
                                    <a
                                        className={`btn${embedOn ? '' : ' primary'}`}
                                        href={deepLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        App embed settings
                                    </a>
                                )}
                            </div>

                            <div className={`ext${checking ? ' checking' : ''}`}>
                                <span className="ext-ico" aria-hidden="true">
                                    <svg width="17" height="17" {...svgProps}>
                                        <path d="M3 5h2l2.2 10.4a2 2 0 0 0 2 1.6h7.5a2 2 0 0 0 2-1.5L20 8H6" />
                                        <circle cx="10" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" />
                                    </svg>
                                </span>
                                <div className="grow">
                                    <span className="ext-n">Checkout block</span>
                                    <p className="ext-d">Shows the lock&rsquo;s message in checkout when a cart
                                        holds something the shopper cannot buy. Shopify only shows app blocks
                                        in checkout on Plus.</p>
                                    <p className="ext-h">Reading your checkout profile&hellip;</p>
                                </div>
                                <span className="ext-spin" aria-hidden="true" />
                                <span className="badge">Plus only</span>
                                <a className="btn" href="shopify://admin/settings/checkout" target="_top">Checkout editor</a>
                            </div>

                            <div className={`ext${checking ? ' checking' : ''}`}>
                                <span className="ext-ico" aria-hidden="true">
                                    <svg width="17" height="17" {...svgProps}>
                                        <path d="M12 3l8 3v6c0 5-3.4 8.3-8 9-4.6-.7-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" />
                                    </svg>
                                </span>
                                <div className="grow">
                                    <span className="ext-n">Checkout validation</span>
                                    <p className="ext-d">Hard enforcement &mdash; the order cannot be placed at
                                        all. Shopify only allows this on Plus.</p>
                                    <p className="ext-h">Checking your plan with Shopify&hellip;</p>
                                </div>
                                <span className="ext-spin" aria-hidden="true" />
                                <span className="badge">Plus only</span>
                                <a className="btn" href="shopify://admin/settings/checkout" target="_top">Checkout rules</a>
                            </div>

                            <div className={`ext${checking ? ' checking' : ''}`}>
                                <span className="ext-ico" aria-hidden="true">
                                    <svg width="17" height="17" {...svgProps}>
                                        <circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" />
                                        <path d="M8.5 6H14a4 4 0 0 1 0 8H9.5" />
                                    </svg>
                                </span>
                                <div className="grow">
                                    <span className="ext-n">Shopify Flow</span>
                                    <p className="ext-d">5 triggers and 3 actions &mdash; grant access, revoke it,
                                        tag a customer, or react to a request.</p>
                                    <p className="ext-h">Asking Flow which of ours it can see&hellip;</p>
                                </div>
                                <span className="ext-spin" aria-hidden="true" />
                                <span className="badge info">Included</span>
                                <a className="btn" href="shopify://admin/apps/flow" target="_top">Open Flow</a>
                            </div>
                        </section>

                        {/* The fourteen days behind the figures. */}
                        <section className="card">
                            <div className="card-sec">
                                <div className="sec-head">
                                    <div className="grow">
                                        <span className="sec-t">Access over the last 14 days</span>
                                        <p className="sec-d">Every visitor a lock stopped, and how many of them
                                            got through it.</p>
                                    </div>
                                    <span className="key" aria-hidden="true">
                                        <span><i style={{ background: 'var(--accent)' }} />Got through</span>
                                        <span><i style={{ background: '#ececec' }} />Stopped</span>
                                    </span>
                                </div>
                                <AccessChart series={series} />
                            </div>
                        </section>

                        <AppShelf />
                    </div>

                    {/* ------------------------------------------------- rail */}
                    <aside className="home-rail">
                        {plan && (
                            <section className="card card-p">
                                <div className="between g12">
                                    <span className="sec-t">Plan &amp; usage</span>
                                    <span className="plan-badge" title={plan.name}>{plan.name}</span>
                                </div>
                                <p className="sec-d">
                                    {plan.isTrial
                                        ? `Free trial · ${fmt(plan.daysRemaining)} ${Number(plan.daysRemaining) === 1 ? 'day' : 'days'} left`
                                        : 'Your current plan'}
                                </p>

                                {unlimited ? (
                                    <div className="between" style={{ margin: '14px 0 0' }}>
                                        <span className="sm"><strong>{fmt(used)}</strong> {used === 1 ? 'lock' : 'locks'}</span>
                                        <span className="xs sub">Unlimited locks</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="between" style={{ margin: '14px 0 6px' }}>
                                            <span className="sm"><strong>{fmt(used)} of {fmt(max)}</strong> locks used</span>
                                            <span className="xs sub">{fmt(Math.max(0, max - used))} left</span>
                                        </div>
                                        <div
                                            className={`bar${usedPct >= 100 ? ' full' : ''}`}
                                            role="progressbar"
                                            aria-valuemin={0}
                                            aria-valuemax={max}
                                            aria-valuenow={used}
                                            aria-label="Locks used"
                                        >
                                            <i style={{ width: `${usedPct}%` }} />
                                        </div>
                                    </>
                                )}

                                <Link className="btn full mt16" href="/pricing">View plans</Link>
                            </section>
                        )}

                        <section className="card card-p">
                            <span className="sec-t">Help &amp; support</span>
                            <p className="sec-d">A real person answers in the app.</p>

                            <button type="button" className="btn primary full mt16" onClick={() => contact()}>
                                <IconChat />
                                Contact us
                            </button>
                            {chatMissing && (
                                <p className="xs sub mt8" aria-live="polite">
                                    The chat has not loaded yet. Please try again in a moment.
                                </p>
                            )}

                            <div className="help-l">
                                <Link href="/onboarding">
                                    <svg width="15" height="15" {...svgProps}>
                                        <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z" />
                                        <path d="M8 7h8M8 11h6" />
                                    </svg>
                                    Setup guide
                                </Link>
                                <button type="button" onClick={() => contact('I would like to request a feature: ')}>
                                    <svg width="15" height="15" {...svgProps}>
                                        <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z" />
                                    </svg>
                                    Request a feature
                                </button>
                            </div>
                        </section>
                    </aside>
                </div>
            </main>

            {dfyOpen && <SetupRequestModal onClose={() => setDfyOpen(false)} />}
        </div>
    );
}
