// @ts-check

/**
 * Airo Access Lock & Control — Checkout Validation Function (5.5)
 *
 * Plus-only hard-enforcement layer for checkout access rules. Runs
 * server-side in Shopify's infrastructure; cannot be bypassed via
 * client-side tampering the way the UI extension can.
 *
 * Reads the shop's access_control.checkout_rule metafield and evaluates
 * against the cart's buyer identity, delivery/billing address, and the
 * `_airo_access_code` cart attribute (written by the checkout UI
 * extension's passcode field), returning a validation error that blocks
 * checkout completion when a rule fails.
 *
 * Soft-block UX (banner + passcode input + buyer-journey block) is the
 * UI extension's job (extensions/airo-lock-checkout-block). This
 * Function is the safety net. Registration: the Laravel backend creates
 * the Validation via validationCreate when a checkout lock is saved
 * (AccessLockcontroller::ensureCheckoutValidation) — without that the
 * function never runs.
 *
 * EVALUABLE here: signedIn, specificEmail, emailContains, emailFromList,
 * all passcode types (via the cart attribute), and location (once an
 * address is known). NOT evaluable — treated as possibly-true so they
 * never cause a false denial: tag (a static input query cannot read
 * arbitrary tag values), ip, secret links, ageVerification. Those stay
 * enforced only on the storefront; the admin hides them from checkout
 * locks (CHECKOUT_CONDITION_TYPES) so a merchant can't rely on them here.
 *
 * A location condition is unevaluable *until an address exists* (digital
 * carts before payment, or any step before the address is entered) — it
 * is skipped then rather than failing, so a legitimate buyer is never
 * blocked before Shopify even knows where they are.
 *
 * SCHEDULING is NOT done here: the WASM runtime has no reliable clock and a
 * static input query can't be parameterised per lock, so a date-only gate
 * would mis-fire by a store's UTC offset. Instead Laravel writes a checkout
 * lock to the metafield only while it is active (server time, timezone-
 * correct — AccessLockcontroller::syncLockRulesToMetafields +
 * ReconcileCheckoutSchedulesJob), and ExpireLocksJob removes it at expiry.
 * So every lock this function sees is already in its active window.
 *
 * IMPORTANT: keep evalCondition/groupMightPass/isConditionEvaluable in
 * sync with the checkout UI extension (airo-lock-checkout-block/src/
 * Checkout.jsx) and, where applicable, the storefront validator
 * (access-controll/assets/access_validator.js).
 *
 * @typedef {import("../generated/api").CartValidationsGenerateRunInput} CartValidationsGenerateRunInput
 * @typedef {import("../generated/api").CartValidationsGenerateRunResult} CartValidationsGenerateRunResult
 */

const NO_OP = { operations: [] };

// Types this function can decide. `location` is included but is only
// *actually* evaluable once an address is present (see isConditionEvaluable).
export const EVALUABLE_TYPES = new Set([
    'signedIn',
    'specificEmail',
    'emailContains',
    'emailFromList',
    'location',
    'passcode',
    'singlePasscode',
    'multiplePasscodes',
    'passcodeFromList',
    // Both halves are known here: the address from buyer identity, the code
    // from the cart's access-code attribute.
    'pairedCredentials',
]);


/**
 * One stored `email,passcode` line -> its two halves. The separator is the
 * FIRST comma, semicolon, tab or colon; an email cannot contain any of them,
 * so everything after it is the passcode. Mirrors splitPair() in the
 * storefront access_validator.js and AccessRule::splitPair() in PHP.
 * @param {string} line
 */
function splitPair(line) {
    const text = String(line || '').trim();
    const at = text.search(/[,;	:]/);
    if (at === -1) return { email: text.toLowerCase(), passcode: '' };

    return {
        email: text.slice(0, at).trim().toLowerCase(),
        passcode: text.slice(at + 1).trim(),
    };
}

/**
 * Multi-value conditions store one newline-joined string. Old admin
 * builds taught merchants to save backslash-separated values on a
 * single line ('123\2222\3333') — accept those separators too.
 * Mirrors splitListValue in the storefront access_validator.js.
 * @param {string} value
 */
export function splitListValue(value) {
    const raw = String(value || '');
    const parts = raw.includes('\n') ? raw.split('\n') : raw.split(/\\n|\\/);
    return parts.map((p) => p.trim()).filter((p) => p);
}

/**
 * @param {CartValidationsGenerateRunInput} input
 * @returns {CartValidationsGenerateRunResult}
 */
