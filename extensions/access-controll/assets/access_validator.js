/**
 * Access Control Validator
 * Logic for evaluating access conditions
 */

window.AccessValidator = (function () {
    const INPUT_TYPES = ['singlePasscode', 'passcode', 'multiplePasscodes', 'passcodeFromList', 'specificEmail', 'emailContains', 'emailFromList', 'ageVerification', 'pairedCredentials'];

    /**
     * Which popup inputs a condition needs, in order.
     *
     * Every other condition takes exactly one input, so the popup could get
     * away with one field per condition. 'pairedCredentials' asks two questions
     * at once ("which address, and what code was issued to it?") and therefore
     * consumes TWO inputs — this is the single place that fact is declared, so
     * field generation and input consumption can never drift apart and start
     * reading a passcode out of the email box.
     *
     * Deliberately NOT named with "email" in it: several call sites decide what
     * kind of input to render by testing whether the type string contains
     * 'email', and a paired condition would have rendered both of its fields as
     * email boxes.
     */
    function inputFieldsFor(type) {
        if (type === 'pairedCredentials') return ['email', 'passcode'];
        if (INPUT_TYPES.indexOf(type) === -1) return [];
        if (String(type).toLowerCase().indexOf('email') !== -1) return ['email'];
        if (type === 'ageVerification') return ['dob'];

        return ['passcode'];
    }

    /**
     * One stored `email,passcode` line → its two halves.
     *
     * The separator is the FIRST comma, semicolon, tab or colon: an email
     * cannot contain any of them, so everything after it is the passcode, and
     * a code containing a comma survives. Mirrors parsePair() in
     * resources/js/lib/pairList.js and AccessRule::splitPair() in PHP.
     */
    function splitPair(line) {
        const text = String(line || '').trim();
        const at = text.search(/[,;\t:]/);
        if (at === -1) return { email: text.toLowerCase(), passcode: '' };

        return {
            email: text.slice(0, at).trim().toLowerCase(),
            passcode: text.slice(at + 1).trim(),
        };
    }

    // Multi-value conditions store one newline-joined string. Old admin
    // builds showed a literal '\n' in the field placeholder, so some
    // merchants saved backslash-separated values on a single line
    // ('123\2222\3333') — accept those separators too. Backslash is
    // reserved: it cannot appear inside a passcode or listed email.
    function splitListValue(value) {
        const raw = String(value || '');
        const parts = raw.includes('\n') ? raw.split('\n') : raw.split(/\\n|\\/);
        return parts.map((p) => p.trim()).filter((p) => p);
    }

    /**
     * Resolve a possibly-locale-keyed value to a plain string.
     *
     * A merchant-typed condition label is a string, but PopupTextBaker writes
     * the AUTO-mode default as a locale-keyed object ({default, en, pt-pt, …}).
     * Requirements are handed to several renderers, and any one of them that
     * interpolates the value straight into HTML prints "[object Object]" — the
     * multi-language store bug. Resolving here means every consumer, current or
     * future, only ever sees a string.
     *
     * AccessUtils.localize does the real work (exact locale → language →
     * default → first non-empty value). The inline fallback mirrors its last
     * two steps for the case where access_utils.js has not loaded.
     */
    function resolveText(value, locale) {
        if (value == null) return '';
        if (typeof value === 'string') return value;

        if (window.AccessUtils && typeof window.AccessUtils.localize === 'function') {
            return window.AccessUtils.localize(value, locale);
        }

        if (typeof value !== 'object') return String(value);
        if (value.default != null && String(value.default).trim() !== '') return String(value.default);
        const first = Object.values(value).find((v) => v != null && String(v).trim() !== '');

        return first != null ? String(first) : '';
    }

    function evaluateCondition(condition, customerData, passcode) {
        const type = condition.type || '';
        const value = condition.value || '';
        const invert = condition.invert || false;
        let result = false;


        switch (type) {
            case 'singlePasscode':
            case 'passcode':
                result = passcode && passcode.trim() === value.trim();
                break;

            case 'multiplePasscodes':
            case 'passcodeFromList':
                if (passcode) {
                    result = splitListValue(value).includes(passcode.trim());
                }
                break;

            case 'tag': {
                const customerTags = customerData.tags || [];
                // Check if customerTags is array or string
                const tagsToCheck = Array.isArray(customerTags) ? customerTags : customerTags.split(',');
                // Shopify treats tags case-insensitively and the admin field
                // is saved untrimmed — compare accordingly, or 'vip' vs 'VIP'
                // (or a pasted trailing space) never matches for anyone.
                const wantedTag = String(value || '').trim().toLowerCase();
                result = !!wantedTag && tagsToCheck.some((t) => String(t || '').trim().toLowerCase() === wantedTag);
                break;
            }

            case 'signedIn':
                const isLoggedIn = customerData.loggedIn || false;
                if (value === 'guest') {
                    result = !isLoggedIn;
                } else {
                    // 'loggedIn' is the UI default but older saves stored an
                    // empty value — without this fallback such locks were
                    // unpassable for everyone (input-less modal, no way in).
                    result = isLoggedIn;
                }
                break;

            // Email conditions: the typed value (passcode param carries the
            // email-field input) must take precedence over the account email —
            // otherwise the rendered email field is a dead-end for logged-in
            // customers whose account email doesn't match. Left blank, the
            // account email still satisfies the condition automatically.
            case 'specificEmail':
                const email = (passcode || customerData.email || '').toLowerCase();
                const targetEmail = (value || '').toLowerCase();
                result = email && email === targetEmail;
                break;

            case 'emailContains':
                const emailForContains = (passcode || customerData.email || '').toLowerCase();
                result = emailForContains && emailForContains.includes(value.toLowerCase());
                break;

            case 'emailFromList':
                const emailForList = (passcode || customerData.email || '').toLowerCase();
                if (emailForList) {
                    const emails = splitListValue(value).map((e) => e.toLowerCase());
                    result = emails.includes(emailForList);
                }
                break;

            // One passcode that only works for one address. `passcode` arrives
            // as [email, code] here — inputFieldsFor() gives this type two
            // fields. Both halves must be present and must be the SAME row of
            // the list: a code issued to someone else is no better than no code.
            case 'pairedCredentials': {
                const inputs = Array.isArray(passcode) ? passcode : [passcode, ''];
                const typedEmail = String(inputs[0] || '').trim().toLowerCase();
                const email = typedEmail || String(customerData.email || '').trim().toLowerCase();
                const code = String(inputs[1] || '').trim();
                result = !!email && !!code && splitListValue(value).some((line) => {
                    const pair = splitPair(line);
                    return pair.email === email && pair.passcode === code;
                });
                break;
            }

            case 'singleSecretLink':
            case 'secretLinkFromList': {
                // Accepted via ?access=CODE or ?code=CODE. Codes seen this
                // session are remembered so access survives navigating to
                // other locked pages without the query param.
                const urlParams = new URLSearchParams(window.location.search);
                const secretCode = (urlParams.get('access') || urlParams.get('code') || '').trim();
                // localStorage so a returning customer stays unlocked across
                // visits (revocable: changing the code invalidates old links,
                // unlike a blanket 'granted' flag). sessionStorage read keeps
                // codes captured before this change working.
                let seenCodes = [];
                try {
                    seenCodes = JSON.parse(localStorage.getItem('airo_secret_codes') || '[]')
                        .concat(JSON.parse(sessionStorage.getItem('airo_secret_codes') || '[]'));
                } catch { seenCodes = []; }
                if (secretCode && !seenCodes.includes(secretCode)) {
                    seenCodes.push(secretCode);
                    try { localStorage.setItem('airo_secret_codes', JSON.stringify(seenCodes)); } catch { /* ignore */ }
                }
                const expectedCodes = (type === 'secretLinkFromList' ? splitListValue(value) : [value])
                    .map((c) => String(c || '').trim())
                    .filter((c) => c);
                result = expectedCodes.some((c) => c === secretCode || seenCodes.includes(c));
                break;
            }

            case 'ageVerification':
                // passcode here contains the date-of-birth string (YYYY-MM-DD) entered by user
                if (passcode) {
                    const birthDate = new Date(passcode);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                    const minAge = parseInt(value) || 18;
                    result = age >= minAge;
                }
                break;

            case 'location':
                // Check customer's country against the location condition
                const customerCountry = (customerData.country || '').toUpperCase();
                if (value === 'custom') {
                    const customValue = (condition.custom || '').trim().toUpperCase();
                    // The admin placeholder suggests city/region values, so
                    // match against everything we know about the visitor,
                    // not just the country code.
                    const knownLocation = [customerData.country, customerData.city, customerData.region]
                        .filter(Boolean).join(' ').toUpperCase();
                    // Empty custom value = misconfigured condition — fail OPEN
                    // (historic behavior): never hard-lock everyone behind an
                    // input-less modal because a field was left blank.
                    result = customValue ? knownLocation.includes(customValue) : true;
                } else {
                    result = customerCountry && customerCountry === value.toUpperCase();
                }
                break;

            case 'ip':
                // IP address check
                const customerIP = customerData.ip_address || '';
                result = customerIP && customerIP === value;
                break;

            default:
                // If it's a known type but logic missing, fail safely.
                result = false;
        }

        return invert ? !result : result;
    }

    function evaluateGroup(group, customerData, enteredCodes, inputIteratorObj) {
        const conditions = group.conditions || [];
        const operator = (group.operator || 'AND').toUpperCase();

        if (conditions.length === 0) return true;

        const results = conditions.map((condition) => {
            // Consume exactly as many inputs as this condition generated fields
            // for, in the same order — one for most types, two for a paired
            // credential. The iterator must advance even when the condition
            // fails, or the next group reads the wrong boxes.
            const fields = inputFieldsFor(condition.type);
            if (fields.length === 0) {
                return evaluateCondition(condition, customerData, null);
            }

            const inputs = fields.map(() => enteredCodes[inputIteratorObj.index++] || '');

            return evaluateCondition(condition, customerData, fields.length === 1 ? inputs[0] : inputs);
        });

        if (operator === 'AND') {
            return results.every((r) => r === true);
        } else {
            return results.some((r) => r === true);
        }
    }

    function evaluateConditionsWithInputs(conditions, customerData, enteredCodes) {
        if (!conditions || conditions.length === 0) return false;

        // IMPORTANT: We must verify ALL inputs to keep iterator in sync OR clone iterator logic perfectly.
        // Since enteredCodes matches the flattened requirements list, we can just iterate.
        // HOWEVER, logic: "Any group passing grants access".
        // But we need to correctly map inputs to conditions.
        // The issue: If G0 fails, we check G1. G1's inputs start at index X.
        // We calculate X by counting required inputs in previous groups.

        // Easier approach: Calculate requirements map first.
        const reqs = getPasscodeRequirements(conditions);
        // reqs is flat list.
        // We can just re-USE the structure of `evaluateGroup` but passing the global index.

        let inputIteratorObj = { index: 0 };

        for (let i = 0; i < conditions.length; i++) {
            // We need to capture the START index for this group in case we need to "skip" inputs?
            // No, the iterator must increment regardless of success/fail to prepare for next group if this group fails?
            // Actually, if G0 fails, we proceed to G1. G1 expects inputs starting after G0's inputs.
            // So yes, we must fully iterate G0's conditions to advance the iterator, even if we know G0 failed early (short-circuit).
            // But `map` executes all. So short-circuiting in `evaluateGroup` (via every/some) operates on results.
            // So we are safe provided `evaluateGroup` processes ALL conditions.

            if (evaluateGroup(conditions[i], customerData, enteredCodes, inputIteratorObj)) {
                return true;
            }
        }

        return false;
    }

    function getPasscodeRequirements(conditions) {
        let requirements = [];
        if (!conditions || !Array.isArray(conditions)) return [];

        conditions.forEach((group, groupIndex) => {
            if (group && group.conditions) {
                group.conditions.forEach((sub, subIndex) => {
                    // One entry per field the condition needs. `field` says what
                    // kind of box to draw; deriving it from the type string is
                    // what used to mislabel email fields "Enter Passcode", and
                    // cannot describe a condition with two different fields.
                    const fields = inputFieldsFor(sub.type);

                    fields.forEach((field, fieldIndex) => {
                        const labelKey =
                            field === 'email' ? 'label.email' : field === 'dob' ? 'label.dob' : 'label.passcode';

                        // Resolved to a string up front — sub.label may be a
                        // locale-keyed object on a multi-language store, and
                        // `label` is also used as an object key below, where an
                        // object would collapse every field into one bucket.
                        // A merchant-typed label names the condition, so it only
                        // applies to its first field; the second keeps its default.
                        const customLabel = (fieldIndex === 0 ? resolveText(sub.label) : '') || null;

                        requirements.push({
                            ...sub,
                            groupIndex,
                            subIndex,
                            field,
                            fieldIndex,
                            labelKey,
                            customLabel,
                            label: customLabel || labelKey,
                        });
                    });
                });
            }
        });

        // Add display label logic. Number within each default label group —
        // a passcode + email pair must read "Enter Passcode" / "Email Address"
        // (not "Passcode 1" / "Passcode 2"), but two passcode fields or two
        // email fields must be numbered: values are consumed positionally, so
        // identical labels leave the customer guessing which field is which.
        const labelTotals = {};
        requirements.forEach((r) => { labelTotals[r.label] = (labelTotals[r.label] || 0) + 1; });
        const labelSeen = {};
        const NUMBERED = { 'label.passcode': 'label.passcodeN', 'label.email': 'label.emailN' };

        const translate = (key, vars) =>
            window.AccessI18n && typeof window.AccessI18n.t === 'function'
                ? window.AccessI18n.t(key, vars)
                : key;

        return requirements.map((req, i) => {
            let labelKey = req.labelKey;
            let labelVars = null;

            if (labelTotals[req.label] > 1) {
                labelSeen[req.label] = (labelSeen[req.label] || 0) + 1;
                if (!req.customLabel && NUMBERED[req.labelKey]) {
                    labelKey = NUMBERED[req.labelKey];
                    labelVars = { n: labelSeen[req.label] };
                }
            }

            // displayLabel stays populated for any caller that renders it
            // directly; access_ui prefers labelKey/customLabel.
            const displayLabel = req.customLabel || translate(labelKey, labelVars);

            return { ...req, inputIndex: i, labelKey, labelVars, displayLabel };
        });
    }

    return {
        INPUT_TYPES,
        inputFieldsFor,
        evaluateConditionsWithInputs,
        getPasscodeRequirements,
    };
})();
