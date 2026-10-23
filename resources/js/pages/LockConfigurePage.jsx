import { router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { lockKindLabel, resourceTypeLabel, resourceTypesFromRules } from '../lib/resourceTypes';
import { splitListValue } from '../lib/listValue';
import { previewFields, resolvePopupCopy } from '../lib/popupPreview';
import { applyLanguageForPreview, isRTLLocale, preferredEditingLocale, translate } from '../lib/widgetLanguages';
import '../../css/pages/lock-preview.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

const CONDITION_LABELS = {
    tag: 'Tagged customer',
    signedIn: 'Signed-in state',
    singlePasscode: 'Single passcode',
    multiplePasscodes: 'Multiple passcodes',
    singleSecretLink: 'Secret link',
    location: 'Location',
    specificEmail: 'Specific email',
    emailContains: 'Email contains',
    emailFromList: 'Email list',
    pairedCredentials: 'Email + passcode pairs',
    ip: 'IP address',
    ageVerification: 'Age verification',
};

// Conditions that draw an input on the storefront popup are "Form"; the rest
// are checked silently ("Text").
const FORM_TYPES = new Set([
    'singlePasscode', 'multiplePasscodes', 'specificEmail', 'emailContains',
    'emailFromList', 'pairedCredentials', 'ageVerification',
]);

const REPROMPT_LABELS = {
    remember: 'Once per device',
    session: 'On their next visit',
    always: 'On every page',
};

function conditionValueLabel(cond) {
    if (!cond.type) return '—';
    if (cond.type === 'signedIn') return cond.value === 'guest' ? 'Guest visitors' : 'Logged-in customers';
    if (cond.type === 'ageVerification') return `${cond.value || 18}+ years old`;
    if (cond.type === 'location') {
        if (cond.value === 'custom') return cond.custom || 'Custom location';
        return cond.value || '—';
    }
    // A list condition can hold hundreds of values — summarise it as a count.
    // splitListValue also recognises legacy backslash-separated saves, keeping
    // these counts in line with what the storefront accepts.
    if (cond.type === 'pairedCredentials') {
        const pairs = splitListValue(cond.value || '').filter((s) => s.trim());
        return `${pairs.length} pair${pairs.length !== 1 ? 's' : ''}`;
    }
    if (cond.type === 'multiplePasscodes' || cond.type === 'emailFromList') {
        const noun = cond.type === 'emailFromList' ? 'email' : 'passcode';
        const lines = splitListValue(cond.value || '').filter((s) => s.trim());
        return `${lines.length} ${noun}${lines.length !== 1 ? 's' : ''}`;
    }
    return cond.value || '—';
}

// A rule's conditions, as groups — accepts a JSON string, a flat list, or the
// nested-groups format [{operator, conditions:[…]}].
function ruleGroups(rule) {
    let conditions = rule?.conditions || [];
    if (typeof conditions === 'string') {
        try {
            conditions = JSON.parse(conditions);
        } catch {
            conditions = [];
        }
    }
    if (!Array.isArray(conditions)) conditions = [];
    const isGrouped =
        conditions.length > 0 &&
        conditions[0] &&
        typeof conditions[0] === 'object' &&
        'conditions' in conditions[0];
    return isGrouped ? conditions : [{ operator: 'AND', conditions }];
}

const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : '—');

const BackLink = () => (
    <a
        className="back-l"
        href="/locks"
        onClick={(e) => { e.preventDefault(); router.visit('/locks'); }}
    >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
        </svg>
        Locks
    </a>
);

// ─── Sub-components ──────────────────────────────────────────────────────────

