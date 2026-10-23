import { useMemo, useState } from 'react';
import ConditionList, { OperatorSeg } from './ConditionList';
import EmbedStatus from './EmbedStatus';
import LockPreview from './LockPreview';
import PopupWording, { initialPreviewLocale, useLocaleOptions } from './PopupWording';
import WidgetPicks from './WidgetPicks';
import { conditionShortName } from './conditionTypes';
import { nounFor } from './ItemPickerModal';
import {
    ACTION_ICONS,
    BackIcon,
    ChevronDownIcon,
    CloseIcon,
    EyeIcon,
    EyeOffIcon,
    InfoIcon,
    ListIcon,
    REPROMPT_ICONS,
    TYPE_ICONS,
} from './LockIcons';
import { PlanBadge, goToPricing } from './planGate';

/*
 * The one-page lock builder — /lock/create and /lock/{lock}/configure.
 *
 * Purely presentational. Every value comes from the page and every change goes
 * back through the page's own handlers, so the state, the validation and the
 * payloads stay where they were; this only decides how they are laid out:
 * five numbered sections in the order a lock reads, and a rail with the live
 * popup and the running summary.
 */

/* The eight things a lock can cover. `sum` keys the tile colours in airo.css. */
const TYPE_CARDS = [
    { value: 'products', label: 'Products', sum: 'Products', d: 'Individual products you pick.' },
    { value: 'collections', label: 'Collections', sum: 'Collections', d: 'Lock a trade catalogue, leave the rest open.' },
    { value: 'pages', label: 'Pages', sum: 'Pages', d: 'Course pages, downloads, price lists.' },
    { value: 'blogs', label: 'Blogs', sum: 'Blogs', d: 'A whole blog, for members-only writing.' },
    { value: 'price_hide', label: 'Hide price rule', sum: 'Hide price rule', d: 'Products stay visible; price and cart hidden.' },
    { value: 'themes', label: 'Liquid theme', sum: 'Liquid theme', d: 'Target a theme rather than its pages.' },
    { value: 'store', label: 'Store', sum: 'Store', d: 'Every page of the storefront asks for access.' },
    { value: 'checkout', label: 'Checkout (Plus)', sum: 'Checkout', d: 'Visitors pass your conditions before they can check out.' },
];

/** What a shopper sees when the action is not "gate" — no popup at all. */
const NO_POPUP_NOTE = {
    hide_cart: 'The product page looks normal. The Add to Cart button is simply not there.',
    hide_completely: 'The item is gone from grids, search and menus, and its URL redirects home.',
    hide_all: 'The collection and its products are gone from the storefront entirely.',
    hide_collection_only: 'The collection page is gone. Its products are still reachable on their own.',
    hide_cart_products: 'Products still appear. None of them can be added to the cart.',
};

const REPROMPT_OPTIONS = [
    {
        value: 'remember',
        label: 'Stay unlocked on this device',
        d: 'Customers unlock once and are not asked again on that browser.',
    },
    {
        value: 'session',
        label: 'Ask again on their next visit',
        d: 'Customers browse freely once unlocked, but are asked again when they come back later.',
    },
    {
        value: 'always',
        label: 'Ask again on every page',
        d: 'Customers re-enter their details on every page, including a refresh. Use for sensitive content; it is deliberate friction.',
    },
];

function Section({ n, title, desc, off = false, aside = null, children, id }) {
    return (
        <section className={`sec-c${off ? ' off' : ''}`} id={id}>
            <div className="sec-hd">
                <span className="sec-n">{n}</span>
                <div className="grow">
                    <h2 className="sec-t2">{title}</h2>
                    <p className="sec-d2">{desc}</p>
                </div>
                {aside}
            </div>
            <div className="sec-b">{children}</div>
        </section>
    );
}

function Notice({ children, tone = '' }) {
    return (
        <div className={`notice${tone ? ` lb-${tone}` : ''}`}>
            <span className="lb-notice-ic" aria-hidden="true">
                <InfoIcon />
            </span>
            <span>{children}</span>
        </div>
    );
}

