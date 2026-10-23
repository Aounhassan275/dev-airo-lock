import { router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import '../../css/pages/plans.css';

// ── Icons (inline strokes from design-mockup-ink/plans.html) ────────────────
const IconBolt = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </svg>
);
const IconShield = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
    </svg>
);
const IconStar = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l1.9 4.6 5 .4-3.8 3.3 1.2 4.9L12 13.6 7.7 16.2l1.2-4.9L5.1 8l5-.4z" />
    </svg>
);
const IconCrown = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7l4 5 5-7 5 7 4-5v11H3z" />
    </svg>
);
const Tick = ({ className = undefined, label = undefined }) => (
    <svg
        className={className}
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke={className ? 'currentColor' : '#0c5132'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={label ? undefined : 'true'}
        aria-label={label}
        role={label ? 'img' : undefined}
    >
        <path d="M5 13l4 4L19 7" />
    </svg>
);
const Chevron = ({ className }) => (
    <svg className={className} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
    </svg>
);

const PLAN_ICONS = { Free: IconBolt, Basic: IconShield, Pro: IconStar, Unlimited: IconCrown };

const TRIAL_NOTE_KEY = 'airo.plans.trialNoteDismissed';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

// Server dates are 'YYYY-MM-DD'; read them as UTC so the day never shifts.
const formatDate = (s) => {
    if (!s) return null;
    const d = new Date(`${String(s).slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const lockLabel = (maxLocks) =>
    maxLocks === 0 ? 'Unlimited content locks' : maxLocks === 1 ? '1 content lock' : `Up to ${maxLocks} content locks`;

const lockCount = (maxLocks) => (maxLocks === 0 ? 'Unlimited' : String(maxLocks));

export default function Plans() {
    const { plans = [], currentPlanId, billing } = usePage().props;

    const [loadingPlanId, setLoadingPlanId] = useState(null);
    const [error, setError] = useState(null);
    // Downgrading from a paid plan to Free cancels the subscription
    // immediately (no Shopify approval screen), so it takes a second click.
    const [confirmingFreeId, setConfirmingFreeId] = useState(null);
    const [compareOpen, setCompareOpen] = useState(false);
    const [openFaq, setOpenFaq] = useState(null);
    const [trialNoteHidden, setTrialNoteHidden] = useState(() => {
        try {
            return window.localStorage.getItem(TRIAL_NOTE_KEY) === '1';
        } catch {
            return false;
        }
    });

    // The App Bridge contextual save bar survives SPA navigation from the
    // lock builder — if one is still up when the merchant lands here (e.g.
    // via an upgrade badge), it blocks the whole admin top bar. Clear it.
    useEffect(() => {
        window.shopify?.saveBar?.hide('my-save-bar')?.catch?.(() => {});
        window.shopify?.saveBar?.hide('lock-save-bar')?.catch?.(() => {});
    }, []);

    // ── Detect which billing cycles actually exist in the DB ──────────────────
    const hasAnnual = plans.some((p) => p.interval === 'ANNUAL' && p.raw_price > 0);
    const hasMonthly = plans.some((p) => p.interval === 'EVERY_30_DAYS' && p.raw_price > 0);

    // Default to the current plan's cycle; otherwise monthly.
    const currentPlan = plans.find((p) => p.id === currentPlanId);
    const freePlan = plans.find((p) => p.raw_price === 0) || null;
    const defaultCycle = currentPlan?.interval === 'ANNUAL' ? 'yearly' : hasMonthly ? 'monthly' : hasAnnual ? 'yearly' : 'monthly';
    const [billingCycle, setBillingCycle] = useState(defaultCycle);

    const showToggle = hasMonthly && hasAnnual;

    // The saving the "Annually" pill promises, computed from the real
    // monthly/annual pairs (smallest one, so it never overclaims).
    const annualSaving = useMemo(() => {
        const pcts = plans
            .filter((p) => p.interval === 'ANNUAL' && p.raw_price > 0)
            .map((a) => {
                const m = plans.find((p) => p.interval === 'EVERY_30_DAYS' && p.name === a.name && p.raw_price > 0);
                return m ? 1 - a.raw_price / (m.raw_price * 12) : null;
            })
            .filter((x) => x !== null);
        if (!pcts.length) return 0;
        return Math.round(Math.min(...pcts) * 100);
    }, [plans]);

    const handleSelectPlan = async (plan) => {
        const isFreeDowngrade = plan.raw_price === 0 && billing?.hasPlan && Number(billing.planPrice) > 0;
        if (isFreeDowngrade && confirmingFreeId !== plan.id) {
            setConfirmingFreeId(plan.id);
            setError(null);
            return;
        }
        setConfirmingFreeId(null);
        setLoadingPlanId(plan.id);
        setError(null);

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const host = urlParams.get('host') || '';

            const response = await fetch(`/pricing/select/${plan.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                },
                body: JSON.stringify({ host }),
            });

            const data = await response.json().catch(() => null);

            if (response.ok && data?.freePlanActivated) {
                // Free plan is applied server-side with no approval screen —
                // refresh the page props so the card flips to "Current plan".
                router.reload({ onFinish: () => setLoadingPlanId(null) });
            } else if (response.ok && data?.redirectUrl) {
                // Off to Shopify's charge-approval screen (top-level, embedded admin).
                window.open(data.redirectUrl, '_top');
            } else {
                setError(data?.message || 'Failed to select plan. Please try again.');
                setLoadingPlanId(null);
            }
        } catch {
            setError('Failed to select plan. Please try again.');
            setLoadingPlanId(null);
        }
    };

    // ===== PLAN PROCESSING =====
    // Free is the first card; the paid cards follow the billing period.
    const cards = useMemo(() => {
        let paid = plans.filter((plan) => {
            if (plan.raw_price === 0) return false;
            if (billingCycle === 'monthly') return plan.interval === 'EVERY_30_DAYS';
            return plan.interval === 'ANNUAL';
        });
        if (paid.length === 0) paid = plans.filter((p) => p.raw_price !== 0);

        const sorted = [...paid].sort((a, b) => (a.raw_price || 0) - (b.raw_price || 0));
        const list = freePlan ? [freePlan, ...sorted] : sorted;

        return list.map((plan, i) => {
            const isFree = plan.raw_price === 0;
            const isAnnual = plan.interval === 'ANNUAL';
            const features = plan.features || [];
            const prev = i > 0 ? list[i - 1] : null;
            const prevFeatures = prev?.features || [];
            const inherits = prev && prevFeatures.length > 0 && prevFeatures.every((f) => features.includes(f));

            return {
                ...plan,
                isFree,
                priceText: isFree ? '$0' : money(isAnnual ? plan.raw_price / 12 : plan.raw_price),
                billText: isFree
                    ? 'no card, no expiry'
                    : isAnnual
                        ? `billed yearly · ${money(plan.raw_price)} a year`
                        : 'billed monthly',
                inheritsFrom: inherits ? prev.name : null,
                newFeatures: inherits ? features.filter((f) => !prevFeatures.includes(f)) : features,
            };
        });
    }, [plans, billingCycle, freePlan]);

    const isCurrentPlan = (planId) => currentPlanId === planId;

    // One claim per card: the recommendation is the admin-flagged popular
    // plan, otherwise the top tier — and never the plan you are already on.
    const recommended = useMemo(() => {
        const paid = cards.filter((c) => !c.isFree);
        if (!paid.length) return null;
        const flagged = paid.find((c) => c.is_popular);
        if (flagged) return flagged.id === currentPlanId ? null : { id: flagged.id, label: 'Most popular' };
        const top = paid[paid.length - 1];
        return top.id === currentPlanId ? null : { id: top.id, label: 'Best value' };
    }, [cards, currentPlanId]);

    // The trial, stated once.
    const trialDays = cards.filter((c) => !c.isFree).map((c) => c.trial_days || 0);
    const maxTrial = trialDays.length ? Math.max(...trialDays) : 0;
    const uniformTrial = maxTrial > 0 && trialDays.every((d) => d === maxTrial);

    const dismissTrialNote = () => {
        setTrialNoteHidden(true);
        try {
            window.localStorage.setItem(TRIAL_NOTE_KEY, '1');
        } catch {
            // Storage blocked — the note just comes back next visit.
        }
    };

    // Compare table rows, built from the plans' own features and limits.
    const compareRows = useMemo(() => {
        const labels = [];
        cards.forEach((c) => (c.features || []).forEach((f) => {
            if (!labels.includes(f)) labels.push(f);
        }));
        return labels;
    }, [cards]);

    // Usage strip data (shared billing prop from the backend).
    const usage = billing || null;
    const showUsage = usage && (usage.hasPlan || usage.freeAccess);
    const usageName = usage?.planName || (usage?.freeAccess ? 'Free access' : null);
    const usageSub = (() => {
        if (!usage) return null;
        const price = Number(usage.planPrice) > 0
            ? `${money(usage.planPrice)} a ${usage.planInterval === 'ANNUAL' ? 'year' : 'month'}`
            : null;
        let when = null;
        if (usage.isTrial) {
            when = `Free trial · ${usage.trialDaysRemaining} day${usage.trialDaysRemaining !== 1 ? 's' : ''} left`
                + (usage.trialEndsOn ? ` · ends ${formatDate(usage.trialEndsOn)}` : '');
        } else if (usage.billingOn) {
            when = `Renews ${formatDate(usage.billingOn)}`;
        } else if (usage.freeAccess && !usage.hasPlan) {
            when = 'Complimentary access for this store';
        } else if (usage.hasPlan && !(Number(usage.planPrice) > 0)) {
            when = 'Free, no expiry';
        }
        return [price, when].filter(Boolean).join(' · ');
    })();
    const meterPct = usage && !usage.hasUnlimitedLocks && usage.maxLocks > 0
        ? Math.min(100, Math.round((usage.locksUsed / usage.maxLocks) * 100))
        : 0;

    const paidToFree = billing?.hasPlan && Number(billing.planPrice) > 0;

    const faqs = [
        {
            q: 'Do I have to edit my theme?',
            a: <>No. Airo runs through a theme app embed &mdash; you switch it on once in the theme editor, and setup links you straight to it.</>,
        },
        {
            q: 'How am I billed?',
            a: <>Through Shopify. The charge appears on your Shopify invoice{maxTrial > 0
                ? (uniformTrial
                    ? `, and every paid plan starts with a ${maxTrial}-day free trial`
                    : `, and paid plans start with a free trial of up to ${maxTrial} days`)
                : ''}.</>,
        },
        {
            q: 'What happens if I downgrade?',
            a: <>Nothing is deleted. A plan sets how many locks you can have; past that the app stops you creating more rather than removing what you already built.</>,
        },
        {
            q: 'Will Google index a locked page?',
            a: <>Only if you let it. Each lock has <strong>Hide from search engines</strong>, which adds a noindex tag to the page it protects.</>,
        },
        {
            q: 'Can several locks share one design?',
            a: <>Yes. A widget holds the colours and shape, and any lock can use it &mdash; while the wording can still differ lock by lock.</>,
        },
        {
            q: 'Does it work at checkout?',
            a: <>On Shopify Plus, yes: a checkout block shows the lock&rsquo;s message, and a validation function stops the order being placed.</>,
        },
    ];

    const renderButton = (plan, isCurrent) => {
        if (isCurrent) {
            return (
                <button type="button" className="btn full have mt16" aria-disabled="true">
                    Your current plan
                </button>
            );
        }
        const confirming = confirmingFreeId === plan.id;
        return (
            <button
                type="button"
                className={`btn full mt16 ${confirming ? 'warn' : 'primary'}`}
                onClick={() => handleSelectPlan(plan)}
                disabled={loadingPlanId !== null}
            >
                {loadingPlanId === plan.id ? (
                    <><span className="btn-spin" aria-hidden="true" /> Processing&hellip;</>
                ) : confirming ? 'Confirm switch to Free'
                    : plan.isFree ? 'Start free'
                    : 'Select plan'}
            </button>
        );
    };

    return (
        <div className="airo pg-plans">
            <main className="page full">

                <div className="center" style={{ marginBottom: 12 }}>
                    <h1 className="plans-title">Subscriptions</h1>
                    <p className="sub mt4 plans-lede">
                        Choose the perfect plan for your store. Upgrade or downgrade anytime &mdash; billed securely through Shopify.
                    </p>
                </div>

                {/* What you are on, in the same card the lock list uses. */}
                {showUsage && (
                    <div className="usage">
                        {usageName && <span className="usage-badge">{usageName}</span>}
                        <div>
                            <span className="usage-name">{usage.planName ? `${usage.planName} plan` : 'Free access'}</span>
                            {usageSub && <span className="usage-sub">{usageSub}</span>}
                        </div>
                        <div className="usage-meter">
                            {usage.hasUnlimitedLocks ? (
                                <div className="between">
                                    <span className="sm">
                                        <strong>{usage.locksUsed}</strong> lock{usage.locksUsed !== 1 ? 's' : ''} in use
                                    </span>
                                    <span className="xs sub">Unlimited</span>
                                </div>
                            ) : (
                                <>
                                    <div className="between" style={{ marginBottom: 6 }}>
                                        <span className="sm"><strong>{usage.locksUsed} of {usage.maxLocks}</strong> locks used</span>
                                        <span className="xs sub">{usage.remainingLocks ?? 0} remaining</span>
                                    </div>
                                    <div className={`usage-bar${usage.limitReached ? ' full' : ''}`}>
                                        <i style={{ width: `${meterPct}%` }} />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Test billing mode notice. */}
                {usage?.testMode && (
                    <div className="trial warn" role="status">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17.5v.01" />
                        </svg>
                        <span className="trial-d" style={{ marginTop: 0 }}>
                            {usage.isDevStore
                                ? 'Development store — subscriptions here are created as Shopify TEST charges (you will not be billed).'
                                : 'Test billing mode is enabled for this store — subscriptions are Shopify TEST charges.'}
                        </span>
                    </div>
                )}

                {/* The trial, said once at the top. */}
                {maxTrial > 0 && !trialNoteHidden && (
                    <div className="trial">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" /><path d="M12 8v4.5l3 1.8M12 16.5v.01" />
                        </svg>
                        <span>
                            <span className="trial-t">
                                {uniformTrial
                                    ? `Every paid plan starts with ${maxTrial} days free`
                                    : `Paid plans start with up to ${maxTrial} days free`}
                            </span>
                            <span className="trial-d">
                                Shopify only charges you when it ends. Cancel before then and you pay nothing.
                            </span>
                        </span>
                        <button type="button" className="btn" aria-label="Dismiss" onClick={dismissTrialNote}>&#10005;</button>
                    </div>
                )}

                {error && (
                    <div className="trial err" role="alert">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"
                             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" />
                        </svg>
                        <span className="trial-d" style={{ marginTop: 0 }}>{error}</span>
                        <button type="button" className="btn" aria-label="Dismiss" onClick={() => setError(null)}>&#10005;</button>
                    </div>
                )}

                {showToggle && (
                    <div className="row" style={{ justifyContent: 'center', marginBottom: 20 }}>
                        <div className="cycle" role="group" aria-label="Billing period">
                            <button
                                type="button"
                                className={billingCycle === 'monthly' ? 'on' : ''}
                                aria-pressed={billingCycle === 'monthly'}
                                onClick={() => setBillingCycle('monthly')}
                            >
                                Monthly
                            </button>
                            <button
                                type="button"
                                className={billingCycle === 'yearly' ? 'on' : ''}
                                aria-pressed={billingCycle === 'yearly'}
                                onClick={() => setBillingCycle('yearly')}
                            >
                                Annually
                                {annualSaving > 0 && <span className="off-pill">&minus;{annualSaving}%</span>}
                            </button>
                        </div>
                    </div>
                )}

                {cards.length === 0 ? (
                    <div className="center sub" style={{ padding: 40, fontSize: 14 }}>
                        No plans available. Please contact support.
                    </div>
                ) : (
                    <div
                        className={`plan-grid${cards.length >= 4 ? ' cols-4' : ''}`}
                        style={{ '--plan-cols': Math.min(cards.length, 4) }}
                    >
                        {cards.map((plan) => {
                            const isCurrent = isCurrentPlan(plan.id);
                            const isBest = recommended?.id === plan.id;
                            const Icon = PLAN_ICONS[plan.name] || (plan.isFree ? IconBolt : IconStar);
                            const confirming = confirmingFreeId === plan.id;

                            return (
                                <div key={plan.id} className={`plan${isCurrent ? ' current' : ''}${isBest ? ' best' : ''}`}>
                                    {isBest && <span className="plan-badge">{recommended.label}</span>}
                                    <div className="row g8">
                                        <span className="plan-ico" aria-hidden="true"><Icon /></span>
                                        <span className="strong plan-name">{plan.name}</span>
                                        {isCurrent && <span className="tag now" style={{ marginLeft: 'auto' }}>Current plan</span>}
                                    </div>
                                    <p className="xs sub mt4">{plan.description}</p>

                                    <div className="mt16">
                                        <span className="plan-price">{plan.priceText}</span>
                                        <span className="xs sub">/mo</span>
                                    </div>
                                    <p className="xs sub plan-bill">{plan.billText}</p>

                                    {renderButton(plan, isCurrent)}

                                    {plan.isFree && !isCurrent && paidToFree && (
                                        <p className="xs plan-note">
                                            {confirming
                                                ? 'Switching to Free cancels your current subscription immediately — click again to confirm.'
                                                : 'Switching to Free cancels your paid subscription straight away.'}
                                        </p>
                                    )}

                                    <div className="stack g8 plan-feats">
                                        <span className="feat lead"><Tick />{lockLabel(plan.max_locks)}</span>
                                        {plan.inheritsFrom && (
                                            <span className="feat"><Tick />Everything in {plan.inheritsFrom}</span>
                                        )}
                                        {plan.newFeatures.map((f) => (
                                            <span key={f} className="feat"><Tick />{f}</span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Three feature lists cannot be read against each other; a table can. */}
                {cards.length > 1 && (
                    <>
                        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
                            <button
                                type="button"
                                className="btn cmp-btn"
                                aria-expanded={compareOpen}
                                aria-controls="plans-cmp"
                                onClick={() => setCompareOpen((o) => !o)}
                            >
                                Compare plans
                                <Chevron className="cmp-chev" />
                            </button>
                        </div>

                        <section className={`band${compareOpen ? '' : ' hide'}`} id="plans-cmp" style={{ marginTop: 14 }}>
                            <div className="band-h">
                                <span className="sec-h2">Every plan, side by side</span>
                                {usage?.planName && (
                                    <span className="xs sub">Your plan: <strong>{usage.planName}</strong></span>
                                )}
                            </div>
                            <div className="cmp-scroll">
                                <table className="cmp">
                                    <thead>
                                        <tr>
                                            <th scope="col">Feature</th>
                                            {cards.map((c) => (
                                                <th key={c.id} scope="col" className={isCurrentPlan(c.id) ? 'now' : undefined}>{c.name}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <th scope="row">Locks you can have</th>
                                            {cards.map((c) => <td key={c.id}>{lockCount(c.max_locks)}</td>)}
                                        </tr>
                                        {compareRows.map((label) => (
                                            <tr key={label}>
                                                <th scope="row">{label}</th>
                                                {cards.map((c) => (
                                                    <td key={c.id}>
                                                        {(c.features || []).includes(label)
                                                            ? <Tick className="t-yes" label="Included" />
                                                            : <span className="t-no" aria-label="Not included">&mdash;</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                        {maxTrial > 0 && (
                                            <tr>
                                                <th scope="row">Free trial</th>
                                                {cards.map((c) => (
                                                    <td key={c.id}>
                                                        {c.trial_days > 0
                                                            ? `${c.trial_days} days`
                                                            : <span className="t-no" aria-label="None">&mdash;</span>}
                                                    </td>
                                                ))}
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}

                {/* The questions that decide whether a merchant pays. */}
                <section className="band" style={{ marginBottom: 10 }}>
                    <div className="faq-head">
                        <span className="faq-t">Frequently asked questions</span>
                    </div>
                    {faqs.map((f, i) => (
                        <div className="faq-i" key={f.q}>
                            <button
                                type="button"
                                className="faq-q"
                                aria-expanded={openFaq === i}
                                aria-controls={`plans-faq-${i}`}
                                onClick={() => setOpenFaq((cur) => (cur === i ? null : i))}
                            >
                                {f.q}
                                <span className="faq-chev"><Chevron /></span>
                            </button>
                            <div className={`faq-a${openFaq === i ? '' : ' hide'}`} id={`plans-faq-${i}`}>{f.a}</div>
                        </div>
                    ))}
                </section>
            </main>
        </div>
    );
}