function ConditionRow({ cond, index }) {
    const { store, auth } = usePage().props;
    const [copied, setCopied] = useState(false);

    // The storefront unlocks secret-link conditions via ?access=CODE — show
    // the composed link here so merchants can retrieve it after saving.
    // store.url holds the primary domain; the myshopify domain (users.name)
    // is the fallback.
    const storefrontBase =
        (store?.url || '').replace(/\/+$/, '') || (auth?.user?.name ? `https://${auth.user.name}` : '');
    const secretLink =
        cond.type === 'singleSecretLink' && (cond.value || '').trim() && storefrontBase
            ? `${storefrontBase}/?access=${encodeURIComponent(cond.value.trim())}`
            : '';
    const isForm = FORM_TYPES.has(cond.type);

    return (
        <div className="cond">
            <div className="row g8">
                <span className="sm strong grow">{CONDITION_LABELS[cond.type] || cond.type || 'Condition'}</span>
                <span className="xs sub">Condition {index + 1}</span>
                <span className={`tag ${isForm ? 'form' : 'text'}`}>{isForm ? 'Form' : 'Text'}</span>
            </div>
            <div className="row g16 mt8 wrap">
                <div><span className="sec-l">Type</span><div className="sm">{cond.type || '—'}</div></div>
                <div><span className="sec-l">Value</span><div className="sm mono">{conditionValueLabel(cond)}</div></div>
            </div>
            {secretLink && (
                <div className="link-row">
                    <span className="xs mono grow">{secretLink}</span>
                    <button
                        type="button"
                        className="btn"
                        onClick={() => {
                            navigator.clipboard?.writeText(secretLink);
                            setCopied(true);
                            setTimeout(() => setCopied(false), 1500);
                        }}
                    >
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            )}
        </div>
    );
}

function RuleCard({ rule, index }) {
    const groups = ruleGroups(rule);

    return (
        <div className="rule">
            <div className="row g8 wrap">
                <span className="tag">Rule {index + 1}</span>
                <span className="sm strong grow" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    {rule.title || rule.handle || 'Untitled item'}
                </span>
                {rule.resource_type && (
                    <span className={`pill ${rule.resource_type}`}>{resourceTypeLabel(rule.resource_type, 1)}</span>
                )}
                <span className={`tag ${rule.enabled ? 'live' : 'idle'}`}>{rule.enabled ? 'Active' : 'Inactive'}</span>
            </div>
            {rule.handle && rule.title && <div className="xs sub mt4">{rule.handle}</div>}

            {groups.map((group, gi) => (
                <div key={gi}>
                    {groups.length > 1 && (
                        <div className="row g8 mt12">
                            <span className="xs strong sub">Group {gi + 1}</span>
                            <span className="tag">{group.operator === 'AND' ? 'All must match' : 'Any can match'}</span>
                        </div>
                    )}
                    {(group.conditions || []).map((cond, ci) => (
                        <ConditionRow key={ci} cond={cond} index={ci} />
                    ))}
                    {gi < groups.length - 1 && (
                        <div className="cond-or"><span className="tag form">OR</span></div>
                    )}
                </div>
            ))}

            {rule.redirect_url && (
                <div className="kv" style={{ borderTop: '1px solid var(--p-border-soft)', marginTop: 9 }}>
                    <span className="sub">Redirect URL</span><span className="sm">{rule.redirect_url}</span>
                </div>
            )}
            {rule.price_message && (
                <div className="kv" style={{ borderTop: '1px solid var(--p-border-soft)', marginTop: rule.redirect_url ? 0 : 9 }}>
                    <span className="sub">Hidden price msg</span><span className="sm">{rule.price_message}</span>
                </div>
            )}
        </div>
    );
}

/**
 * What shoppers see: the storefront popup over a dimmed page, on the light
 * stage. Wording resolves the same way the storefront does (lock override →
 * widget value → translated default); boxes come from the conditions.
 */
