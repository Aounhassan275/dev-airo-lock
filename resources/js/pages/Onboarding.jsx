import { router, usePage } from '@inertiajs/react';
import { useAppBridge } from '@shopify/app-bridge-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../css/pages/onboarding.css';
import ConditionModal from '../components/onboarding/ConditionModal';
import DoneStep from '../components/onboarding/DoneStep';
import Icon, { ACTION_ICON } from '../components/onboarding/icons';
import ItemPicker from '../components/onboarding/ItemPicker';
import PopupPreview, { DEFAULT_LOOK, widgetColors, widgetDesign } from '../components/onboarding/PopupPreview';
import Welcome from '../components/onboarding/Welcome';
import WidgetEditor from '../components/onboarding/WidgetEditor';
import {
    CHECKOUT_CONDITION_TYPES,
    CONDITIONS,
    CONTENT_TYPES,
    COUNTRY_OPTIONS,
    LOCK_ACTION_FLAGS,
    LOCK_ACTION_HELP,
    NO_POPUP_NOTE,
    REPROMPT_OPTIONS,
    REQUIRES_VALUE,
    USER_STATE_OPTIONS,
    WHOLE,
    actionsFor,
    conditionByValue,
    countLabel,
    openChat,
} from '../components/onboarding/constants';
import { findBySelectionId, itemListsByType, RESOURCE_TYPE_BY_CONTENT, selectionId, storeItem, CHECKOUT_ITEM } from '../lib/lockItems';
import { inputFieldsFor, resolvePopupCopy } from '../lib/popupPreview';
import { normalizeLocale, preferredEditingLocale, translate } from '../lib/widgetLanguages';
import { splitListValue } from '../lib/listValue';
import { splitPairs } from '../lib/pairList';

// Sent on every request the flow makes, so the onboard middleware can send a
// save's follow-up (a redirect to the lock list) back to this screen.
const FLOW_HEADERS = { 'X-Airo-Onboarding': '1' };

const STEP_TITLES = { 1: 'What to lock', 2: 'Who gets in', 3: 'What visitors see', 4: 'Turn it on', 6: 'Done' };

const FORM_KINDS = new Set(CONDITIONS.filter((c) => c.w === 'form').map((c) => c.v));

const reducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** Which widget kinds this lock's conditions call for. */
function widgetNeeds(conditions) {
    let form = false;
    let text = false;
    conditions.forEach((c) => {
        if (!c?.type) return;
        if (FORM_KINDS.has(c.type)) form = true;
        else text = true;
    });
    return { form, text };
}

/** What a condition row says it is set to. */
function conditionSummary(cond) {
    const value = String(cond.value || '').trim();
    switch (cond.type) {
        case 'signedIn':
            return (USER_STATE_OPTIONS.find((o) => o.value === (value || 'loggedIn')) || {}).label || '';
        case 'ageVerification':
            return `${value || '18'}+`;
        case 'location':
            if (value === 'custom') return String(cond.custom || '').trim();
            return (COUNTRY_OPTIONS.find((o) => o.value === value) || {}).label || '';
        case 'multiplePasscodes':
        case 'emailFromList': {
            const n = splitListValue(value).filter((s) => s.trim() !== '').length;
            return n ? countLabel(n, 'entries') : '';
        }
        case 'pairedCredentials': {
            const n = value ? splitPairs(value).length : 0;
            return n ? countLabel(n, 'pairs') : '';
        }
        default:
            return value;
    }
}

/** Why a condition cannot be saved yet, or ''. */
function conditionProblem(cond, i) {
    const def = conditionByValue(cond.type);
    const name = def ? def.sum : 'This condition';
    if (!cond.type) return `Choose a type for condition ${i + 1}.`;
    if (cond.type === 'location') {
        if (!String(cond.value || '').trim()) return `Choose a country for "${name}" (condition ${i + 1}).`;
        if (cond.value === 'custom' && !String(cond.custom || '').trim()) return `Enter a custom location (condition ${i + 1}).`;
        return '';
    }
    if (REQUIRES_VALUE.has(cond.type) && !String(cond.value || '').trim()) {
        return `Fill in "${name}" (condition ${i + 1}).`;
    }
    return '';
}