export function cartValidationsGenerateRun(input) {
    const metafield = input?.shop?.metafield;
    if (!metafield?.value) {
        return NO_OP;
    }

    let parsed;
    try {
        parsed = JSON.parse(metafield.value);
    } catch {
        return NO_OP;
    }

    // The backend stores checkout rules wrapped as { locks: [ {rule}, ... ] }
    // (MetafieldService::updateMetafieldArray). Tolerate a legacy flat object too.
    const locks = Array.isArray(parsed?.locks) ? parsed.locks : parsed ? [parsed] : [];
    if (locks.length === 0) {
        return NO_OP;
    }

    const buyerIdentity = input?.cart?.buyerIdentity;
    // Prefer the shipping address; fall back to billing so location rules
    // still work on digital / no-ship carts once payment details exist.
    const shipTo = input?.cart?.deliveryGroups?.[0]?.deliveryAddress;
    const billTo = input?.cart?.billingAddress;
    const country = (shipTo?.countryCode || billTo?.countryCode || '').toUpperCase();
    const province = (shipTo?.provinceCode || billTo?.provinceCode || '').toUpperCase();
    const city = (shipTo?.city || billTo?.city || '').toUpperCase();

    const ctx = {
        loggedIn: Boolean(buyerIdentity?.isAuthenticated) || Boolean(buyerIdentity?.customer?.id),
        email: (buyerIdentity?.customer?.email || buyerIdentity?.email || '').toLowerCase(),
        country,
        province,
        city,
        accessCode: (input?.cart?.accessCode?.value || '').trim(),
    };

    // Block on the first enabled lock the customer fails. Schedule gating is
    // handled server-side (see the header comment), so a lock present here is
    // active by construction.
    for (const lock of locks) {
        if (!lock || lock.enabled === false) continue;
        if (!isAllowed(lock, ctx)) {
            return {
                operations: [
                    {
                        validationAdd: {
                            errors: [
                                {
                                    message: lock.prompt || 'This order cannot be completed with your current account or shipping address.',
                                    target: '$.cart',
                                },
                            ],
                        },
                    },
                ],
            };
        }
    }

    return NO_OP;
}

export function isAllowed(rule, ctx) {
    const groups = rule.conditions || [];
    if (groups.length === 0) return true;
    // Allowed if any group could pass. Only deny when every group is
    // definitively failed by the conditions we can evaluate here.
    return groups.some((group) => groupMightPass(group, ctx));
}

/**
 * A condition is decidable right now only if its type is evaluable AND the
 * signal it needs is present. Location needs an address; without one it is
 * "not yet determined" and must not force a denial.
 */
export function isConditionEvaluable(condition, ctx) {
    if (!condition || !EVALUABLE_TYPES.has(condition.type)) return false;
    if (condition.type === 'location' && !ctx.country && !ctx.province && !ctx.city) return false;
    return true;
}

export function groupMightPass(group, ctx) {
    const conditions = group.conditions || [];
    if (conditions.length === 0) return true;

    const operator = (group.operator || 'AND').toUpperCase();
    const evaluable = conditions.filter((c) => isConditionEvaluable(c, ctx));
    const hasUnevaluable = evaluable.length !== conditions.length;

    if (operator === 'OR') {
        // An unevaluable condition could be the one that passes.
        return hasUnevaluable || evaluable.some((c) => evalCondition(c, ctx));
    }

    // AND: all evaluable conditions must pass; unevaluable ones are
    // assumed possibly-true so they never force a denial on their own.
    return evaluable.every((c) => evalCondition(c, ctx));
}

export function evalCondition(condition, ctx) {
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
            // Both halves must come from the same row — a code issued to
            // another buyer must not pass for this one.
            result = Boolean(ctx.email) && Boolean(ctx.accessCode) && splitListValue(value).some((line) => {
                const pair = splitPair(line);
                return pair.email === ctx.email && pair.passcode === ctx.accessCode;
            });
            break;
        case 'location':
            if (value === 'custom') {
                const custom = (condition.custom || '').trim().toUpperCase();
                // Empty custom value = misconfigured condition — fail open
                // (storefront parity: never hard-lock everyone on a blank field).
                const known = [ctx.country, ctx.province, ctx.city].filter(Boolean).join(' ');
                result = custom ? known.includes(custom) : true;
            } else {
                result = Boolean(ctx.country) && ctx.country === value.toUpperCase();
            }
            break;
        default:
            // Callers filter to evaluable types; anything else fails safe.
            result = false;
    }

    return invert ? !result : result;
}