function StagePreview({ lock, widget, groups }) {
    const design = widget?.configuration?.designOptions || {};
    const language = widget?.configuration?.language || null;

    const copy = useMemo(() => {
        applyLanguageForPreview({ ...(language || {}), mode: 'auto' });
        const locale = preferredEditingLocale(language, [], '');
        return {
            ...resolvePopupCopy({
                text: lock.popup_text || {},
                description: lock.description || '',
                design,
                translate: (key) => translate(key, locale),
            }),
            rtl: isRTLLocale(locale),
        };
    }, [lock.popup_text, lock.description, design, language]);

    const fields = useMemo(() => previewFields(groups), [groups]);

    const colors = design.colors || {};
    const cardColor = typeof colors.card === 'string' ? colors.card : '#ffffff';
    const textColor = typeof colors.text === 'string' ? colors.text : '#333333';
    const buttonBg = typeof colors.buttonBg === 'string' ? colors.buttonBg : '#15518C';
    const buttonText = typeof colors.buttonText === 'string' ? colors.buttonText : '#ffffff';
    const radius = Math.min(Number(design.layout?.cardBorderRadius) || 10, 18);

    return (
        <div className="stage w">
            <div className="device">
                <div className="sk">
                    <i style={{ width: '46%', height: 12 }} /><i className="gap" />
                    <i /><i style={{ width: '88%' }} /><i style={{ width: '70%' }} /><i className="gap" />
                    <i style={{ width: '40%', height: 11 }} />
                    <i /><i style={{ width: '80%' }} /><i className="gap" />
                    <i style={{ width: '62%' }} /><i style={{ width: '86%' }} />
                </div>
                <div className="veil">
                    <div
                        className="lk"
                        dir={copy.rtl ? 'rtl' : 'ltr'}
                        style={{ background: cardColor, color: textColor, borderRadius: radius }}
                    >
                        <div className="lk-ico">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                                <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
                                <path d="M8 10.5V7.5a4 4 0 018 0v3" />
                            </svg>
                        </div>
                        <div className="lk-t">{copy.title}</div>
                        <div className="lk-m">{copy.description}</div>
                        {fields.map((field, i) => {
                            const label =
                                field.label ||
                                (field.kind === 'email' ? copy.emailLabel : field.kind === 'dob' ? copy.dobLabel : copy.passcodeLabel);
                            const placeholder =
                                field.kind === 'email' ? copy.emailPlaceholder : field.kind === 'dob' ? 'YYYY-MM-DD' : copy.passcodePlaceholder;
                            return (
                                <div key={i}>
                                    <div className="lk-l">{label}</div>
                                    <div className="lk-f">{placeholder}</div>
                                </div>
                            );
                        })}
                        <div className="lk-b" style={{ background: buttonBg, color: buttonText }}>{copy.button}</div>
                    </div>
                </div>
            </div>
            <span className="stage-cap">What shoppers see</span>
            <p className="stage-note">
                {widget?.name
                    ? `Boxes come from the conditions; colours from the ${widget.name} design.`
                    : 'No design is selected, so this shows the default look.'}
            </p>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LockConfigurePage() {
    const { lock, previewMode } = usePage().props;

    if (!lock) {
        return (
            <div className="airo pg-lock-preview">
                <main className="page full">
                    <BackLink />
                    <h1 style={{ fontSize: 20, fontWeight: 650, marginTop: 2 }}>Lock preview</h1>
                    <div className="card card-p mt16">
                        <span className="strong">Lock not found</span>
                        <p className="sm sub mt4">This lock could not be found or you do not have access to it.</p>
                    </div>
                </main>
            </div>
        );
    }

    const isActive =
        lock.status === true || lock.status === 1 || lock.status === '1' || lock.status === 'Active';

    const accessRules = lock.access_rules || lock.accessRules || [];
    const widget = lock.widget || null;
    const resourceTypes = resourceTypesFromRules(accessRules);
    const kindLabel = lockKindLabel(lock.type);
    const activeRules = accessRules.filter((r) => r.enabled).length;

    const now = Date.now();
    const startsMs = lock.starts_at ? Date.parse(lock.starts_at) : NaN;
    const expiresMs = lock.expires_at ? Date.parse(lock.expires_at) : NaN;
    const scheduled = !Number.isNaN(startsMs) && now < startsMs;
    const expired = !Number.isNaN(expiresMs) && now >= expiresMs;

    const stateNote = !isActive
        ? 'Inactive. Saved, not enforcing anything on your storefront.'
        : expired
            ? `Expired on ${fmtDate(lock.expires_at)}. No longer enforced.`
            : scheduled
                ? `Scheduled. Starts enforcing on ${fmtDate(lock.starts_at)}.`
                : 'Active. Enforcing on your storefront now.';
    const stateTag = !isActive ? ['idle', 'Inactive'] : expired ? ['idle', 'Expired'] : scheduled ? ['now', 'Scheduled'] : ['live', 'Active'];

    // Conditions are the same across a lock's rules; the first rule's groups
    // drive the popup preview and the "Opens for" summary.
    const firstGroups = accessRules.length > 0 ? ruleGroups(accessRules[0]) : [];
    const conditionTypes = [
        ...new Set(
            accessRules.flatMap((r) => ruleGroups(r).flatMap((g) => (g.conditions || []).map((c) => c?.type))).filter(Boolean),
        ),
    ];
    const opensFor = conditionTypes.map((t) => CONDITION_LABELS[t] || t).join(', or ');
    const protects = resourceTypes.map(({ type, count }) => resourceTypeLabel(type, count)).join(', ');
    const widgetLine = widget ? [widget.name, widget.type].filter(Boolean).join(' — ') : '';
    const reprompt = REPROMPT_LABELS[lock.reprompt || 'remember'];

    const goEdit = () => router.visit(`/lock/${lock.id}/configure`);

    return (
        <div className="airo pg-lock-preview">
            <main className="page full">
                <div className="between wrap g12" style={{ marginBottom: 14 }}>
                    <div style={{ minWidth: 0 }}>
                        <BackLink />
                        <div className="row g8 wrap" style={{ marginTop: 2 }}>
                            <h1 style={{ fontSize: 20, fontWeight: 650 }}>{lock.name || 'Lock preview'}</h1>
                            <span className={`tag ${stateTag[0]}`}>{stateTag[1]}</span>
                            {kindLabel && <span className="tag pro">{kindLabel}</span>}
                        </div>
                        {lock.description && <p className="sm sub mt4">{lock.description}</p>}
                        {previewMode && (
                            <p className="xs sub mt4">You are viewing this lock in preview mode. No changes can be made here.</p>
                        )}
                    </div>
                    {previewMode && (
                        <button type="button" className="btn primary" onClick={goEdit}>Edit lock</button>
                    )}
                </div>

                <div className="split">
                    {/* The panel carries state; the work area carries the detail. */}
                    <aside className="panel w">
                        <div className="panel-eyebrow">Lock {lock.id}</div>
                        <h2>{lock.name}</h2>
                        <p className="panel-note">{stateNote}</p>

                        <div className="panel-sep" />

                        <div className="sum-head">At a glance</div>
                        <div className={`sum-row${protects ? ' set' : ''}`}>
                            <span className="sum-dot" />
                            <span><span className="sum-k">Protects</span><span className="sum-v">{protects || 'Nothing yet'}</span></span>
                        </div>
                        <div className={`sum-row${opensFor ? ' set' : ''}`}>
                            <span className="sum-dot" />
                            <span><span className="sum-k">Opens for</span><span className="sum-v">{opensFor || 'No conditions set'}</span></span>
                        </div>
                        <div className={`sum-row${widget ? ' set' : ''}`}>
                            <span className="sum-dot" />
                            <span><span className="sum-k">Shows</span><span className="sum-v">{widgetLine || 'Default design'}</span></span>
                        </div>
                        <div className="sum-row set">
                            <span className="sum-dot" />
                            <span><span className="sum-k">Asks again</span><span className="sum-v">{reprompt || lock.reprompt}</span></span>
                        </div>

                        <div className="panel-sep" />

                        <div className="sum-head">Schedule</div>
                        <div className={`sum-row${lock.starts_at ? ' set' : ''}`}>
                            <span className="sum-dot" />
                            <span><span className="sum-k">Starts</span><span className="sum-v">{lock.starts_at ? fmtDateTime(lock.starts_at) : 'Immediately'}</span></span>
                        </div>
                        <div className={`sum-row${lock.expires_at ? ' set' : ''}`}>
                            <span className="sum-dot" />
                            <span><span className="sum-k">Expires</span><span className="sum-v">{lock.expires_at ? fmtDateTime(lock.expires_at) : 'Never'}</span></span>
                        </div>

                        <div className="panel-foot">
                            <p className="xs">Created {fmtDate(lock.created_at)} &middot; updated {fmtDate(lock.updated_at)}</p>
                        </div>
                    </aside>

                    <section className="work">
                        <div className="work-body" style={{ paddingBottom: 0 }}>
                            <div className="work-opts">
                                <div className="sec">
                                    <div className="between" style={{ marginBottom: 12 }}>
                                        <span className="sec-h">
                                            Access rules <span className="xs sub" style={{ fontWeight: 450 }}>{accessRules.length} rule{accessRules.length !== 1 ? 's' : ''}</span>
                                        </span>
                                        {previewMode && (
                                            <button type="button" className="btn plain sm" onClick={goEdit}>Edit</button>
                                        )}
                                    </div>
                                    {accessRules.length > 0 ? (
                                        accessRules.map((rule, i) => <RuleCard key={rule.id ?? i} rule={rule} index={i} />)
                                    ) : (
                                        <p className="sm sub">No access rules configured for this lock.</p>
                                    )}
                                </div>

                                <div className="sec">
                                    <span className="sec-h">Lock details</span>
                                    <div className="mt12">
                                        <div className="kv"><span className="sub">ID</span><span>#{lock.id}</span></div>
                                        <div className="kv">
                                            <span className="sub">Type</span>
                                            <span className="row g4 wrap" style={{ justifyContent: 'flex-end' }}>
                                                {resourceTypes.length > 0
                                                    ? resourceTypes.map(({ type, count }) => (
                                                        <span key={type} className={`pill ${type}`}>{resourceTypeLabel(type, count)}</span>
                                                    ))
                                                    : <span className="sub">No items</span>}
                                                {kindLabel && <span className="tag pro">{kindLabel}</span>}
                                            </span>
                                        </div>
                                        <div className="kv"><span className="sub">Status</span><span className={`tag ${isActive ? 'live' : 'idle'}`}>{isActive ? 'Active' : 'Inactive'}</span></div>
                                        <div className="kv"><span className="sub">Created</span><span>{fmtDateTime(lock.created_at)}</span></div>
                                        <div className="kv"><span className="sub">Updated</span><span>{fmtDateTime(lock.updated_at)}</span></div>
                                        <div className="kv"><span className="sub">Starts at</span><span>{lock.starts_at ? fmtDateTime(lock.starts_at) : '—'}</span></div>
                                        <div className="kv"><span className="sub">Expires at</span><span>{lock.expires_at ? fmtDateTime(lock.expires_at) : '—'}</span></div>
                                    </div>
                                </div>

                                <div className="sec">
                                    <span className="sec-h">Summary</span>
                                    <div className="mt12">
                                        <div className="kv"><span className="sub">Rules</span><span>{accessRules.length}</span></div>
                                        <div className="kv"><span className="sub">Active rules</span><span>{activeRules}</span></div>
                                        <div className="kv"><span className="sub">Resources</span><span>{protects || '—'}</span></div>
                                        <div className="kv">
                                            <span className="sub">Widget</span>
                                            <span>{widget ? widgetLine : 'Using default design (no custom widget assigned)'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <StagePreview lock={lock} widget={widget} groups={firstGroups} />
                        </div>

                        <div className="work-foot">
                            <button type="button" className="btn" onClick={() => router.visit('/locks')}>Back to locks</button>
                            {previewMode && (
                                <button type="button" className="btn primary" onClick={goEdit}>Edit lock</button>
                            )}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
