import { router } from '@inertiajs/react';
import { Page, Text } from '@shopify/polaris';
import { ArrowRight, Check, CheckCircle, ChevronLeft, ChevronRight, FileText, Lock, Rocket, Settings, Shield, Sparkles, Type, Zap } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

// ===== STEP DEFINITIONS =====
const STEP_CONFIG = {
    welcome: {
        icon: Shield,
        title: 'Welcome',
        subtitle: 'Get started',
    },
    features: {
        icon: Zap,
        title: 'Features',
        subtitle: 'Explore capabilities',
    },
    'quick-start': {
        icon: Rocket,
        title: 'Quick Start',
        subtitle: 'Setup guide',
    },
    ready: {
        icon: CheckCircle,
        title: 'All Set',
        subtitle: 'Start now',
    },
};

// ===== WELCOME CONTENT =====
const WelcomeContent = () => (
    <div className="onb-slide" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
            <div
                style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.25)',
                }}
            >
                <Shield size={20} color="#ffffff" />
            </div>
        </div>

        <Text variant="headingXl" as="h1">Welcome to Access Lock</Text>
        <div style={{ marginTop: '4px', marginBottom: '20px' }}>
            <Text variant="bodySm" tone="subdued">Secure your store content with powerful access controls</Text>
        </div>

        {/* What is Access Lock */}
        <div
            style={{
                borderRadius: '12px',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                padding: '18px',
                textAlign: 'left',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>What is Access Lock?</span>
                <span
                    style={{
                        background: '#f0fdf4',
                        color: '#16a34a',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '10px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}
                >
                    <Sparkles size={9} /> Trusted by 1000+
                </span>
            </div>

            <div style={{ borderTop: '1px solid #f3f4f6', margin: '0 0 12px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                    { icon: Lock, text: 'Lock products, collections, pages & blogs' },
                    { icon: Shield, text: 'Use passcodes, tags, or custom conditions' },
                    { icon: Type, text: 'Create forms and widgets for customers' },
                ].map((item, i) => (
                    <div
                        key={i}
                        className="feature-item"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '7px 8px',
                            borderRadius: '8px',
                            background: '#faf5ff',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <div
                            style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '6px',
                                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <item.icon size={12} color="#ffffff" />
                        </div>
                        <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>{item.text}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* Quick stats */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
            {[
                { label: 'Setup', value: '< 2 min' },
                { label: 'Lock Types', value: '5+' },
                { label: 'Uptime', value: '99.9%' },
            ].map((s, i) => (
                <div
                    key={i}
                    style={{
                        flex: 1,
                        padding: '10px 8px',
                        borderRadius: '10px',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                        textAlign: 'center',
                    }}
                >
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#8b5cf6', display: 'block' }}>{s.value}</span>
                    <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{s.label}</span>
                </div>
            ))}
        </div>
    </div>
);

// ===== FEATURES CONTENT =====
const FeaturesContent = () => {
    const features = [
        { icon: Lock, title: 'Content Protection', desc: 'Lock any content with custom rules' },
        { icon: Shield, title: 'Customer Segmentation', desc: 'Control access by tags & history' },
        { icon: Type, title: 'Custom Widgets', desc: 'Beautiful forms & text widgets' },
        { icon: FileText, title: 'Flexible Rules', desc: 'Passcodes & complex conditions' },
    ];

    return (
        <div className="onb-slide" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                <div
                    style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 14px rgba(139, 92, 246, 0.25)',
                    }}
                >
                    <Zap size={20} color="#ffffff" />
                </div>
            </div>
            <Text variant="headingXl" as="h1">Powerful Features</Text>
            <div style={{ marginTop: '4px', marginBottom: '18px' }}>
                <Text variant="bodySm" tone="subdued">Everything you need to protect your content</Text>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '10px',
                    marginBottom: '14px',
                    textAlign: 'left',
                }}
            >
                {features.map((f, i) => (
                    <div
                        key={i}
                        className="onb-feature-card"
                        style={{
                            borderRadius: '12px',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                            padding: '14px',
                            transition: 'all 0.25s ease',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <div
                                style={{
                                    width: '30px',
                                    height: '30px',
                                    borderRadius: '8px',
                                    background: '#f3f0ff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <f.icon size={14} color="#8b5cf6" />
                            </div>
                            <div>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', display: 'block' }}>
                                    {f.title}
                                </span>
                                <span style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '16px' }}>
                                    {f.desc}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom row cards */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '10px',
                    textAlign: 'left',
                }}
            >
                <div
                    className="onb-feature-card"
                    style={{
                        borderRadius: '12px',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                        padding: '14px',
                        transition: 'all 0.25s ease',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div
                            style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '8px',
                                background: '#f3f0ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <Shield size={14} color="#8b5cf6" />
                        </div>
                        <div>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', display: 'block' }}>
                                Enterprise-Grade Security
                            </span>
                            <span style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '16px' }}>
                                Trusted by stores worldwide
                            </span>
                        </div>
                    </div>
                </div>
                <div
                    className="onb-feature-card"
                    style={{
                        borderRadius: '12px',
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                        padding: '14px',
                        transition: 'all 0.25s ease',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        <div
                            style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '8px',
                                background: '#f3f0ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <Sparkles size={14} color="#8b5cf6" />
                        </div>
                        <div>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', display: 'block' }}>
                                Easy Integration
                            </span>
                            <span style={{ fontSize: '11px', color: '#9ca3af', lineHeight: '16px' }}>
                                Works with any Shopify theme
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ===== QUICK START CONTENT =====
const QuickStartContent = () => {
    const steps = [
        { title: 'Create Your First Lock', desc: 'Click "Create New Lock" to start', action: 'Create' },
        { title: 'Configure Access Rules', desc: 'Set up your access conditions', action: 'Dashboard' },
        { title: 'Add Custom Widgets', desc: 'Enhance with forms & widgets', action: 'Explore' },
    ];

    return (
        <div className="onb-slide" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                <div
                    style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 14px rgba(139, 92, 246, 0.25)',
                    }}
                >
                    <Rocket size={20} color="#ffffff" />
                </div>
            </div>
            <Text variant="headingXl" as="h1">Quick Start Guide</Text>
            <div style={{ marginTop: '4px', marginBottom: '18px' }}>
                <Text variant="bodySm" tone="subdued">Get up and running in minutes</Text>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                {steps.map((step, i) => (
                    <div
                        key={i}
                        className="onb-feature-card"
                        style={{
                            borderRadius: '12px',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.25s ease',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: '#f3f0ff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <span style={{ color: '#8b5cf6', fontWeight: 700, fontSize: '13px' }}>{i + 1}</span>
                            </div>
                            <div>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', display: 'block' }}>
                                    {step.title}
                                </span>
                                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{step.desc}</span>
                            </div>
                        </div>
                        <div
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                background: '#f3f0ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <ChevronRight size={14} color="#8b5cf6" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ===== READY CONTENT =====
const ReadyContent = () => {
    const actions = [
        { icon: Lock, title: 'Create Locks', desc: 'Protect content', action: 'Start' },
        { icon: Type, title: 'Add Widgets', desc: 'Engage users', action: 'Explore' },
        { icon: Settings, title: 'Dashboard', desc: 'Manage all', action: 'Open' },
    ];

    return (
        <div className="onb-slide" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                <div
                    style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 14px rgba(139, 92, 246, 0.25)',
                    }}
                >
                    <CheckCircle size={20} color="#ffffff" />
                </div>
            </div>
            <div style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '20px', fontWeight: 700, color: '#8b5cf6' }}>You're All Set!</span>
            </div>
            <div style={{ marginBottom: '18px' }}>
                <Text variant="bodySm" tone="subdued">Start securing your content today</Text>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '10px',
                    marginBottom: '14px',
                    textAlign: 'center',
                }}
            >
                {actions.map((a, i) => (
                    <div
                        key={i}
                        className="onb-feature-card"
                        style={{
                            borderRadius: '12px',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                            padding: '16px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.25s ease',
                        }}
                    >
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: '#f3f0ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <a.icon size={16} color="#8b5cf6" />
                        </div>
                        <div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827', display: 'block' }}>
                                {a.title}
                            </span>
                            <span style={{ fontSize: '11px', color: '#9ca3af' }}>{a.desc}</span>
                        </div>
                        <button
                            className="plan-cta-btn"
                            style={{
                                width: '100%',
                                padding: '6px',
                                borderRadius: '8px',
                                border: '1px solid #e5e7eb',
                                background: '#f3f0ff',
                                color: '#8b5cf6',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        >
                            {a.action}
                        </button>
                    </div>
                ))}
            </div>

            {/* Congrats banner */}
            <div
                style={{
                    borderRadius: '12px',
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                }}
            >
                <div
                    style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        background: '#f3f0ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <CheckCircle size={14} color="#8b5cf6" />
                </div>
                <div style={{ textAlign: 'left' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827', display: 'block' }}>
                        Congratulations! 🎉
                    </span>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                        You're ready to secure your store
                    </span>
                </div>
            </div>
        </div>
    );
};

// ===== MAIN COMPONENT =====
export default function Onboarding() {
    const [currentStep, setCurrentStep] = useState(0);
    const [completedSteps, setCompletedSteps] = useState([]);

    const stepKeys = useMemo(() => ['welcome', 'features', 'quick-start', 'ready'], []);

    const progress = ((currentStep + 1) / stepKeys.length) * 100;

    const handleNext = useCallback(() => {
        if (currentStep < stepKeys.length - 1) {
            setCompletedSteps((prev) => [...new Set([...prev, currentStep])]);
            setCurrentStep((prev) => prev + 1);
        }
    }, [currentStep, stepKeys.length]);

    const handlePrevious = useCallback(() => {
        if (currentStep > 0) setCurrentStep((prev) => prev - 1);
    }, [currentStep]);

    const handleComplete = useCallback(() => router.post('/onboarding/complete'), []);

    const handleStepClick = useCallback(
        (index) => {
            if (completedSteps.includes(index) || index <= Math.max(...completedSteps, currentStep)) {
                setCurrentStep(index);
            }
        },
        [completedSteps, currentStep],
    );

    const getStepStatus = (index) => {
        if (completedSteps.includes(index)) return 'completed';
        if (index === currentStep) return 'active';
        return 'upcoming';
    };

    const renderContent = () => {
        switch (stepKeys[currentStep]) {
            case 'welcome': return <WelcomeContent />;
            case 'features': return <FeaturesContent />;
            case 'quick-start': return <QuickStartContent />;
            case 'ready': return <ReadyContent />;
            default: return null;
        }
    };

    const isLastStep = currentStep === stepKeys.length - 1;

    return (
        <Page>
            <style>{`
                @keyframes onbSlideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .onb-slide {
                    animation: onbSlideUp 0.4s ease-out forwards;
                }
                .onb-feature-card:hover {
                    border-color: #c4b5fd !important;
                    box-shadow: 0 8px 30px rgba(139, 92, 246, 0.1) !important;
                    transform: translateY(-2px);
                }
                .onb-action-btn:hover {
                    background: #8b5cf6 !important;
                    color: #ffffff !important;
                }
                .plan-cta-btn {
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
                .plan-cta-btn:hover::after {
                    transform: translateX(100%);
                }
                .plan-cta-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 30px rgba(139, 92, 246, 0.25);
                }
                .plan-cta-btn:active {
                    transform: translateY(0);
                }
                .onb-step-nav {
                    transition: all 0.2s ease;
                    cursor: pointer;
                    border: none;
                    font-family: inherit;
                    width: 100%;
                    background: transparent;
                }
                .onb-step-nav:hover:not(:disabled) {
                    background: #faf5ff;
                }
                .onb-step-nav:disabled {
                    cursor: not-allowed;
                    opacity: 0.5;
                }
                .onb-nav-btn {
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                }
                .onb-nav-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
                }
                .onb-nav-btn:active:not(:disabled) {
                    transform: translateY(0);
                }
                .feature-item:hover {
                    background: #f3f0ff !important;
                }
            `}</style>

            <div style={{ minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>

                {/* Main Content Area */}
                <div
                    style={{
                        flex: 1,
                        display: 'flex',
                        gap: '16px',
                        maxWidth: '900px',
                        width: '100%',
                        margin: '0 auto',
                        padding: '0 16px',
                    }}
                >
                    {/* ===== LEFT SIDEBAR ===== */}
                    <div
                        style={{
                            width: '240px',
                            flexShrink: 0,
                            borderRadius: '12px',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            height: 'fit-content',
                        }}
                    >
                        {/* Progress */}
                        <div style={{ marginBottom: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Progress</span>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#8b5cf6' }}>{Math.round(progress)}%</span>
                            </div>
                            <div
                                style={{
                                    height: '5px',
                                    borderRadius: '20px',
                                    background: '#f3f4f6',
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        height: '100%',
                                        borderRadius: '20px',
                                        background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)',
                                        width: `${progress}%`,
                                        transition: 'width 0.5s ease',
                                    }}
                                />
                            </div>
                            <span style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px', display: 'block' }}>
                                Step {currentStep + 1} of {stepKeys.length}
                            </span>
                        </div>

                        {/* Divider */}
                        <div style={{ borderTop: '1px solid #f3f4f6', marginBottom: '12px' }} />

                        {/* Step Navigation */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {stepKeys.map((key, index) => {
                                const config = STEP_CONFIG[key];
                                const status = getStepStatus(index);
                                const isClickable = status === 'completed' || index <= Math.max(...completedSteps, currentStep);
                                const StepIcon = config.icon;

                                return (
                                    <button
                                        key={key}
                                        className="onb-step-nav"
                                        onClick={() => isClickable && handleStepClick(index)}
                                        disabled={!isClickable}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 10px',
                                            borderRadius: '8px',
                                            textAlign: 'left',
                                            background: status === 'active' ? '#f3f0ff' : 'transparent',
                                            border: status === 'active' ? '1px solid #c4b5fd' : '1px solid transparent',
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                background:
                                                    status === 'completed'
                                                        ? '#8b5cf6'
                                                        : status === 'active'
                                                            ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                                                            : '#f3f4f6',
                                                transition: 'all 0.3s ease',
                                                ...(status === 'active'
                                                    ? { boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)' }
                                                    : {}),
                                            }}
                                        >
                                            {status === 'completed' ? (
                                                <Check size={12} color="#ffffff" strokeWidth={2.5} />
                                            ) : (
                                                <StepIcon
                                                    size={12}
                                                    color={status === 'active' ? '#ffffff' : '#9ca3af'}
                                                />
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span
                                                style={{
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    color:
                                                        status === 'active' || status === 'completed'
                                                            ? '#8b5cf6'
                                                            : '#6b7280',
                                                    display: 'block',
                                                }}
                                            >
                                                {config.title}
                                            </span>
                                            <span
                                                style={{
                                                    fontSize: '10px',
                                                    color: '#9ca3af',
                                                    display: 'block',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {config.subtitle}
                                            </span>
                                        </div>
                                        {status === 'active' && (
                                            <ChevronRight size={12} color="#8b5cf6" style={{ flexShrink: 0 }} />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* ===== RIGHT CONTENT AREA ===== */}
                    <div
                        style={{
                            flex: 1,
                            borderRadius: '12px',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: 0,
                            minHeight: '480px',
                        }}
                    >
                        {/* Content */}
                        <div style={{ flex: 1 }}>{renderContent()}</div>

                        {/* Divider */}
                        <div style={{ borderTop: '1px solid #f3f4f6', margin: '16px 0 14px 0' }} />

                        {/* Navigation Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button
                                className="onb-nav-btn"
                                onClick={handlePrevious}
                                disabled={currentStep === 0}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '7px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                    background: '#ffffff',
                                    color: currentStep === 0 ? '#d1d5db' : '#374151',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
                                    fontFamily: 'inherit',
                                }}
                            >
                                <ChevronLeft size={13} />
                                Previous
                            </button>

                            {isLastStep ? (
                                <button
                                    className="onb-nav-btn"
                                    onClick={handleComplete}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '8px 20px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#8b5cf6',
                                        color: '#ffffff',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                                    }}
                                >
                                    Go to Dashboard
                                    <Rocket size={13} />
                                </button>
                            ) : (
                                <button
                                    className="onb-nav-btn"
                                    onClick={handleNext}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '8px 20px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#8b5cf6',
                                        color: '#ffffff',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                                    }}
                                >
                                    Next
                                    <ArrowRight size={13} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </Page>
    );
}