/** Local wall-clock date + time → an absolute instant, as the builder sends it. */
function combineDateTime(date, time) {
    if (!date) return null;
    const d = new Date(`${date}T${time || '00:00'}`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function Onboarding(props) {
    const {
        products = [],
        collections = [],
        pages = [],
        blogs = [],
        themes = [],
        store = null,
        formWidgets = [],
        textWidgets = [],
        lockedItems = [],
        storeLocales = [],
        primaryLocale = '',
        latestLockId = null,
    } = props;
    const { auth } = usePage().props;
    const shopify = useAppBridge();

    const toast = useCallback(
        (message, isError = false) => {
            try {
                const Toast = shopify?.toast ?? window?.shopify?.toast;
                if (Toast?.show) Toast.show(message, { duration: isError ? 5000 : 3000, isError });
            } catch {
                // Toasts are a courtesy; never let one break the flow.
            }
        },
        [shopify],
    );

    // ---------------------------------------------------------------- view --
    const [view, setView] = useState('welcome');
    const [step, setStep] = useState(1);
    const [leaving, setLeaving] = useState(false);

    // ---------------------------------------------------------- the lock ---
    const [name, setName] = useState('');
    const [type, setType] = useState('');
    const [selected, setSelected] = useState([]);
    const [action, setAction] = useState('gate');
    const [priceMessage, setPriceMessage] = useState('Sign in to see price');
    const [hideOnAllPages, setHideOnAllPages] = useState(true);
    const [hideOnCheckout, setHideOnCheckout] = useState(true);
    const [reprompt, setReprompt] = useState('remember');

    const [operator, setOperator] = useState('AND');
    const [conditions, setConditions] = useState([{ type: 'singlePasscode', value: '', invert: false }]);

    const [redirectUrl, setRedirectUrl] = useState('');
    const [seoBlock, setSeoBlock] = useState(true);
    const [lockedVariantDisplay, setLockedVariantDisplay] = useState('hide');
    const [allVariantsLockedBehavior, setAllVariantsLockedBehavior] = useState('hide_product');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('');

    const [widgetId, setWidgetId] = useState('');
    const [textWidgetId, setTextWidgetId] = useState('');
    const [popupText, setPopupText] = useState({});
    const [description, setDescription] = useState('');

    // ------------------------------------------------------------- ui ------
    const [pickerOpen, setPickerOpen] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [condModal, setCondModal] = useState({ open: false, index: null });
    const [making, setMaking] = useState(null); // 'form' | 'text' | null
    const [draft, setDraft] = useState(null);

    const [embed, setEmbed] = useState({ enabled: null, deepLink: '', checking: false });
    // What the embed was when setup opened. "Turn it on" is only in the flow
    // for a store whose embed was off; turning it on from that step keeps the
    // step (it then shows the lock running) rather than snatching it away.
    const [embedAtStart, setEmbedAtStart] = useState(null);
    // A store with no locks yet is making its first one.
    const firstLockRef = useRef(latestLockId === null || latestLockId === undefined);

    // The done screen's run.
    const [rows, setRows] = useState(['', '', '']);
    const [scene, setScene] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [createdLockId, setCreatedLockId] = useState(null);
    const runRef = useRef(0);

    useEffect(() => () => { runRef.current += 1; }, []);

    // --------------------------------------------------------- derived -----
    const isPrice = type === 'price_hide';
    const whole = WHOLE[type] || '';
    const typeDef = CONTENT_TYPES.find((t) => t.value === type) || null;
    const pickType = isPrice ? 'products' : type;
    const noun = typeDef ? typeDef.noun : 'items';

    const needs = useMemo(() => widgetNeeds(conditions), [conditions]);
    const hasConds = type !== 'price_hide';
    const hasPopup = !isPrice && action === 'gate';
    const hasEmbed = embedAtStart !== true;

    const path = useMemo(() => {
        const p = [1];
        if (hasConds) p.push(2);
        if (hasPopup) p.push(3);
        if (hasEmbed) p.push(4);
        p.push(6);
        return p;
    }, [hasConds, hasPopup, hasEmbed]);

    // A step that drops out while you are on it hands you to the one before.
    useEffect(() => {
        if (!path.includes(step)) setStep(2 <= step && path.includes(2) ? 2 : 1);
    }, [path, step]);

    const at = path.indexOf(step);
    const lastQuestion = at === path.length - 2;

    const lists = useMemo(
        () => itemListsByType({ products, collections, pages, blogs, themes, store }),
        [products, collections, pages, blogs, themes, store],
    );

    const formWidget = formWidgets.find((w) => String(w.id) === String(widgetId)) || null;
    const textWidget = textWidgets.find((w) => String(w.id) === String(textWidgetId)) || null;
    const shownWidget = needs.form ? formWidget : textWidget;

    // The server gives a lock with no design the store's first one, so the
    // flow starts there too rather than claiming "Default design".
    useEffect(() => {
        if (!widgetId && formWidgets.length > 0) setWidgetId(String(formWidgets[0].id));
    }, [formWidgets, widgetId]);
    useEffect(() => {
        if (!textWidgetId && textWidgets.length > 0) setTextWidgetId(String(textWidgets[0].id));
    }, [textWidgets, textWidgetId]);

    // The preview speaks the language the shown design is set to: a widget
    // pinned to Urdu previews in Urdu, one that follows the storefront
    // previews in the store's primary language. While a widget is being made,
    // the language picked in its editor wins.
    const previewLanguage = making
        ? (draft?.language ? { mode: 'fixed', locale: draft.language, translations: {} } : null)
        : (shownWidget?.configuration?.language || null);
    const locale = preferredEditingLocale(previewLanguage, storeLocales, primaryLocale);

    const storefrontBase = (store?.url || '').replace(/\/+$/, '') || (auth?.user?.name ? `https://${auth.user.name}` : '');

    /** Which active lock already covers an item — the picker says so. */
    const lockedBy = useCallback(
        (item) => {
            const rt = RESOURCE_TYPE_BY_CONTENT[pickType];
            if (!rt || !item?.handle) return null;
            const hit = (lockedItems || []).find(
                (l) => [true, 1, '1'].includes(l.lock_active) && l.resource_type === rt && String(l.handle) === String(item.handle),
            );
            return hit ? hit.lock_name : null;
        },
        [lockedItems, pickType],
    );

    // ------------------------------------------------------- app embed -----
    const checkEmbed = useCallback(async (fresh = false) => {
        if (!window.axios) return null;
        setEmbed((e) => ({ ...e, checking: true }));
        try {
            const { data } = await window.axios.get(`/extension/status${fresh ? '?fresh=1' : ''}`, { headers: FLOW_HEADERS });
            const enabled = data && typeof data.enabled === 'boolean' ? data.enabled : null;
            setEmbed((e) => ({ enabled: enabled ?? e.enabled, deepLink: data?.deepLink || e.deepLink, checking: false }));
            return enabled;
        } catch {
            setEmbed((e) => ({ ...e, checking: false }));
            return null;
        }
    }, []);

    useEffect(() => {
        checkEmbed(false).then((on) => setEmbedAtStart(on));
    }, [checkEmbed]);

    // Back from the theme editor: look again, so the step clears itself.
    useEffect(() => {
        if (step !== 4 || embed.enabled === true) return undefined;
        const onFocus = () => checkEmbed(true);
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [step, embed.enabled, checkEmbed]);

    // ---------------------------------------------------------- step 1 -----
    const chooseType = (value) => {
        setType(value);
        setAction('gate');
        if (value === 'checkout') {
            setSelected([selectionId('checkout', CHECKOUT_ITEM)]);
            // Only some checks can be made at checkout; the rest would block
            // everyone or never enforce, so they go.
            setConditions((prev) => {
                const kept = prev.filter((c) => CHECKOUT_CONDITION_TYPES.has(c.type));
                return kept.length ? kept : [{ type: 'singlePasscode', value: '', invert: false }];
            });
        } else if (value === 'store') {
            setSelected([selectionId('store', storeItem(store))]);
        } else {
            // Switching type clears what was picked instead of keeping stale items.
            setSelected([]);
            setPickerOpen(true);
        }
    };

    const step1Ready = name.trim() !== '' && type !== '' && (whole !== '' || selected.length > 0);

    const refreshCatalog = () => {
        if (refreshing || !pickType) return;
        setRefreshing(true);
        router.post('/lock/refresh-catalog', { type: pickType }, {
            preserveState: true,
            preserveScroll: true,
            headers: FLOW_HEADERS,
            onError: (errors) => toast(Object.values(errors || {}).flat().join(', ') || 'Could not reach Shopify. Please try again.', true),
            onFinish: () => setRefreshing(false),
        });
    };

    // ---------------------------------------------------------- step 2 -----
    const usedTypes = conditions.map((c) => c.type).filter(Boolean);
    const saveCondition = (cond) => {
        setConditions((prev) => {
            if (condModal.index === null) return [...prev, cond];
            const next = [...prev];
            next[condModal.index] = cond;
            return next;
        });
        setCondModal({ open: false, index: null });
    };
    const removeCondition = (i) => setConditions((prev) => prev.filter((_, j) => j !== i));

    const step2Problem = () => {
        if (conditions.length === 0) return 'Add at least one condition.';
        for (let i = 0; i < conditions.length; i += 1) {
            const problem = conditionProblem(conditions[i], i);
            if (problem) return problem;
        }
        const starts = combineDateTime(startDate, startTime);
        const ends = combineDateTime(endDate, endTime);
        if (starts && ends && new Date(ends) <= new Date(starts)) return 'Expire date must be after activate date';
        return '';
    };

    // ---------------------------------------------------------- step 3 -----
    const defaults = resolvePopupCopy({ text: {}, description: '', design: widgetDesign(shownWidget), translate: (k) => translate(k, locale) });
    const kinds = new Set(conditions.flatMap((c) => inputFieldsFor(c.type)));
    const setWord = (key, value) => setPopupText((t) => ({ ...t, [key]: value }));
    const changedWording = [
        ...(description.trim() ? ['message'] : []),
        ...[['header', 'title'], ['button', 'button'], ['passcode_label', 'passcode label'], ['passcode_placeholder', 'passcode hint'], ['email_label', 'email label'], ['email_placeholder', 'email hint']]
            .filter(([k]) => String(popupText[k] || '').trim() !== '')
            .map(([, label]) => label),
    ];

    // ------------------------------------------------------- summary -------
    const summary = {
        name: name.trim() || 'Untitled lock',
        protects: whole || countLabel(selected.length, noun),
        opens: isPrice
            ? 'Not used — a hide-price rule applies to every visitor'
            : conditions.length === 1
                ? (conditionByValue(conditions[0].type) || {}).sum || '—'
                : `${countLabel(conditions.length, 'conditions')}, ${operator === 'AND' ? 'all' : 'any'} must match`,
        shows: isPrice
            ? `Your price message: “${priceMessage.trim() || 'Sign in to see price'}”`
            : hasPopup
                ? shownWidget?.name || 'Default design'
                : 'Nothing — the content is hidden',
    };

    // ---------------------------------------------------------- saving -----
    const buildItems = () => selected
        .map((selId) => {
            const sep = selId.indexOf('-');
            const t = selId.slice(0, sep);
            const item = findBySelectionId(lists[t] || [], t, selId);
            if (!item) return null;
            return {
                handle: item.handle || (t === 'themes' ? item.shopify_theme_id : ''),
                resource_type: RESOURCE_TYPE_BY_CONTENT[t] || t,
                title: item.title || item.name || '',
                original_id: item.id,
                variant_ids: [],
            };
        })
        .filter(Boolean);

    /** The run on the done screen. It waits for the save, then acts out the
        rest and reports what the embed check actually found. */
    const runDone = async (saved) => {
        const run = ++runRef.current;
        const alive = () => run === runRef.current;
        const quiet = reducedMotion();
        const started = Date.now();

        setRevealed(false);
        setRows(['run', '', '']);
        setScene(quiet ? 0 : 1);

        const lockId = await saved;
        if (!alive()) return;
        if (lockId === null) return; // the save failed and the flow went back

        setCreatedLockId(lockId);

        if (quiet) {
            const on = await checkEmbed(true);
            if (!alive()) return;
            setRows(['ok', 'ok', on ? 'ok' : 'warn']);
            setRevealed(true);
            return;
        }

        await wait(Math.max(0, 1500 - (Date.now() - started)));
        if (!alive()) return;
        setRows(['ok', 'run', '']);
        setScene(2);
        await wait(1500);
        if (!alive()) return;
        setRows(['ok', 'ok', 'run']);
        setScene(3);
        const [on] = await Promise.all([checkEmbed(true), wait(1500)]);
        if (!alive()) return;
        setRows(['ok', 'ok', on === true ? 'ok' : 'warn']);
        setScene(0);
        await wait(420);
        if (!alive()) return;
        setRevealed(true);
    };

    const createLock = () => {
        const items = buildItems();
        if (!name.trim()) {
            toast('Lock name is required', true);
            setStep(1);
            return;
        }
        if (items.length === 0) {
            toast('Please select at least one item to lock', true);
            setStep(1);
            return;
        }
        if (hasConds) {
            const problem = step2Problem();
            if (problem) {
                toast(problem, true);
                setStep(2);
                return;
            }
        }

        const backTo = step;
        const before = latestLockId;
        let settle;
        const saved = new Promise((resolve) => { settle = resolve; });

        const fail = (message) => {
            toast(message, true);
            runRef.current += 1;
            setRows(['', '', '']);
            setScene(0);
            setStep(backTo);
            settle(null);
        };

        const options = {
            preserveState: true,
            preserveScroll: true,
            headers: FLOW_HEADERS,
            onSuccess: (page) => {
                // Success comes back here through the onboard middleware with a
                // new latest lock. Landing back with a save_error (or with no
                // new lock) means the server refused it.
                const params = new URLSearchParams((page.url || '').split('?')[1] || '');
                const newId = page.props?.latestLockId ?? null;
                const refused = params.get('save_error');
                if (refused || page.component !== 'Onboarding' || !newId || newId === before) {
                    const errors = page.props?.errors || {};
                    fail(refused || (Object.keys(errors).length ? Object.values(errors).flat().join(', ') : 'Save failed — please try again.'));
                    return;
                }
                settle(newId);
            },
            onError: (errors) => fail(Object.values(errors || {}).flat().join(', ') || 'Save failed — please try again.'),
            onCancel: () => fail('The save was cancelled.'),
        };

        setStep(6);
        runDone(saved);

        if (isPrice) {
            router.post('/lock/store-price-rule', {
                name: name.trim(),
                selectedItems: items,
                price_message: priceMessage,
                hide_on_all_pages: hideOnAllPages,
                hide_on_checkout: hideOnCheckout,
                status: 'Active',
                type: 'price_hide',
            }, options);
            return;
        }

        const flags = LOCK_ACTION_FLAGS[action] || LOCK_ACTION_FLAGS.gate;
        const rules = [{
            operator,
            conditions: conditions.map((c) => (c.type === 'signedIn' && !String(c.value || '').trim() ? { ...c, value: 'loggedIn' } : c)),
        }];
        const payload = {
            name: name.trim(),
            selectedItems: items,
            rules,
            status: 'Active',
            user_request_by_email: false,
            hide_add_to_cart: flags.hideAddToCart,
            hide_completely: flags.hideCompletely,
            protect_products: flags.protectProducts,
            seo_block: seoBlock,
            locked_variant_display: lockedVariantDisplay,
            all_variants_locked_behavior: allVariantsLockedBehavior,
            reprompt,
        };
        const startsAt = combineDateTime(startDate, startTime);
        const expiresAt = combineDateTime(endDate, endTime);
        if (description.trim()) payload.description = description.trim();
        const cleanText = Object.fromEntries(Object.entries(popupText).filter(([, v]) => String(v || '').trim() !== ''));
        if (Object.keys(cleanText).length) payload.popup_text = cleanText;
        if (startsAt) payload.starts_at = startsAt;
        if (expiresAt) payload.expires_at = expiresAt;
        if (redirectUrl.trim()) payload.redirect_url = redirectUrl.trim();
        if (widgetId) payload.widget_id = widgetId;
        if (textWidgetId) payload.text_widget_id = textWidgetId;

        router.post('/locks', payload, options);
    };

    // ------------------------------------------------------ navigation -----
    const next = () => {
        if (step === 1 && !step1Ready) return;
        if (step === 2) {
            const problem = step2Problem();
            if (problem) {
                toast(problem, true);
                return;
            }
        }
        if (lastQuestion) {
            createLock();
            return;
        }
        setStep(path[at + 1]);
    };

    const back = () => {
        if (at <= 0) {
            setView('welcome');
            return;
        }
        setStep(path[at - 1]);
    };

    /** Leave the flow: mark onboarding done and go where the merchant chose. */
    const finish = (target) => {
        if (leaving) return;
        setLeaving(true);
        router.post('/onboarding/complete', { next: target }, {
            onFinish: () => setLeaving(false),
        });
    };

    // ---------------------------------------------------------- render -----
    if (view === 'welcome') {
        return (
            <div className="airo pg-onboarding">
                <Welcome
                    storeName={store?.name || ''}
                    skipping={leaving}
                    onStart={() => { setView('setup'); setStep(1); }}
                    onSkip={() => finish('/locks')}
                />
            </div>
        );
    }

    const actions = actionsFor(type);
    const helpnote = (
        <a className="helpnote" href="#chat" onClick={openChat} aria-label="Chat with support">
            <span className="helpnote-ic" aria-hidden="true"><Icon name="chat" strokeWidth={1.7} /></span>
            <span>
                <span className="helpnote-t">Stuck on any of this?</span>
                <span className="helpnote-d">Chat with us and we&rsquo;ll set it up with you.</span>
            </span>
        </a>
    );

    const embedStep = step === 4;
    const step3Title = embedStep ? 'One switch left' : 'What should visitors see?';
    const step3Sub = embedStep
        ? 'Your locks run through a theme app embed. Switch it on and this one starts working.'
        : 'Choose how the popup looks and what it says.';
    const embedOn = embed.enabled === true;

    const preview = (
        <PopupPreview
            groups={[{ operator, conditions }]}
            colors={making ? DEFAULT_LOOK : (shownWidget ? widgetColors(shownWidget) : DEFAULT_LOOK)}
            design={making ? {} : widgetDesign(shownWidget)}
            draft={making ? draft : null}
            popupText={popupText}
            description={description}
            showPopup={hasPopup}
            noPopupNote={NO_POPUP_NOTE[isPrice ? 'price_hide' : action] || ''}
            off={embedStep && !embedOn}
            caption={!embedStep ? 'What shoppers see' : embedOn ? 'Your lock, running' : 'Your lock, once the embed is on'}
            locale={locale}
            language={previewLanguage}
        />
    );

    const designPicks = (kind) => {
        const list = kind === 'text' ? textWidgets : formWidgets;
        const current = kind === 'text' ? textWidgetId : widgetId;
        const setCurrent = kind === 'text' ? setTextWidgetId : setWidgetId;
        const label = kind === 'text' ? 'Text widget design' : 'Form widget design';
        return (
            <div className="field" id={kind === 'text' ? 'textWrap' : 'formWrap'}>
                <span className="label">{label}</span>
                <div className="picks-row">
                    <div className="picks" role="radiogroup" aria-label={label}>
                        {list.length === 0 ? (
                            <label className="pick on">
                                <input type="radio" name={`${kind}Design`} value="" checked readOnly />
                                <span className="pick-sw" aria-hidden="true" style={{ background: DEFAULT_LOOK.card, color: DEFAULT_LOOK.text }}>
                                    <i style={{ background: DEFAULT_LOOK.buttonBg }} />
                                </span>
                                <span className="pick-n">Default design</span>
                            </label>
                        ) : list.map((w) => {
                            const c = widgetColors(w);
                            const on = String(w.id) === String(current);
                            return (
                                <label key={w.id} className={`pick${on ? ' on' : ''}`}>
                                    <input type="radio" name={`${kind}Design`} value={w.id} checked={on} onChange={() => setCurrent(String(w.id))} />
                                    <span className="pick-sw" aria-hidden="true" style={{ background: c.card, color: c.text }}>
                                        <i style={{ background: c.buttonBg }} />
                                    </span>
                                    <span className="pick-n">{w.name}</span>
                                </label>
                            );
                        })}
                    </div>
                    <button type="button" className="pick-add" data-new={kind} onClick={() => setMaking(kind)}>
                        <span className="pick-plus" aria-hidden="true">+</span>
                        <span className="pick-n">Create widget</span>
                    </button>
                </div>
                {kind === 'form' || !needs.form ? (
                    <span className="help" id="widgetKindWhy">
                        {needs.form && needs.text
                            ? 'One condition asks for input and another does not, so both are used.'
                            : needs.form
                                ? 'Used for conditions that need user input (passcode, age verification).'
                                : "Used for conditions that don't need input (tag, signed in, location)."}
                    </span>
                ) : null}
            </div>
        );
    };

    return (
        <div className="airo pg-onboarding">
            <main className="page full ob-setup">
                {/* The steps, above the card: circles joined by a rule. */}
                <nav className="stepper" aria-label="Steps">
                    <ol>
                        {path.map((s, i) => {
                            const cls = i === at ? 'on' : i < at ? 'done' : '';
                            const title = STEP_TITLES[s];
                            return (
                                <li key={s} className={`st ${cls}`} aria-current={i === at ? 'step' : undefined}>
                                    <span className="st-n">{i < at ? <Icon name="check" size={14} strokeWidth={2.4} /> : i + 1}</span>
                                    <span className="st-t">{title}</span>
                                    <span className="st-now">Current</span>
                                </li>
                            );
                        })}
                    </ol>
                </nav>

                <div className="split">
                    <section className="work">
                        {/* ============================ step 1: what to lock */}
                        {step === 1 ? (
                            <div className="wiz" data-wiz="1">
                                <div className="work-head">
                                    <div>
                                        <h2 className="work-h">What should this lock protect?</h2>
                                        <p className="sm sub mt4">Name it, choose the content, and decide what locking actually does to it.</p>
                                    </div>
                                    {helpnote}
                                </div>
                                <div className="work-body">
                                    <div className="work-opts">
                                        <div className="col-form">
                                            <div className="field" style={{ flex: 'none', marginBottom: 12, maxWidth: 430 }}>
                                                <label className="label" htmlFor="lockName">
                                                    Lock name <span className="req" aria-hidden="true">*</span>
                                                </label>
                                                <input
                                                    className="input"
                                                    id="lockName"
                                                    aria-required="true"
                                                    placeholder="e.g. Wholesale catalogue"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                />
                                                <span className="help">Only you see this. It appears in your locks list.</span>
                                            </div>
                                            <div className="divider" style={{ margin: '12px 0', flex: 'none' }} />

                                            {isPrice ? (
                                                <div id="priceWrap" style={{ flex: 'none', maxWidth: 480 }}>
                                                    <span className="sec-l" style={{ marginBottom: 7 }}>Price visibility</span>
                                                    <div className="field">
                                                        <label className="label" htmlFor="priceMsg">Price hidden message</label>
                                                        <input className="input" id="priceMsg" placeholder="Sign in to see price" value={priceMessage} onChange={(e) => setPriceMessage(e.target.value)} />
                                                        <span className="help">Message to display in place of the price.</span>
                                                    </div>
                                                    <span className="label mt12" style={{ display: 'block' }}>Visibility options</span>
                                                    <div className="acts">
                                                        <label className={`act${hideOnAllPages ? ' on' : ''}`}>
                                                            <input type="checkbox" checked={hideOnAllPages} onChange={(e) => setHideOnAllPages(e.target.checked)} />
                                                            <span className="act-box" aria-hidden="true" />
                                                            <span className="act-c">
                                                                <span className="act-t">Hide on all pages (Collections, Search, etc.)</span>
                                                                <span className="act-d">Price is hidden wherever the product appears.</span>
                                                            </span>
                                                        </label>
                                                        <label className={`act${hideOnCheckout ? ' on' : ''}`}>
                                                            <input type="checkbox" checked={hideOnCheckout} onChange={(e) => setHideOnCheckout(e.target.checked)} />
                                                            <span className="act-box" aria-hidden="true" />
                                                            <span className="act-c">
                                                                <span className="act-t">Disallow Add to Cart / Checkout</span>
                                                                <span className="act-d">Hides Add to Cart buttons and prevents checkout.</span>
                                                            </span>
                                                        </label>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="field" id="actionWrap" style={{ flex: 'none', maxWidth: 430 }}>
                                                    <span className="label">When locked, do this</span>
                                                    <div className="acts tiles" id="action" role="radiogroup" aria-label="When locked, do this">
                                                        {actions.map(([value, label]) => (
                                                            <label key={value} className={`act${action === value ? ' on' : ''}`}>
                                                                <input type="radio" name="lockAction" value={value} checked={action === value} onChange={() => setAction(value)} />
                                                                <span className="act-ic" aria-hidden="true"><Icon name={ACTION_ICON[value] || 'lock'} /></span>
                                                                <span className="act-c">
                                                                    <span className="act-t">{label}</span>
                                                                    <span className="act-d" title={LOCK_ACTION_HELP[value]}>{LOCK_ACTION_HELP[value]}</span>
                                                                </span>
                                                                <span className="act-tick" aria-hidden="true" />
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-scope">
                                            <span className="sec-l" style={{ marginBottom: 7 }}>
                                                Content to lock <span className="req" aria-hidden="true">*</span>
                                            </span>
                                            <div className="opts2" id="scope" role="radiogroup" aria-label="Content to lock">
                                                {CONTENT_TYPES.map((t) => (
                                                    <button
                                                        type="button"
                                                        key={t.value}
                                                        className={`opt${type === t.value ? ' on' : ''}`}
                                                        data-sum={t.sum}
                                                        role="radio"
                                                        aria-checked={type === t.value}
                                                        onClick={() => chooseType(t.value)}
                                                    >
                                                        <span className="opt-ic"><Icon name={t.icon} /></span>
                                                        <span>
                                                            <span className="opt-t">{t.label}</span>
                                                            <span className="opt-d">{t.desc}</span>
                                                        </span>
                                                        <span className="opt-tick" />
                                                    </button>
                                                ))}
                                            </div>

                                            <div className={`pickbar mt10${whole || selected.length ? ' set' : ''}`} id="itemsRow">
                                                <span className="pickbar-ic"><Icon name="list" /></span>
                                                <span className="grow">
                                                    <span className="sm strong" id="itemsText">
                                                        {!type ? 'Choose a type above first'
                                                            : whole ? `${whole} will be locked.`
                                                                : selected.length ? `${countLabel(selected.length, noun)} chosen` : 'Nothing chosen yet'}
                                                    </span>
                                                    <span className="help" id="itemsSub">
                                                        {!type ? 'Pick the exact items this lock covers.'
                                                            : whole ? 'There is nothing to narrow down — the lock covers all of it.'
                                                                : selected.length ? 'Only these are locked. Everything else stays open.'
                                                                    : `Pick the exact ${noun} this lock covers.`}
                                                    </span>
                                                </span>
                                                {!whole && selected.length ? (
                                                    <button type="button" className="btn" id="clearItems" onClick={() => setSelected([])}>Clear all</button>
                                                ) : null}
                                                <button type="button" className="btn" id="browse" disabled={!type || !!whole} onClick={() => setPickerOpen(true)}>
                                                    {whole ? 'Nothing to choose' : type ? `Choose ${noun}` : 'Choose items'}
                                                </button>
                                            </div>

                                            {hasConds ? (
                                                <div id="repromptWrap" className="fit-w">
                                                    <span className="sec-l" style={{ marginBottom: 7 }}>How long access lasts</span>
                                                    <div className="acts fit tiles" role="radiogroup" aria-label="How long access lasts">
                                                        {REPROMPT_OPTIONS.map((o) => (
                                                            <label key={o.value} className={`act${reprompt === o.value ? ' on' : ''}`}>
                                                                <input type="radio" name="reprompt" value={o.value} checked={reprompt === o.value} onChange={() => setReprompt(o.value)} />
                                                                <span className="act-ic" aria-hidden="true"><Icon name={o.icon} /></span>
                                                                <span className="act-c">
                                                                    <span className="act-t">{o.title}</span>
                                                                    <span className="act-d">{o.desc}</span>
                                                                </span>
                                                                <span className="act-tick" aria-hidden="true" />
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {/* ============================== step 2: who gets in */}
                        {step === 2 ? (
                            <div className="wiz" data-wiz="2">
                                <div className="work-head">
                                    <div>
                                        <h2 className="work-h">Who gets in, and on what terms</h2>
                                        <p className="sm sub mt4">The checks a visitor has to pass, and how the lock behaves once they do.</p>
                                    </div>
                                    {helpnote}
                                </div>
                                <div className="work-body">
                                    <div className="work-opts">
                                        <div className="col-conds">
                                            <div className="col-h">
                                                <span className="sec-l">Conditions</span>
                                                <div className="seg" id="operator" role="radiogroup" aria-label="How the conditions combine">
                                                    {[['AND', 'all must match'], ['OR', 'any can match']].map(([v, d]) => (
                                                        <label key={v} className={`seg-b${operator === v ? ' on' : ''}`}>
                                                            <input type="radio" name="op" value={v} checked={operator === v} onChange={() => setOperator(v)} />
                                                            <span className="seg-t">{v}</span>
                                                            <span className="seg-d">{d}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <p className="help" style={{ flex: 'none', marginBottom: 11 }} id="operatorHelp">
                                                Customer must meet {operator === 'AND' ? 'all' : 'any'} of the conditions below to unlock access.
                                            </p>

                                            <div id="conds">
                                                {conditions.map((c, i) => {
                                                    const def = conditionByValue(c.type);
                                                    const said = conditionSummary(c);
                                                    return (
                                                        <div
                                                            key={`${c.type}-${i}`}
                                                            className="crow"
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => setCondModal({ open: true, index: i })}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    setCondModal({ open: true, index: i });
                                                                }
                                                            }}
                                                        >
                                                            <span className="crow-n">{i + 1}</span>
                                                            <span className="crow-b">
                                                                <span className="crow-t">{def ? def.label : 'Choose a condition'}</span>
                                                                <span className={`crow-v${said ? '' : ' none'}`}>
                                                                    {said || 'Not set yet — click to fill it in'}
                                                                </span>
                                                            </span>
                                                            {def ? <span className={`tag ${def.w}`}>{def.w === 'form' ? 'Form' : 'Text'}</span> : null}
                                                            {conditions.length > 1 ? (
                                                                <button
                                                                    type="button"
                                                                    className="btn plain icon crow-x"
                                                                    aria-label="Remove condition"
                                                                    onClick={(e) => { e.stopPropagation(); removeCondition(i); }}
                                                                >
                                                                    <Icon name="trash" size={14} strokeWidth={1.8} />
                                                                </button>
                                                            ) : null}
                                                            <span className="crow-go" aria-hidden="true"><Icon name="chevron" strokeWidth={2} /></span>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <button
                                                type="button"
                                                className="addtile"
                                                id="addCond"
                                                onClick={() => setCondModal({ open: true, index: null })}
                                                disabled={usedTypes.length >= (type === 'checkout' ? CHECKOUT_CONDITION_TYPES.size : CONDITIONS.length)}
                                            >
                                                <span className="addtile-p" aria-hidden="true">+</span> Add condition
                                            </button>
                                            <p className="help" style={{ flex: 'none', marginTop: 8 }} id="condCount">
                                                {countLabel(conditions.length, 'conditions')}
                                            </p>
                                        </div>

                                        <div className="col-set">
                                            <div className="col-h">
                                                <span><span className="sec-l">Settings</span><span className="tag">All optional</span></span>
                                            </div>
                                            <div className="set-grid">
                                                {type === 'products' ? (
                                                    <div className="sect" id="variantWrap">
                                                        <span className="sec-l">Variant behaviour (product locks only)</span>
                                                        <div className="v-two">
                                                            <div className="field">
                                                                <span className="label">When a variant is locked</span>
                                                                <div className="seg wide" role="radiogroup" aria-label="When a variant is locked">
                                                                    {[['hide', 'Hide it entirely'], ['disable', 'Show it, but disabled']].map(([v, l]) => (
                                                                        <label key={v} className={`seg-b${lockedVariantDisplay === v ? ' on' : ''}`}>
                                                                            <input type="radio" name="vLocked" value={v} checked={lockedVariantDisplay === v} onChange={() => setLockedVariantDisplay(v)} />
                                                                            <span className="seg-t">{l}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div className="field">
                                                                <span className="label">When all variants are locked</span>
                                                                <div className="chips" role="radiogroup" aria-label="When all variants of a product are locked">
                                                                    {[['hide_product', 'Hide the product entirely', 'eyeOff'], ['show_disabled', 'Leave the product visible', 'eye']].map(([v, l, ic]) => (
                                                                        <label key={v} className={`chip${allVariantsLockedBehavior === v ? ' on' : ''}`}>
                                                                            <input type="radio" name="vAll" value={v} checked={allVariantsLockedBehavior === v} onChange={() => setAllVariantsLockedBehavior(v)} />
                                                                            <span className="act-ic" aria-hidden="true"><Icon name={ic} /></span>
                                                                            <span className="chip-t">{l}</span>
                                                                            <span className="act-tick" aria-hidden="true" />
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null}

                                                <div className="col4">
                                                    <div className="sect">
                                                        <span className="sec-l">Redirect and search engines</span>
                                                        <div className="fields2">
                                                            <div className="field">
                                                                <label className="label" htmlFor="redirect">Redirect URL (optional)</label>
                                                                <input className="input" id="redirect" placeholder="https://" value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} />
                                                                <span className="help">Send blocked visitors here instead of showing the popup.</span>
                                                            </div>
                                                            <div className="field">
                                                                <span className="label">Search engines</span>
                                                                <label className="chk" style={{ marginTop: 5 }}>
                                                                    <input type="checkbox" checked={seoBlock} onChange={(e) => setSeoBlock(e.target.checked)} />
                                                                    <span>Hide from search engines</span>
                                                                </label>
                                                                <span className="help">Adds a noindex meta tag so Googlebot won&rsquo;t index the locked page.</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="col4">
                                                    <div className="sect" id="scheduleWrap">
                                                        <span className="sec-l">Schedule (optional)</span>
                                                        <div className="fields2">
                                                            <div className="field">
                                                                <span className="label">Activate on</span>
                                                                <div className="row g8">
                                                                    <input className="input" type="date" aria-label="Activate on date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                                                    <input className="input" type="time" aria-label="Activate on time" style={{ width: 110 }} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                                                                </div>
                                                                <span className="help">Leave blank to activate immediately.</span>
                                                            </div>
                                                            <div className="field">
                                                                <span className="label">Expire on</span>
                                                                <div className="row g8">
                                                                    <input className="input" type="date" aria-label="Expire on date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                                                    <input className="input" type="time" aria-label="Expire on time" style={{ width: 110 }} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                                                                </div>
                                                                <span className="help">Leave blank for no expiration.</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {/* ========== steps 3 and 4: what visitors see / turn it on */}
                        {step === 3 || step === 4 ? (
                            <div className="wiz" data-wiz="3">
                                <div className="work-head">
                                    <div>
                                        <h2 className="work-h">{step3Title}</h2>
                                        <p className="sm sub mt4">{step3Sub}</p>
                                    </div>
                                    {helpnote}
                                </div>
                                <div className="work-body">
                                    <div className="work-opts">
                                        {step === 3 ? (
                                            <div className="half" id="popupHalf">
                                                {making ? null : (
                                                    <div className="between" id="kindBox" style={{ flex: 'none', marginBottom: 9 }}>
                                                        <span className="sec-l" style={{ margin: 0 }}>What visitors see</span>
                                                        <span className={`tag ${needs.form ? 'form' : 'text'}`}>{needs.form ? 'Form' : 'Text'}</span>
                                                    </div>
                                                )}
                                                <div id="popupBlock">
                                                    {making ? (
                                                        <WidgetEditor
                                                            kind={making}
                                                            widgets={making === 'text' ? textWidgets : formWidgets}
                                                            storeLocales={storeLocales}
                                                            primaryLocale={primaryLocale}
                                                            onDraft={setDraft}
                                                            onCancel={() => { setMaking(null); setDraft(null); }}
                                                            onCreated={(id) => {
                                                                if (making === 'text') setTextWidgetId(id);
                                                                else setWidgetId(id);
                                                                setMaking(null);
                                                                setDraft(null);
                                                                toast('Widget created');
                                                            }}
                                                            onError={(message) => toast(message, true)}
                                                        />
                                                    ) : (
                                                        <>
                                                            <div className="fields2" style={{ flex: 'none' }}>
                                                                {needs.form ? designPicks('form') : null}
                                                                {needs.text ? designPicks('text') : null}
                                                            </div>

                                                            <div className="divider" id="saysRule" style={{ margin: '14px 0', flex: 'none' }} />

                                                            <div id="saysBox" style={{ flex: 'none' }}>
                                                                <span className="sec-l" style={{ display: 'block', marginBottom: 5 }}>What the popup says</span>
                                                                <p className="help" id="saysCopy">
                                                                    {shownWidget ? (
                                                                        <><b>{shownWidget.name}</b> sets how it <em>looks</em>. Below is what it <em>says</em>, for this lock only.</>
                                                                    ) : (
                                                                        <>No design is selected, so it uses the default look. Below is what it <em>says</em>, for this lock only.</>
                                                                    )}
                                                                </p>
                                                                {shownWidget ? (
                                                                    <p className="help">Other locks using {shownWidget.name} keep their own wording.</p>
                                                                ) : null}
                                                                {changedWording.length ? (
                                                                    <p className="help">You changed the {changedWording.join(', ')}.</p>
                                                                ) : null}
                                                            </div>

                                                            <div id="wordBlock">
                                                                <div className="between" style={{ flex: 'none', marginTop: 4 }}>
                                                                    <span className="sec-l" style={{ margin: 0 }}>Wording for this lock</span>
                                                                </div>
                                                                <div className="wfields mt10" style={{ flex: 'none' }}>
                                                                    <div className="field">
                                                                        <label className="label" htmlFor="wTitle">Title</label>
                                                                        <input className="input" id="wTitle" placeholder={defaults.title} value={popupText.header || ''} onChange={(e) => setWord('header', e.target.value)} />
                                                                    </div>
                                                                    <div className="field">
                                                                        <label className="label" htmlFor="wMsg">Message</label>
                                                                        <input className="input" id="wMsg" placeholder={defaults.description} value={description} onChange={(e) => setDescription(e.target.value)} />
                                                                    </div>
                                                                    {kinds.has('passcode') ? (
                                                                        <>
                                                                            <div className="field">
                                                                                <label className="label" htmlFor="wPL">Passcode box &mdash; label</label>
                                                                                <input className="input" id="wPL" placeholder={defaults.passcodeLabel} value={popupText.passcode_label || ''} onChange={(e) => setWord('passcode_label', e.target.value)} />
                                                                            </div>
                                                                            <div className="field">
                                                                                <label className="label" htmlFor="wPH">Passcode box &mdash; hint inside</label>
                                                                                <input className="input" id="wPH" placeholder={defaults.passcodePlaceholder} value={popupText.passcode_placeholder || ''} onChange={(e) => setWord('passcode_placeholder', e.target.value)} />
                                                                            </div>
                                                                        </>
                                                                    ) : null}
                                                                    {kinds.has('email') ? (
                                                                        <>
                                                                            <div className="field">
                                                                                <label className="label" htmlFor="wEL">Email box &mdash; label</label>
                                                                                <input className="input" id="wEL" placeholder={defaults.emailLabel} value={popupText.email_label || ''} onChange={(e) => setWord('email_label', e.target.value)} />
                                                                            </div>
                                                                            <div className="field">
                                                                                <label className="label" htmlFor="wEH">Email box &mdash; hint inside</label>
                                                                                <input className="input" id="wEH" placeholder={defaults.emailPlaceholder} value={popupText.email_placeholder || ''} onChange={(e) => setWord('email_placeholder', e.target.value)} />
                                                                            </div>
                                                                        </>
                                                                    ) : null}
                                                                    {kinds.size > 0 ? (
                                                                        <div className="field">
                                                                            <label className="label" htmlFor="wBtn">Button</label>
                                                                            <input className="input" id="wBtn" placeholder={defaults.button} value={popupText.button || ''} onChange={(e) => setWord('button', e.target.value)} />
                                                                        </div>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="half embed-wrap" id="embedHalf">
                                                <span className="sec-l" style={{ flex: 'none', marginBottom: 9 }}>Turn it on</span>
                                                <div className={`embed${embedOn ? ' on' : ''}`}>
                                                    <span className="embed-ic" aria-hidden="true">
                                                        <Icon name={embedOn ? 'check' : 'warn'} strokeWidth={embedOn ? 2.2 : 1.8} />
                                                    </span>
                                                    <span className="embed-t">
                                                        {embed.enabled === null
                                                            ? (embed.checking ? 'Checking the app embed…' : 'Could not check the app embed')
                                                            : embedOn ? 'App embed is on' : 'App embed is off'}
                                                    </span>
                                                    <span className="embed-d">
                                                        {embedOn ? 'Your locks run on the storefront.' : 'Your locks will not run on the storefront until you turn it on.'}
                                                    </span>
                                                    <div className="row g8 embed-act">
                                                        {embed.deepLink ? (
                                                            <a className="btn primary" href={embed.deepLink} target="_blank" rel="noopener noreferrer">
                                                                {embedOn ? 'Open theme editor' : 'Enable in theme editor'}
                                                            </a>
                                                        ) : null}
                                                        <button type="button" className={`btn${embed.checking ? ' syncing' : ''}`} onClick={() => checkEmbed(true)} disabled={embed.checking}>
                                                            {embed.checking ? 'Checking…' : 'Check again'}
                                                        </button>
                                                    </div>
                                                    <span className="embed-note">
                                                        {embedOn
                                                            ? 'Nothing else to do here. Changing themes later turns it off again.'
                                                            : 'Opens the editor with the embed already switched on — you only have to press Save.'}
                                                    </span>
                                                </div>

                                                {embedOn ? null : (
                                                    <>
                                                        <span className="xs sub howto-l">Or switch it on yourself</span>
                                                        <ol className="howto">
                                                            <li><span className="howto-n">1</span><span><strong>Online Store &rsaquo; Themes</strong>, then <strong>Customize</strong> your live theme.</span></li>
                                                            <li><span className="howto-n">2</span><span>Open <strong>App embeds</strong> in the left panel.</span></li>
                                                            <li><span className="howto-n">3</span><span>Switch on <strong>Airo Access Lock</strong> and press <strong>Save</strong>.</span></li>
                                                            <li><span className="howto-n">4</span><span>Come back here and press <strong>Check again</strong>.</span></li>
                                                        </ol>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {preview}
                                </div>
                            </div>
                        ) : null}

                        {/* ===================================== step 6: done */}
                        {step === 6 ? (
                            <DoneStep
                                rows={rows}
                                scene={scene}
                                revealed={revealed}
                                embedOn={embedOn}
                                summary={summary}
                                firstLock={firstLockRef.current}
                                leaving={leaving}
                                onQuickView={createdLockId ? () => finish(`/lock/${createdLockId}/preview`) : null}
                                onClose={() => finish('/locks')}
                            />
                        ) : null}

                        {step !== 6 ? (
                            <div className="work-foot">
                                <button type="button" className="btn" onClick={back}>
                                    {at === 0 ? 'Back to welcome' : 'Back'}
                                </button>
                                <div className="row g8">
                                    <button
                                        type="button"
                                        className="btn primary"
                                        onClick={next}
                                        disabled={(step === 1 && !step1Ready) || !!making}
                                        title={making ? 'Finish or cancel the widget first' : undefined}
                                    >
                                        {lastQuestion ? 'Create my lock' : 'Continue'}
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </section>
                </div>
            </main>

            <ItemPicker
                open={pickerOpen}
                type={pickType}
                noun={noun}
                items={lists[pickType] || []}
                selected={selected}
                lockedBy={lockedBy}
                refreshing={refreshing}
                onRefresh={refreshCatalog}
                onClose={() => setPickerOpen(false)}
                onAdd={(ids) => { setSelected(ids); setPickerOpen(false); }}
            />

            <ConditionModal
                open={condModal.open}
                index={condModal.index}
                condition={condModal.index === null ? null : conditions[condModal.index]}
                usedTypes={usedTypes}
                checkoutMode={type === 'checkout'}
                storefrontBase={storefrontBase}
                onSave={saveCondition}
                onClose={() => setCondModal({ open: false, index: null })}
            />
        </div>
    );
}
