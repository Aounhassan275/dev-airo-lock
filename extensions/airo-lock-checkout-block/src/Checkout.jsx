/**
 * Airo Access Lock & Control — Checkout UI Extension (5.5)
 *
 * The soft-block UX layer for checkout access rules:
 *  - shows a "Checkout restricted" banner when an enabled checkout lock
 *    fails for the current buyer;
 *  - renders an "Access code" field when a lock has passcode conditions,
 *    persisting the entry to the `_airo_access_code` cart attribute so
 *    the validation Function can enforce it server-side;
 *  - blocks progression client-side via useBuyerJourneyIntercept.
 *
 * Rendered at purchase.checkout.header.render-after — a static target that
 * renders on EVERY checkout (physical, digital, and store-pickup), unlike
 * delivery-address which is absent on no-ship carts. That gap previously
 * meant the Function hard-blocked a passcode lock with no field for the
 * buyer to enter the code. (Accelerated/express wallets like Shop Pay skip
 * the checkout UI entirely — a platform limitation no extension can cover;
 * there the Function still enforces server-side.)
 *
 * The Shopify Function (extensions/airo-lock-checkout-validation) is the
 * hard server-side enforcement layer; both read the same
 * access_control.checkout_rule shop metafield.
 *
 * EVALUABLE here: signedIn, email conditions (specific/contains/list),
 * passcode conditions (the field below), and location once an address is
 * known. NOT evaluable — treated as possibly-true so nobody is falsely
 * blocked: tag, ip, secret links, ageVerification (the admin hides these
 * from checkout locks). Location is skipped until an address exists so a
 * buyer is never blocked before Shopify knows where they are.
 *
 * IMPORTANT: keep the evaluation logic in sync with
 * airo-lock-checkout-validation/src/run.js (server twin).
 */

import {
    Banner,
    BlockStack,
    reactExtension,
    Text,
    TextField,
    useApplyAttributeChange,
    useAppMetafields,
    useAttributeValues,
    useBuyerJourneyIntercept,
    useCustomer,
    useEmail,
    useShippingAddress,
} from '@shopify/ui-extensions-react/checkout';

const ACCESS_CODE_ATTRIBUTE = '_airo_access_code';
const PASSCODE_TYPES = ['passcode', 'singlePasscode', 'multiplePasscodes', 'passcodeFromList', 'pairedCredentials'];
// Types this layer can decide (mirror of run.js EVALUABLE_TYPES). Location
// is listed but only actually decidable once an address exists.
const EVALUABLE_TYPES = [
    'signedIn',
    'specificEmail',
    'emailContains',
    'emailFromList',
    'location',
    'passcode',
    'singlePasscode',
    'multiplePasscodes',
    'passcodeFromList',
    // Both halves are known at checkout: the address from buyer identity, the
    // code from the access-code field.
    'pairedCredentials',
];
/**
 * One stored `email,passcode` line -> its two halves. Mirror of splitPair()
 * in run.js, the storefront validator and AccessRule::splitPair().
 */
function splitPair(line) {
    const text = String(line || '').trim();
    const at = text.search(/[,;	:]/);
    if (at === -1) return { email: text.toLowerCase(), passcode: '' };

    return { email: text.slice(0, at).trim().toLowerCase(), passcode: text.slice(at + 1).trim() };
}

const DEFAULT_PROMPT = 'This order cannot be completed with your current details. Please contact the store for access.';

// Single always-rendering target. One registration = one banner/field, no
// duplicate UI.
export default reactExtension('purchase.checkout.header.render-after', () => <AccessGate />);

function AccessGate() {
    // All hooks run unconditionally, before any early return.
    const customer = useCustomer();
    const contactEmail = useEmail();
    const shippingAddress = useShippingAddress();
    const [attributeCode] = useAttributeValues([ACCESS_CODE_ATTRIBUTE]);
    const applyAttributeChange = useApplyAttributeChange();

    // Declared in shopify.extension.toml under [[extensions.metafields]];
    // written by Laravel (AccessLockcontroller::updateCheckoutMetafield).
    const metafields = useAppMetafields({
        type: 'shop',
        namespace: 'access_control',
        key: 'checkout_rule',
    });

    const locks = parseLocks(metafields);
    const ctx = {
        loggedIn: Boolean(customer?.id),
        email: (customer?.email || contactEmail || '').toLowerCase(),
        country: (shippingAddress?.countryCode || '').toUpperCase(),
        province: (shippingAddress?.provinceCode || '').toUpperCase(),
        city: (shippingAddress?.city || '').toUpperCase(),
        accessCode: (attributeCode || '').trim(),
    };

    const activeLocks = locks.filter((lock) => lock && lock.enabled !== false && isWithinSchedule(lock));
    const blockingLock = activeLocks.find((lock) => !isAllowed(lock, ctx));
    const needsPasscode = activeLocks.some((lock) => hasPasscodeCondition(lock));

    useBuyerJourneyIntercept(({ canBlockProgress }) => {
        if (canBlockProgress && blockingLock) {
            return {
                behavior: 'block',
                reason: 'Access restricted',
                errors: [{ message: blockingLock.prompt || DEFAULT_PROMPT }],
            };
        }
        return { behavior: 'allow' };
    });

    if (!blockingLock) return null;

    return (
        <BlockStack>
            <Banner status="critical" title="Checkout restricted">
                <Text>{blockingLock.prompt || DEFAULT_PROMPT}</Text>
            </Banner>
            {needsPasscode ? (
                <TextField
                    label="Access code"
                    value={attributeCode || ''}
                    onChange={(value) =>
                        applyAttributeChange({
                            type: 'updateAttribute',
                            key: ACCESS_CODE_ATTRIBUTE,
                            value: (value || '').trim(),
                        })
                    }
                />
            ) : null}
        </BlockStack>
    );
}

