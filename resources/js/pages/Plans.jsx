import { router, usePage } from '@inertiajs/react';
import { Page, Text } from '@shopify/polaris';
import { Check, Crown, Lock, Shield, Sparkles, Star, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

// Icon + fallback features per tier. Feature lists normally come from the
// backend (plans.features JSON, managed in the admin panel); these are only
// used when a plan row has none.
const PLAN_META = {
    Basic: {
        icon: Zap,
        tagline: 'Perfect for getting started',
        fallbackFeatures: [
            'Lock products, collections, pages & blogs',
            'Passcode & sign-in access rules',
            'Email support',
        ],
    },
    Pro: {
        icon: Sparkles,
        tagline: 'Most popular for growing stores',
        fallbackFeatures: [
            'Everything in Basic',
            'Secret links & customer tag access',
            'Hide prices from guests',
            'Scheduled locks & variant locking',
            'Priority email support',
        ],
    },
    Unlimited: {
        icon: Crown,
        tagline: 'For enterprise-level control',
        fallbackFeatures: [
            'Everything in Pro',
            'Unlimited content locks',
            'Lock the entire store & checkout',
            'Location & IP based rules',
            'Dedicated priority support',
        ],
    },
};

export default function Plans() {
    const { plans, currentPlanId, billing } = usePage().props;

    const [loadingPlanId, setLoadingPlanId] = useState(null);
    const [error, setError] = useState(null);
    // Downgrading from a paid plan to Free cancels the subscription
    // immediately (no Shopify approval screen), so it takes a second click.
    const [confirmingFreeId, setConfirmingFreeId] = useState(null);

    // The App Bridge contextual save bar survives SPA navigation from the
    // lock builder — if one is still up when the merchant lands here (e.g.
    // via an upgrade badge), it blocks the whole admin top bar. Clear it.
    useEffect(() => {
        window.shopify?.saveBar?.hide('my-save-bar')?.catch?.(() => {});
        window.shopify?.saveBar?.hide('lock-save-bar')?.catch?.(() => {});
    }, []);

    // ── Detect which billing cycles actually exist in the DB ──────────────────
    const hasAnnual = plans.some((p) => p.interval === 'ANNUAL');
    const hasMonthly = plans.some((p) => p.interval === 'EVERY_30_DAYS');

    // Default to the current plan's cycle; otherwise monthly.
    const currentPlan = plans.find((p) => p.id === currentPlanId);
    // Rendered as a quiet strip below the paid grid — attention stays on paid plans.
    const freePlan = plans.find((p) => p.raw_price === 0) || null;
    const defaultCycle = currentPlan?.interval === 'ANNUAL' ? 'yearly' : hasMonthly ? 'monthly' : hasAnnual ? 'yearly' : 'monthly';
    const [billingCycle, setBillingCycle] = useState(defaultCycle);

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
                // refresh the page props so the card flips to "Current Plan".
                router.reload({ onFinish: () => setLoadingPlanId(null) });
            } else if (response.ok && data?.redirectUrl) {
                // Off to Shopify's charge-approval screen (top-level, embedded admin).
                window.open(data.redirectUrl, '_top');
            } else {
                setError(data?.message || 'Failed to select plan. Please try again.');
                setLoadingPlanId(null);
            }
        } catch (err) {
            setError('Failed to select plan. Please try again.');
            setLoadingPlanId(null);
        }
    };

    // ===== PLAN PROCESSING =====
    const displayPlans = useMemo(() => {
        let filtered = plans.filter((plan) => {
            if (plan.raw_price === 0) return false; // Free renders as a quiet strip below the grid
            if (billingCycle === 'monthly') return plan.interval === 'EVERY_30_DAYS';
            return plan.interval === 'ANNUAL';
        });

        if (filtered.length === 0) {
            filtered = plans;
        }

        const sorted = [...filtered].sort((a, b) => (a.raw_price || 0) - (b.raw_price || 0));
        const monthlyPlans = plans.filter((p) => p.interval === 'EVERY_30_DAYS');

        if (billingCycle === 'yearly') {
            return sorted.map((plan) => {
                const monthlyEquivalent = (plan.raw_price || 0) / 12;
                const monthlyPlan = monthlyPlans.find((m) => m.name === plan.name);

                return {
                    ...plan,
                    displayPrice: `$${monthlyEquivalent.toFixed(2)}/month`,
                    originalPrice: monthlyPlan ? `$${monthlyPlan.raw_price.toFixed(2)}` : null,
                };
            });
        }

        return sorted.map((plan) => ({
            ...plan,
            displayPrice: plan.price,
            originalPrice: null,
        }));
    }, [plans, billingCycle]);

    const isCurrentPlan = (planId) => currentPlanId === planId;

    const showToggle = hasMonthly && hasAnnual;

    // Usage strip data (shared billing prop from the backend).
    const usage = billing || null;

    return (
        <Page>
            <style>{`
                @keyframes planSlideUp {
                    from { opacity: 0; transform: translateY(24px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .plan-card-new {
                    animation: planSlideUp 0.5s ease-out forwards;
                    opacity: 0;
                }
                .plan-card-new:nth-child(1) { animation-delay: 0.08s; }
                .plan-card-new:nth-child(2) { animation-delay: 0.16s; }
                .plan-card-new:nth-child(3) { animation-delay: 0.24s; }
                .plan-card-new:nth-child(4) { animation-delay: 0.32s; }
                .plan-cta-btn {
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }
                .plan-cta-btn::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent);
                    transform: translateX(-100%);
                    transition: transform 0.5s;
                }
                .plan-cta-btn:hover::after { transform: translateX(100%); }
                .plan-cta-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
                }
                .plan-cta-btn:active:not(:disabled) { transform: translateY(0); }
                .plans-page-wrapper * { box-sizing: border-box !important; }
                .plans-page-wrapper { color: #111827 !important; }
            `}</style>

            <div className="plans-page-wrapper" style={{ minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>

                {/* ===== HEADER ===== */}
                <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                    <Text variant="headingXl" as="h1">Plans & Billing</Text>
                    <div style={{ marginTop: '4px' }}>
                        <Text variant="bodySm" tone="subdued">
                            Choose the perfect plan for your store. Upgrade or downgrade anytime — billed securely through Shopify.
                        </Text>
                    </div>
                </div>

                {/* ===== CURRENT USAGE / TRIAL STRIP ===== */}
                {usage && usage.hasPlan && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '18px',
                            padding: '10px 20px',
                            borderRadius: '12px',
                            background: '#f5f3ff',
                            border: '1px solid #ddd6fe',
                            flexWrap: 'wrap',
                            justifyContent: 'center',
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5b21b6', fontWeight: 600 }}>
                                <Crown size={13} />
                                {usage.planName} plan{Number(usage.planPrice) > 0 ? ` · $${Number(usage.planPrice).toFixed(2)}${usage.planInterval === 'ANNUAL' ? '/year' : '/month'}` : ''}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280' }}>
                                <Lock size={13} />
                                {usage.hasUnlimitedLocks
                                    ? `${usage.locksUsed} lock${usage.locksUsed !== 1 ? 's' : ''} · unlimited`
                                    : `${usage.locksUsed} of ${usage.maxLocks} locks used`}
                            </span>
                            {usage.isTrial && (
                                <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: 600 }}>
                                    Free trial — {usage.trialDaysRemaining} day{usage.trialDaysRemaining !== 1 ? 's' : ''} left
                                </span>
                            )}
                            {!usage.isTrial && usage.billingOn && (
                                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                    Next billing: {usage.billingOn}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* ===== TEST MODE NOTICE ===== */}
                {usage && usage.testMode && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                        <div style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            color: '#92400e',
                            fontSize: '12px',
                            textAlign: 'center',
                        }}>
                            {usage.isDevStore
                                ? 'Development store — subscriptions here are created as Shopify TEST charges (you will not be billed).'
                                : 'Test billing mode is enabled for this store — subscriptions are Shopify TEST charges.'}
                        </div>
                    </div>
                )}

                {/* ===== BILLING TOGGLE (only shown when both cycles exist) ===== */}
                {showToggle && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
                        <div style={{
                            display: 'inline-flex',
                            padding: '2px',
                            borderRadius: '50px',
                            background: '#f3f4f6',
                            border: '1px solid #e5e7eb',
                        }}>
                            <button
                                onClick={() => setBillingCycle('monthly')}
                                style={{
                                    padding: '2px 12px',
                                    borderRadius: '50px',
                                    border: 'none',
                                    background: billingCycle === 'monthly' ? '#8b5cf6' : 'transparent',
                                    color: billingCycle === 'monthly' ? '#ffffff' : '#6b7280',
                                    fontWeight: 600,
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setBillingCycle('yearly')}
                                style={{
                                    padding: '2px 12px',
                                    borderRadius: '50px',
                                    border: 'none',
                                    background: billingCycle === 'yearly' ? '#8b5cf6' : 'transparent',
                                    color: billingCycle === 'yearly' ? '#ffffff' : '#6b7280',
                                    fontWeight: 600,
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.3s ease',
                                }}
                            >
                                Yearly
                                <span style={{
                                    background: billingCycle === 'yearly' ? 'rgba(255,255,255,0.25)' : '#8b5cf6',
                                    color: '#ffffff',
                                    padding: '1px 8px',
                                    borderRadius: '20px',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                }}>
                                    -17%
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                {!showToggle && <div style={{ marginBottom: '30px' }} />}

                {/* ===== ERROR ===== */}
                {error && (
                    <div style={{ maxWidth: '500px', margin: '0 auto 20px' }}>
                        <div style={{
                            padding: '10px 16px',
                            borderRadius: '10px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#b91c1c',
                            fontSize: '14px',
                            textAlign: 'center',
                        }}>
                            {error}
                        </div>
                    </div>
                )}

                {/* ===== CARDS GRID ===== */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '0 16px' }}>
                    {displayPlans.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px', padding: '40px' }}>
                            No plans available. Please contact support.
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gap: '16px',
                            gridTemplateColumns: `repeat(${displayPlans.length}, minmax(220px, 1fr))`,
                            maxWidth: `${displayPlans.length * 280}px`,
                            width: '100%',
                            alignItems: 'stretch',
                        }}>
                            {displayPlans.map((plan) => {
                                const isCurrent = isCurrentPlan(plan.id);
                                const isPopular = plan.is_popular;
                                const planMeta = PLAN_META[plan.name] || PLAN_META['Basic'];
                                const PlanIcon = planMeta.icon;
                                const features = plan.features?.length ? plan.features : planMeta.fallbackFeatures;

                                return (
                                    <div
                                        key={plan.id}
                                        className="plan-card-new"
                                        style={{
                                            position: 'relative',
                                            paddingTop: '16px', // space for badge
                                            transform: isPopular ? 'scale(1.03)' : 'scale(1)',
                                            zIndex: isPopular ? 10 : 1,
                                        }}
                                    >
                                        {/* ===== POPULAR BADGE ===== */}
                                        {isPopular && !isCurrent && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '2px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                zIndex: 20,
                                                background: '#8b5cf6',
                                                color: '#ffffff',
                                                padding: '4px 14px',
                                                borderRadius: '20px',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                letterSpacing: '0.5px',
                                                whiteSpace: 'nowrap',
                                                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                                            }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    <Star size={12} fill="currentColor" /> Most Popular
                                                </span>
                                            </div>
                                        )}

                                        {/* ===== CURRENT PLAN BADGE ===== */}
                                        {isCurrent && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '2px',
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                zIndex: 20,
                                                background: '#8b5cf6',
                                                color: '#ffffff',
                                                padding: '3px 12px',
                                                borderRadius: '20px',
                                                fontSize: '10px',
                                                fontWeight: 600,
                                                whiteSpace: 'nowrap',
                                                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
                                            }}>
                                                ✓ Current Plan
                                            </div>
                                        )}

                                        {/* ===== CARD ===== */}
                                        <div style={{
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            background: '#ffffff',
                                            border: isPopular || isCurrent ? '2px solid #c4b5fd' : '1px solid #e5e7eb',
                                            boxShadow: isPopular
                                                ? '0 8px 30px rgba(139, 92, 246, 0.1)'
                                                : '0 2px 12px rgba(0, 0, 0, 0.04)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            height: '100%',
                                            transition: 'all 0.3s ease',
                                        }}>
                                            <div style={{ padding: '20px 20px 16px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '2px' }}>
                                                    <div style={{
                                                        width: '28px', height: '28px',
                                                        borderRadius: '8px',
                                                        background: isPopular ? '#f3f0ff' : '#f9fafb',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <PlanIcon size={14} color={isPopular ? '#8b5cf6' : '#6b7280'} />
                                                    </div>
                                                    <span style={{ color: '#111827', fontSize: '16px', fontWeight: 600 }}>
                                                        {plan.name}
                                                    </span>
                                                </div>

                                                <p style={{ color: '#9ca3af', fontSize: '12px', margin: '0 0 12px 0' }}>
                                                    {plan.description || planMeta.tagline}
                                                </p>

                                                <div style={{ marginBottom: '4px' }}>
                                                    {plan.originalPrice && (
                                                        <span style={{ color: '#d1d5db', fontSize: '14px', textDecoration: 'line-through', marginRight: '8px' }}>
                                                            {plan.originalPrice}
                                                        </span>
                                                    )}
                                                    <span style={{ color: '#111827', fontSize: '24px', fontWeight: 700, lineHeight: 1 }}>
                                                        {plan.displayPrice}
                                                    </span>
                                                </div>

                                                <p style={{ color: '#8b5cf6', fontSize: '11px', margin: '2px 0 0 0', fontWeight: 500 }}>
                                                    {plan.raw_price === 0
                                                        ? 'free forever · no credit card required'
                                                        : (plan.interval === 'ANNUAL' ? 'billed annually' : 'billed monthly')
                                                            + (plan.trial_days > 0 ? ` · ${plan.trial_days}-day free trial` : '')}
                                                </p>

                                                <button
                                                    onClick={() => !isCurrent && handleSelectPlan(plan)}
                                                    disabled={loadingPlanId !== null || isCurrent}
                                                    className="plan-cta-btn"
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 20px',
                                                        borderRadius: '8px',
                                                        marginTop: '14px',
                                                        border: isCurrent ? '1px solid #e5e7eb' : isPopular ? 'none' : '1px solid #e5e7eb',
                                                        background: isCurrent ? '#f9fafb' : isPopular ? '#8b5cf6' : '#ffffff',
                                                        color: isCurrent ? '#9ca3af' : isPopular ? '#ffffff' : '#374151',
                                                        fontSize: '13px',
                                                        fontWeight: 600,
                                                        cursor: isCurrent ? 'not-allowed' : 'pointer',
                                                        fontFamily: 'inherit',
                                                        opacity: loadingPlanId === plan.id ? 0.7 : 1,
                                                    }}
                                                >
                                                    {loadingPlanId === plan.id ? (
                                                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                            <span style={{
                                                                width: '14px', height: '14px',
                                                                border: '2px solid currentColor',
                                                                borderTopColor: 'transparent',
                                                                borderRadius: '50%',
                                                                display: 'inline-block',
                                                                animation: 'spin 1s linear infinite',
                                                            }} />
                                                            Processing...
                                                        </span>
                                                    ) : isCurrent ? '✓ Current Plan'
                                                        : confirmingFreeId === plan.id ? 'Confirm downgrade to Free'
                                                        : `Start ${plan.name}`}
                                                </button>
                                            </div>

                                            <div style={{ borderTop: '1px solid #f3f4f6', margin: '0 20px' }} />

                                            <div style={{ padding: '14px 20px 20px', flex: 1 }}>
                                                <p style={{
                                                    fontSize: '10px', fontWeight: 600, color: '#9ca3af',
                                                    textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 10px 0',
                                                }}>
                                                    What's included
                                                </p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Check size={13} strokeWidth={2.5} style={{ color: isPopular ? '#8b5cf6' : '#c4b5fd', flexShrink: 0 }} />
                                                        <span style={{ fontSize: '12px', color: '#374151', fontWeight: 600, lineHeight: '16px' }}>
                                                            {plan.max_locks === 0 ? 'Unlimited content locks'
                                                                : plan.max_locks === 1 ? '1 content lock'
                                                                : `Up to ${plan.max_locks} content locks`}
                                                        </span>
                                                    </div>
                                                    {features.map((feature, idx) => (
                                                        <div key={`f-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <Check size={13} strokeWidth={2.5} style={{ color: isPopular ? '#8b5cf6' : '#c4b5fd', flexShrink: 0 }} />
                                                            <span style={{ fontSize: '12px', color: '#6b7280', lineHeight: '16px' }}>{feature}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ===== FREE TIER STRIP (kept below the paid grid on purpose) ===== */}
                {freePlan && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '28px', padding: '0 16px' }}>
                        <div style={{
                            width: '100%',
                            maxWidth: '860px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            flexWrap: 'wrap',
                            padding: '14px 20px',
                            borderRadius: '12px',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <span style={{
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    padding: '3px 12px',
                                    borderRadius: '16px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                }}>
                                    Free
                                </span>
                                <span style={{ fontSize: '13px', color: '#374151' }}>
                                    {isCurrentPlan(freePlan.id)
                                        ? 'Currently enjoying the Free plan (1 content lock · passcode & sign-in rules)'
                                        : confirmingFreeId === freePlan.id
                                            ? 'Switching to Free cancels your current subscription immediately — click again to confirm.'
                                            : 'Just getting started? 1 content lock with passcode & sign-in rules — free forever, no credit card required.'}
                                </span>
                            </div>
                            {isCurrentPlan(freePlan.id) ? (
                                <span style={{
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    background: '#f9fafb',
                                    border: '1px solid #e5e7eb',
                                    color: '#9ca3af',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                }}>
                                    ✓ Current Plan
                                </span>
                            ) : (
                                <button
                                    onClick={() => handleSelectPlan(freePlan)}
                                    disabled={loadingPlanId !== null}
                                    className="plan-cta-btn"
                                    style={{
                                        padding: '8px 18px',
                                        borderRadius: '8px',
                                        border: confirmingFreeId === freePlan.id ? '1px solid #f59e0b' : '1px solid #e5e7eb',
                                        background: confirmingFreeId === freePlan.id ? '#fffbeb' : '#ffffff',
                                        color: confirmingFreeId === freePlan.id ? '#b45309' : '#374151',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        whiteSpace: 'nowrap',
                                        opacity: loadingPlanId === freePlan.id ? 0.7 : 1,
                                    }}
                                >
                                    {loadingPlanId === freePlan.id
                                        ? 'Processing…'
                                        : confirmingFreeId === freePlan.id
                                            ? 'Confirm switch to Free'
                                            : 'Start Free'}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ===== FOOTER ===== */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px', paddingBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9ca3af', fontSize: '13px' }}>
                        <Shield size={14} />
                        <span>Secure payments • {plans.find((p) => p.trial_days > 0) ? 'Free trial on every paid plan • ' : ''}Cancel anytime • Powered by Shopify Billing</span>
                    </div>
                </div>
            </div>
        </Page>
    );
}