export default function LockBuilderForm({
    // header
    title,
    lockId = null,
    statusBadge = null,
    saveLabel,
    saveDisabled,
    saveable,
    onSave,
    onBack,
    onCancel,
    onDelete = null,

    // what to lock
    lockConfig,
    updateLockConfig,
    contentTypeTier,
    onSelectContentType,
    resolveSelected,
    onOpenPicker,
    onClearItems,
    onRemoveItem,
    selectedOverlaps = [],
    unmatchedRules = [],
    products = [],
    variants = [],
    expandedVariantProduct,
    onExpandVariant,
    onToggleVariant,
    variantNumericId,
    lockActionOptions = [],
    lockActionHelp = {},
    onLockAction,

    // who gets in
    groups,
    onGroupChange,
    onAddCondition,

    // what visitors see
    requiredWidgetTypes,
    formWidgets = [],
    textWidgets = [],
    storeLocales = [],
    primaryLocale = '',

    // how it behaves
    enabled,
    onEnabledChange,
    redirectUrl,
    onRedirectUrlChange,
    onSeoBlockChange,
    onLockedVariantDisplayChange,
    onAllVariantsLockedChange,
    schedulingTier,
    startDate,
    startTime,
    endDate,
    endTime,
    onStartDate,
    onStartTime,
    onEndDate,
    onEndTime,

    // turn it on
    embedStatus,
}) {
    const isPrice = lockConfig.lockType === 'price_hide';
    const type = lockConfig.selectedContentType;
    const activeCard = isPrice ? 'price_hide' : type;
    const items = lockConfig.selectedItems || [];
    const gateAction = !isPrice && (lockConfig.lockAction || 'gate') === 'gate';
    const group = groups[0];
    const conditions = group?.conditions || [];
    const embedOn = embedStatus?.enabled ?? null;

    // The design the popup is drawn with: the form design when the conditions
    // ask for input, otherwise the text design.
    const previewWidget = useMemo(() => {
        const id = requiredWidgetTypes.needsForm
            ? lockConfig.widget_id
            : requiredWidgetTypes.needsText
              ? lockConfig.text_widget_id
              : lockConfig.widget_id || lockConfig.text_widget_id;
        return [...formWidgets, ...textWidgets].find((w) => String(w.id) === String(id)) || null;
    }, [requiredWidgetTypes, lockConfig.widget_id, lockConfig.text_widget_id, formWidgets, textWidgets]);

    const localeOptions = useLocaleOptions(storeLocales);
    const [locale, setLocale] = useState(() => initialPreviewLocale(previewWidget, storeLocales, primaryLocale));

    /* ------------------------------------------------------ the summary -- */

    const noun = nounFor(type || 'products', items.length);
    const protects = (() => {
        if (type === 'checkout' && items.length > 0) return { v: 'Your checkout', set: true };
        if (items.length > 0) return { v: `${items.length} ${noun}${isPrice ? ', prices hidden' : ''}`, set: true };
        return { v: 'Nothing chosen yet', set: false };
    })();
    const opensFor = (() => {
        if (isPrice) return { v: 'Not used by a price rule', set: false };
        const typed = conditions.filter((c) => c.type);
        if (typed.length === 0) return { v: 'No conditions yet', set: false };
        if (typed.length === 1) return { v: conditionShortName(typed[0].type), set: true };
        return { v: `${typed.length} conditions, ${group.operator === 'AND' ? 'all' : 'any'} must match`, set: true };
    })();
    const shows = (() => {
        if (isPrice) return { v: lockConfig.priceMessage || 'Hidden price', set: true };
        if (!gateAction) return { v: 'Nothing — it is hidden', set: true };
        return { v: previewWidget?.name || 'Default design', set: true };
    })();

    /* ------------------------------------------------------ item picker -- */

    const whole = type === 'checkout';
    const pickedTitles = items
        .slice(0, 3)
        .map((selId) => resolveSelected(selId))
        .filter(Boolean)
        .map((it) => it.title || it.name || it.handle);

    let itemsText = 'Choose a type above first';
    let itemsSub = 'Pick the exact items this lock covers.';
    if (whole) {
        itemsText = 'Your checkout will be locked.';
        itemsSub = 'There is nothing to narrow down — the lock covers all of it.';
    } else if (type) {
        itemsText = items.length > 0 ? `${items.length} ${noun} selected` : 'Nothing chosen yet';
        itemsSub =
            items.length > 0
                ? pickedTitles.join(', ') + (items.length > pickedTitles.length ? ` and ${items.length - pickedTitles.length} more` : '')
                : `Pick the exact ${nounFor(type, 2)} this lock covers.`;
    }

    /* ---------------------------------------------------- variant rows --- */

    const variantRows =
        type === 'products'
            ? items
                  .filter((s) => s.startsWith('products-'))
                  .map((selId) => {
                      const pid = selId.slice('products-'.length);
                      const product = products.find((p) => String(p.shopify_product_id) === String(pid));
                      const productVariants = variants.filter((v) => String(v.shopify_product_id) === String(pid));
                      if (!product || productVariants.length <= 1) return null;
                      return { selId, product, productVariants };
                  })
                  .filter(Boolean)
            : [];

    return (
        <div className="airo pg-lock-builder">
            <main className="page full">
                <div className="pg-head">
                    <div className="grow" style={{ minWidth: 0 }}>
                        <a
                            className="back-l"
                            href="/locks"
                            onClick={(e) => {
                                e.preventDefault();
                                onBack();
                            }}
                        >
                            <BackIcon />
                            Locks
                        </a>
                        <div className="row g8 wrap" style={{ marginTop: 2 }}>
                            <h1 className="pg-t">{title}</h1>
                            {lockId ? <span className="xs sub">#{lockId}</span> : null}
                            {statusBadge}
                        </div>
                    </div>
                    <div className="row g8 wrap">
                        {onDelete ? (
                            <button type="button" className="btn" onClick={onDelete}>
                                Delete
                            </button>
                        ) : null}
                        <button type="button" className="btn" onClick={onCancel}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn primary"
                            onClick={onSave}
                            disabled={saveDisabled}
                            title={saveable ? undefined : 'Name the lock and choose what it covers first.'}
                        >
                            {saveLabel}
                        </button>
                    </div>
                </div>

                <div className="one">
                    <div className="one-main">
                        {/* ============================================ 1. scope */}
                        <Section
                            n={1}
                            title="What to lock"
                            desc="Name it, choose the content, and decide what locking actually does to it."
                        >
                            <div className="field lb-narrow">
                                <label className="label" htmlFor="lb-lock-name">
                                    Lock name <span className="req" aria-hidden="true">*</span>
                                </label>
                                <input
                                    className="input"
                                    id="lb-lock-name"
                                    aria-required="true"
                                    placeholder="e.g. Wholesale catalogue"
                                    value={lockConfig.name}
                                    onChange={(e) => updateLockConfig({ name: e.target.value })}
                                    autoComplete="off"
                                />
                                <span className="help">Only you see this. It appears in your locks list.</span>
                            </div>

                            <div className="divider lb-rule" />

                            <span className="sec-l lb-l">
                                Content to lock <span className="req" aria-hidden="true">*</span>
                            </span>
                            <div className="opts2" role="radiogroup" aria-label="Content to lock">
                                {TYPE_CARDS.map((card) => {
                                    const tier = contentTypeTier(card.value);
                                    const on = activeCard === card.value;

                                    return (
                                        <button
                                            key={card.value}
                                            type="button"
                                            role="radio"
                                            aria-checked={on}
                                            className={`opt${on ? ' on' : ''}`}
                                            data-sum={card.sum}
                                            onClick={() => {
                                                // Plan-gated types can't be selected — send
                                                // the merchant to upgrade instead.
                                                if (tier) {
                                                    goToPricing();
                                                    return;
                                                }
                                                onSelectContentType(card.value);
                                            }}
                                        >
                                            <span className="opt-ic">{TYPE_ICONS[card.value]}</span>
                                            <span className="grow">
                                                <span className="opt-t">
                                                    {card.label} {tier ? <PlanBadge tier={tier} /> : null}
                                                </span>
                                                <span className="opt-d">{card.d}</span>
                                            </span>
                                            <span className="opt-tick" />
                                        </button>
                                    );
                                })}
                            </div>

                            <div className={`pickbar mt8${items.length > 0 ? ' set' : ''}`}>
                                <span className="pickbar-ic">
                                    <ListIcon />
                                </span>
                                <span className="grow">
                                    <span className="sm strong">{itemsText}</span>
                                    <span className="help">{itemsSub}</span>
                                </span>
                                {items.length > 0 && !whole ? (
                                    <button type="button" className="btn" onClick={onClearItems}>
                                        Clear all
                                    </button>
                                ) : null}
                                <button type="button" className="btn" onClick={onOpenPicker} disabled={!type || whole}>
                                    {whole ? 'Nothing to choose' : items.length > 0 ? 'Change' : `Choose ${type ? nounFor(type, 2) : 'items'}`}
                                </button>
                            </div>

                            {items.length > 0 && !whole ? (
                                <div className="lb-chips">
                                    {items.slice(0, 6).map((selId) => {
                                        const item = resolveSelected(selId);
                                        if (!item) return null;
                                        return (
                                            <span key={selId} className="lb-chip">
                                                <span className="lb-chip-t">{item.title || item.name || item.handle}</span>
                                                <button
                                                    type="button"
                                                    className="lb-chip-x"
                                                    aria-label={`Remove ${item.title || item.name || ''}`}
                                                    onClick={() => onRemoveItem(selId)}
                                                >
                                                    <CloseIcon />
                                                </button>
                                            </span>
                                        );
                                    })}
                                    {items.length > 6 ? <span className="xs sub">+ {items.length - 6} more</span> : null}
                                </div>
                            ) : null}

                            {selectedOverlaps.length > 0 ? (
                                <div className="mt8">
                                    <Notice tone="warn">
                                        <b>Another active lock already covers some of these items.</b> Only one lock is
                                        enforced per item — the one saved most recently (a custom widget design takes
                                        priority).{' '}
                                        {selectedOverlaps
                                            .slice(0, 3)
                                            .map((o) => `${o.title} is also locked by "${o.lockName}"`)
                                            .join('; ')}
                                        {selectedOverlaps.length > 3 ? `; and ${selectedOverlaps.length - 3} more` : ''}.
                                    </Notice>
                                </div>
                            ) : null}

                            {unmatchedRules.length > 0 ? (
                                <div className="mt8">
                                    <Notice tone="warn">
                                        <b>Some items on this lock can&apos;t be shown here.</b> {unmatchedRules.length} locked
                                        item{unmatchedRules.length !== 1 ? 's' : ''} (
                                        {unmatchedRules
                                            .slice(0, 3)
                                            .map((r) => r.handle || r.resource_type)
                                            .join(', ')}
                                        {unmatchedRules.length > 3 ? `, and ${unmatchedRules.length - 3} more` : ''}){' '}
                                        {unmatchedRules.length !== 1 ? 'are' : 'is'} not in your synced catalog — renamed in
                                        Shopify, or not synced yet. They stay locked and are kept when you save.
                                    </Notice>
                                </div>
                            ) : null}

                            {variantRows.length > 0 ? (
                                <div className="lb-variants">
                                    <span className="sec-l lb-l">Lock specific variants (optional)</span>
                                    <p className="help">
                                        Leave a product&apos;s variants unchecked to lock the whole product. Check variants to
                                        lock only those; behaviour is controlled by the variant settings in section 4.
                                    </p>
                                    {variantRows.map(({ selId, product, productVariants }) => {
                                        const selected = (lockConfig.variantSelections && lockConfig.variantSelections[selId]) || [];
                                        const open = expandedVariantProduct === selId;
                                        return (
                                            <div key={selId} className={`lb-vrow${open ? ' open' : ''}`}>
                                                <button
                                                    type="button"
                                                    className="lb-vrow-h"
                                                    aria-expanded={open}
                                                    onClick={() => onExpandVariant(open ? null : selId)}
                                                >
                                                    <span className="grow sm strong">{product.title}</span>
                                                    <span className="xs sub">
                                                        {selected.length > 0 ? `${selected.length} variant(s) locked` : 'entire product'}
                                                    </span>
                                                    <span className="lb-vrow-c" aria-hidden="true">
                                                        <ChevronDownIcon />
                                                    </span>
                                                </button>
                                                {open ? (
                                                    <div className="lb-vrow-b">
                                                        {productVariants.map((v) => {
                                                            const vid = variantNumericId(v);
                                                            return (
                                                                <label key={vid} className="chk">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selected.includes(vid)}
                                                                        onChange={(e) => onToggleVariant(selId, vid, e.target.checked)}
                                                                    />
                                                                    <span>{v.title}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}

                            <div className="divider lb-rule" />

                            {isPrice ? (
                                <div className="lb-price">
                                    <span className="sec-l lb-l">Price visibility</span>
                                    <div className="field">
                                        <label className="label" htmlFor="lb-price-msg">
                                            Price hidden message
                                        </label>
                                        <input
                                            className="input"
                                            id="lb-price-msg"
                                            placeholder="Sign in to see price"
                                            value={lockConfig.priceMessage}
                                            onChange={(e) => updateLockConfig({ priceMessage: e.target.value })}
                                            autoComplete="off"
                                        />
                                        <span className="help">Message to display in place of the price.</span>
                                    </div>
                                    <span className="label mt12" style={{ display: 'block' }}>
                                        Visibility options
                                    </span>
                                    <div className="acts">
                                        <label className={`act${lockConfig.hideOnAllPages ? ' on' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={!!lockConfig.hideOnAllPages}
                                                onChange={(e) => updateLockConfig({ hideOnAllPages: e.target.checked })}
                                            />
                                            <span className="act-box" aria-hidden="true" />
                                            <span className="act-c">
                                                <span className="act-t">Hide on all pages (Collections, Search, etc.)</span>
                                                <span className="act-d">Price is hidden wherever the product appears.</span>
                                            </span>
                                        </label>
                                        <label className={`act${lockConfig.hideOnCheckout ? ' on' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={!!lockConfig.hideOnCheckout}
                                                onChange={(e) => updateLockConfig({ hideOnCheckout: e.target.checked })}
                                            />
                                            <span className="act-box" aria-hidden="true" />
                                            <span className="act-c">
                                                <span className="act-t">Disallow Add to Cart / Checkout</span>
                                                <span className="act-d">Hides &apos;Add to Cart&apos; buttons and prevents checkout.</span>
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            ) : (
                                <div className="field lb-actions">
                                    <span className="label">When locked, do this</span>
                                    <div className="acts tiles" role="radiogroup" aria-label="When locked, do this">
                                        {lockActionOptions.map((o) => {
                                            const on = lockConfig.lockAction === o.value;
                                            return (
                                                <label key={o.value} className={`act${on ? ' on' : ''}`}>
                                                    <input
                                                        type="radio"
                                                        name="lb-lock-action"
                                                        value={o.value}
                                                        checked={on}
                                                        onChange={() => onLockAction(o.value)}
                                                    />
                                                    <span className="act-ic" aria-hidden="true">
                                                        {ACTION_ICONS[o.value] || ACTION_ICONS.gate}
                                                    </span>
                                                    <span className="act-c">
                                                        <span className="act-t">{o.label}</span>
                                                        <span className="act-d">{lockActionHelp[o.value] || ''}</span>
                                                    </span>
                                                    <span className="act-tick" aria-hidden="true" />
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </Section>

                        {/* ======================================== 2. who gets in */}
                        <Section
                            n={2}
                            title="Who gets in"
                            desc={
                                isPrice
                                    ? 'A hide price rule has no access checks — its settings are in section 1.'
                                    : 'The checks a visitor has to pass before the lock opens.'
                            }
                            off={isPrice}
                            aside={
                                !isPrice && group ? (
                                    <OperatorSeg
                                        operator={group.operator}
                                        onChange={(op) => onGroupChange(0, { ...group, operator: op })}
                                    />
                                ) : null
                            }
                        >
                            {isPrice ? (
                                <Notice>
                                    <b>No conditions for a price rule.</b> The price stays hidden behind your message on the
                                    products it covers.
                                </Notice>
                            ) : group ? (
                                <ConditionList
                                    group={group}
                                    checkoutMode={type === 'checkout'}
                                    onChange={(updated) => onGroupChange(0, updated)}
                                    onAddCondition={() => onAddCondition(0)}
                                />
                            ) : null}
                        </Section>

                        {/* ================================== 3. what visitors see */}
                        <Section
                            n={3}
                            id="lb-see"
                            title="What visitors see"
                            desc={
                                isPrice
                                    ? 'A hide price rule shows its message in place of the price, so there is no popup.'
                                    : gateAction
                                      ? 'Choose how the popup looks, and what it says on this lock.'
                                      : 'This action hides the content outright, so there is nothing for a shopper to read.'
                            }
                            off={!gateAction}
                            aside={
                                gateAction ? (
                                    <span className="row g4">
                                        {requiredWidgetTypes.needsForm ? <span className="tag form">Form</span> : null}
                                        {requiredWidgetTypes.needsText ? <span className="tag text">Text</span> : null}
                                    </span>
                                ) : null
                            }
                        >
                            {!gateAction ? (
                                <Notice>
                                    <b>No popup is shown for this {isPrice ? 'lock' : 'action'}.</b>{' '}
                                    {isPrice ? '' : `${NO_POPUP_NOTE[lockConfig.lockAction] || ''} `}There is no widget or
                                    wording to set.
                                </Notice>
                            ) : (
                                <>
                                    {!requiredWidgetTypes.needsForm && !requiredWidgetTypes.needsText ? (
                                        <Notice>Add a condition to choose a widget design.</Notice>
                                    ) : null}

                                    <div className="lb-designs">
                                        {requiredWidgetTypes.needsForm ? (
                                            <WidgetPicks
                                                type="form"
                                                label="Form widget design"
                                                help="Used for conditions that need user input (passcode, age verification)."
                                                widgets={formWidgets}
                                                value={lockConfig.widget_id}
                                                onChange={(value) => updateLockConfig({ widget_id: value })}
                                                onCreated={(id) => updateLockConfig({ widget_id: id })}
                                                storeLocales={storeLocales}
                                                primaryLocale={primaryLocale}
                                            />
                                        ) : null}
                                        {requiredWidgetTypes.needsText ? (
                                            <WidgetPicks
                                                type="text"
                                                label="Text widget design"
                                                help="Used for conditions that don't need input (tag, signed in, location)."
                                                widgets={textWidgets}
                                                value={lockConfig.text_widget_id}
                                                onChange={(value) => updateLockConfig({ text_widget_id: value })}
                                                onCreated={(id) => updateLockConfig({ text_widget_id: id })}
                                                storeLocales={storeLocales}
                                                primaryLocale={primaryLocale}
                                            />
                                        ) : null}
                                    </div>

                                    <div className="divider lb-rule" />

                                    <PopupWording
                                        popupText={lockConfig.popupText}
                                        description={lockConfig.description}
                                        onChange={(popupText) => updateLockConfig({ popupText })}
                                        onDescriptionChange={(description) => updateLockConfig({ description })}
                                        groups={groups}
                                        widget={previewWidget}
                                        locale={locale}
                                        onLocaleChange={setLocale}
                                        localeOptions={localeOptions}
                                    />
                                </>
                            )}
                        </Section>

                        {/* ========================================== 4. behaviour */}
                        <Section
                            n={4}
                            title="How it behaves"
                            desc={
                                isPrice
                                    ? 'Whether the rule is running.'
                                    : 'How long access lasts, where visitors go once they are in, and when the lock runs. All optional.'
                            }
                        >
                            <div className="two-col">
                                {isPrice ? null : (
                                    <div>
                                        <div className="sect">
                                            <span className="sec-l">How long access lasts</span>
                                            <div className="field">
                                                <span className="label">After a customer unlocks this</span>
                                                <div className="acts tiles" role="radiogroup" aria-label="After a customer unlocks this">
                                                    {REPROMPT_OPTIONS.map((o) => {
                                                        const on = (lockConfig.reprompt || 'remember') === o.value;
                                                        return (
                                                            <label key={o.value} className={`act${on ? ' on' : ''}`}>
                                                                <input
                                                                    type="radio"
                                                                    name="lb-reprompt"
                                                                    value={o.value}
                                                                    checked={on}
                                                                    onChange={() => updateLockConfig({ reprompt: o.value })}
                                                                />
                                                                <span className="act-ic" aria-hidden="true">
                                                                    {REPROMPT_ICONS[o.value]}
                                                                </span>
                                                                <span className="act-c">
                                                                    <span className="act-t">{o.label}</span>
                                                                    <span className="act-d">{o.d}</span>
                                                                </span>
                                                                <span className="act-tick" aria-hidden="true" />
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="sect">
                                            <span className="sec-l">Redirect and search engines</span>
                                            <div className="field">
                                                <label className="label" htmlFor="lb-redirect">
                                                    Redirect URL (optional)
                                                </label>
                                                <input
                                                    className="input"
                                                    id="lb-redirect"
                                                    placeholder="https://example.com/access-granted"
                                                    value={redirectUrl}
                                                    onChange={(e) => onRedirectUrlChange(e.target.value)}
                                                    autoComplete="off"
                                                />
                                                <span className="help">
                                                    Where to redirect customers after successful authentication.
                                                </span>
                                            </div>
                                            <div className="field mt12">
                                                <span className="label">Search engines</span>
                                                <label className="chk" style={{ marginTop: 5 }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={!!lockConfig.seoBlock}
                                                        onChange={(e) => onSeoBlockChange(e.target.checked)}
                                                    />
                                                    <span>Hide from search engines</span>
                                                </label>
                                                <span className="help">
                                                    Adds a noindex meta tag so Googlebot won&rsquo;t index the locked page.
                                                    Recommended for wholesale catalogs and confidential content.
                                                </span>
                                            </div>
                                        </div>

                                        {type === 'products' ? (
                                            <div className="sect">
                                                <span className="sec-l">Variant behaviour (product locks only)</span>
                                                <div className="field">
                                                    <span className="label">When a variant is locked</span>
                                                    <div className="seg wide" role="radiogroup" aria-label="When a variant is locked">
                                                        {[
                                                            ['hide', 'Hide the variant option entirely'],
                                                            ['disable', 'Show but disable the variant option'],
                                                        ].map(([value, label]) => (
                                                            <label
                                                                key={value}
                                                                className={`seg-b${lockConfig.lockedVariantDisplay === value ? ' on' : ''}`}
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name="lb-variant-locked"
                                                                    value={value}
                                                                    checked={lockConfig.lockedVariantDisplay === value}
                                                                    onChange={() => onLockedVariantDisplayChange(value)}
                                                                />
                                                                <span className="seg-t">{label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="field mt12">
                                                    <span className="label">When all variants of a product are locked</span>
                                                    <div className="chips" role="radiogroup" aria-label="When all variants of a product are locked">
                                                        {[
                                                            ['hide_product', 'Hide the product entirely', <EyeOffIcon key="i" />],
                                                            ['show_disabled', 'Show product but disable purchasing', <EyeIcon key="i" />],
                                                        ].map(([value, label, icon]) => {
                                                            const on = lockConfig.allVariantsLockedBehavior === value;
                                                            return (
                                                                <label key={value} className={`chip${on ? ' on' : ''}`}>
                                                                    <input
                                                                        type="radio"
                                                                        name="lb-variant-all"
                                                                        value={value}
                                                                        checked={on}
                                                                        onChange={() => onAllVariantsLockedChange(value)}
                                                                    />
                                                                    <span className="act-ic" aria-hidden="true">
                                                                        {icon}
                                                                    </span>
                                                                    <span className="chip-t">{label}</span>
                                                                    <span className="act-tick" aria-hidden="true" />
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                )}

                                <div>
                                    {isPrice ? null : (
                                        <div className="sect">
                                            <span className="sec-l">
                                                Schedule (optional) <PlanBadge tier={schedulingTier()} />
                                            </span>
                                            <div className="field">
                                                <label className="label" htmlFor="lb-start-date">
                                                    Activate on
                                                </label>
                                                <div className="row g8">
                                                    <input
                                                        className="input"
                                                        id="lb-start-date"
                                                        type="date"
                                                        value={startDate}
                                                        onChange={(e) => onStartDate(e.target.value)}
                                                        disabled={!!schedulingTier()}
                                                    />
                                                    <input
                                                        className="input lb-time"
                                                        type="time"
                                                        aria-label="Activate at"
                                                        value={startTime}
                                                        onChange={(e) => onStartTime(e.target.value)}
                                                        disabled={!!schedulingTier() || !startDate}
                                                    />
                                                </div>
                                                <span className="help">Leave blank to activate immediately.</span>
                                            </div>
                                            <div className="field mt12">
                                                <label className="label" htmlFor="lb-end-date">
                                                    Expire on
                                                </label>
                                                <div className="row g8">
                                                    <input
                                                        className="input"
                                                        id="lb-end-date"
                                                        type="date"
                                                        value={endDate}
                                                        onChange={(e) => onEndDate(e.target.value)}
                                                        disabled={!!schedulingTier()}
                                                    />
                                                    <input
                                                        className="input lb-time"
                                                        type="time"
                                                        aria-label="Expire at"
                                                        value={endTime}
                                                        onChange={(e) => onEndTime(e.target.value)}
                                                        disabled={!!schedulingTier() || !endDate}
                                                    />
                                                </div>
                                                <span className="help">Leave blank for no expiration.</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="sect">
                                        <span className="sec-l">Status</span>
                                        <div className="row g8" style={{ marginBottom: 4 }}>
                                            <button
                                                type="button"
                                                className={`toggle${enabled ? '' : ' off'}`}
                                                role="switch"
                                                aria-checked={!!enabled}
                                                aria-label="Enabled"
                                                onClick={() => onEnabledChange(!enabled)}
                                            />
                                            <span className="sm">{enabled ? 'Enabled' : 'Disabled'}</span>
                                        </div>
                                        <span className="help">
                                            A disabled lock stays saved but stops running on your storefront.
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* ========================================= 5. turn it on */}
                        <Section
                            n={5}
                            title="Turn it on"
                            desc="Airo runs through a theme app embed. Without it, a saved lock is not protecting anything."
                            off={embedOn === true}
                        >
                            <EmbedStatus status={embedStatus} />
                        </Section>
                    </div>

                    {/* ---------------------------------------------------- rail */}
                    <aside className="one-rail">
                        <LockPreview
                            groups={groups}
                            popupText={lockConfig.popupText}
                            description={lockConfig.description}
                            widget={previewWidget}
                            locale={locale}
                            gateAction={gateAction}
                            noPopupNote={
                                isPrice
                                    ? `The price is replaced by “${lockConfig.priceMessage || 'Sign in to see price'}”.`
                                    : NO_POPUP_NOTE[lockConfig.lockAction]
                            }
                            embedOn={embedOn}
                            summaries={[
                                { k: 'Protects', ...protects },
                                { k: 'Opens for', ...opensFor },
                                { k: 'Shows', ...shows },
                            ]}
                        />
                        {saveable ? null : (
                            <p className="help lb-needs">Name the lock and choose what it covers first.</p>
                        )}
                    </aside>
                </div>
            </main>
        </div>
    );
}