function parseLocks(metafields) {
    const ruleMetafield = metafields?.find((m) => m.target?.type === 'shop' && m.metafield?.key === 'checkout_rule');
    if (!ruleMetafield) return [];

    let parsed;
    try {
        parsed = typeof ruleMetafield.metafield.value === 'string' ? JSON.parse(ruleMetafield.metafield.value) : ruleMetafield.metafield.value;
    } catch {
        return [];
    }

    // Backend stores checkout rules as { locks: [ {rule}, ... ] }
    // (MetafieldService::updateMetafieldArray). Tolerate a legacy flat object too.
    return Array.isArray(parsed?.locks) ? parsed.locks : parsed ? [parsed] : [];
}

function hasPasscodeCondition(lock) {
    return (lock.conditions || []).some((group) =>
        (group?.conditions || []).some((c) => c && PASSCODE_TYPES.includes(c.type))
    );
}

/**
 * Multi-value conditions store one newline-joined string. Old admin
 * builds taught merchants to save backslash-separated values on a
 * single line ('123\2222\3333') — accept those separators too.
 * Mirrors splitListValue in run.js / access_validator.js.
 */
function splitListValue(value) {
    const raw = String(value || '');
    const parts = raw.includes('\n') ? raw.split('\n') : raw.split(/\\n|\\/);
    return parts.map((p) => p.trim()).filter((p) => p);
}

/**
 * Day-granular schedule gate. The browser has a real clock, so Date is
 * safe here (unlike the WASM function twin). Fails open on a broken bound.
 */
function isWithinSchedule(lock) {
    if (!lock.starts_at && !lock.expires_at) return true;
    try {
        const now = Date.now();
        if (lock.starts_at) {
            const start = Date.parse(lock.starts_at);
            if (Number.isFinite(start) && now < start) return false;
        }
        if (lock.expires_at) {
            const end = Date.parse(lock.expires_at);
            if (Number.isFinite(end) && now > end) return false;
        }
        return true;
    } catch {
        return false;
    }
}

function isConditionEvaluable(condition, ctx) {
    if (!EVALUABLE_TYPES.includes(condition.type)) return false;
    if (condition.type === 'location' && !ctx.country && !ctx.province && !ctx.city) return false;
    return true;
}

function isAllowed(rule, ctx) {
    const groups = rule.conditions || [];
    if (groups.length === 0) return true;
    // Allowed if any group could pass. Only deny when every group is
    // definitively failed by the conditions we can evaluate here.
    return groups.some((group) => groupMightPass(group, ctx));
}

function groupMightPass(group, ctx) {
    const conditions = group.conditions || [];
    if (conditions.length === 0) return true;

    const operator = (group.operator || 'AND').toUpperCase();
    const evaluable = conditions.filter((c) => c && isConditionEvaluable(c, ctx));
    const hasUnevaluable = evaluable.length !== conditions.length;

    if (operator === 'OR') {
        // An unevaluable condition could be the one that passes.
        return hasUnevaluable || evaluable.some((c) => evalCondition(c, ctx));
    }

    // AND: all evaluable conditions must pass; unevaluable ones are
    // assumed possibly-true so they never force a denial on their own.
    return evaluable.every((c) => evalCondition(c, ctx));
}

function evalCondition(condition, ctx) {
    const value = condition.value || '';
    const invert = Boolean(condition.invert);
    let result = false;

    switch (condition.type) {
        case 'signedIn':
            // Empty value is a legacy save meaning 'loggedIn' (storefront parity).
            result = value === 'guest' ? !ctx.loggedIn : ctx.loggedIn;
            break;
        case 'passcode':
        case 'singlePasscode':
            result = Boolean(ctx.accessCode) && ctx.accessCode === value.trim();
            break;
        case 'multiplePasscodes':
        case 'passcodeFromList':
            result = Boolean(ctx.accessCode) && splitListValue(value).includes(ctx.accessCode);
            break;
        case 'specificEmail':
            result = Boolean(ctx.email) && ctx.email === value.toLowerCase().trim();
            break;
        case 'emailContains':
            result = Boolean(ctx.email) && ctx.email.includes(value.toLowerCase());
            break;
        case 'emailFromList':
            result = Boolean(ctx.email) && splitListValue(value).map((e) => e.toLowerCase()).includes(ctx.email);
            break;
        case 'pairedCredentials':
            // Both halves must come from the same row (mirror of run.js).
            result = Boolean(ctx.email) && Boolean(ctx.accessCode) && splitListValue(value).some((line) => {
                const pair = splitPair(line);
                return pair.email === ctx.email && pair.passcode === ctx.accessCode;
            });
            break;
        case 'location':
            if (value === 'custom') {
                const custom = (condition.custom || '').trim().toUpperCase();
                // Empty custom value = misconfigured condition — fail open.
                const known = [ctx.country, ctx.province, ctx.city].filter(Boolean).join(' ');
                result = custom ? known.includes(custom) : true;
            } else {
                result = Boolean(ctx.country) && ctx.country === value.toUpperCase();
            }
            break;
        default:
            // Unknown/unevaluable types are filtered out by groupMightPass;
            // anything that still lands here fails safe.
            result = false;
    }

    return invert ? !result : result;
}
