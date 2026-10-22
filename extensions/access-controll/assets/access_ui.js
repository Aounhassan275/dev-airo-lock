/**
 * Access Control UI
 * UI Rendering and Interaction
 */

window.AccessUI = (function () {
    /**
     * Translate a storefront string. Falls back to the raw key only if
     * access_i18n.js somehow failed to load, so the modal is never blank.
     */
    function T(key, vars, locale) {
        if (window.AccessI18n && typeof window.AccessI18n.t === 'function') {
            return window.AccessI18n.t(key, vars, locale);
        }
        return key;
    }

    /**
     * Hand the widget's language settings to the i18n layer before any
     * string is resolved, and report the locale the modal will render in.
     */
    function applyLanguage(settings) {
        var language = (settings && settings.language) || null;
        if (window.AccessI18n && typeof window.AccessI18n.configure === 'function') {
            return window.AccessI18n.configure(language);
        }
        return 'en';
    }

    function localeDirAttrs(locale) {
        var rtl = window.AccessI18n && typeof window.AccessI18n.isRTL === 'function'
            ? window.AccessI18n.isRTL(locale)
            : false;
        return {
            dir: rtl ? 'rtl' : 'ltr',
            lang: locale || 'en',
            // Inputs and labels are laid out left-aligned in LTR; mirror them
            // rather than leaving Arabic labels stranded on the wrong edge.
            textAlign: rtl ? 'right' : 'left',
        };
    }

    function getWidgetSettings(data) {
        const ld = data && data.lockData ? data.lockData : {};
        if (ld.widget && ld.widget.settings) return ld.widget.settings;
        if (ld.widget_json && ld.widget_json.settings) return ld.widget_json.settings;
        if (ld.settings && ld.settings.widget_json && ld.settings.widget_json.settings) return ld.settings.widget_json.settings;
        if (ld.settings && ld.settings.widget && ld.settings.widget.settings) return ld.settings.widget.settings;
        if (ld.lock_settings && ld.lock_settings.widget_json && ld.lock_settings.widget_json.settings) return ld.lock_settings.widget_json.settings;
        if (ld.lock_settings && ld.lock_settings.widget && ld.lock_settings.widget.settings) return ld.lock_settings.widget.settings;
        return null;
    }

    function getTextWidgetSettings(data) {
        const ld = data && data.lockData ? data.lockData : {};
        if (ld.text_widget && ld.text_widget.settings) return ld.text_widget.settings;
        if (ld.text_widget_json && ld.text_widget_json.settings) return ld.text_widget_json.settings;
        if (ld.settings && ld.settings.text_widget_json && ld.settings.text_widget_json.settings) return ld.settings.text_widget_json.settings;
        if (ld.settings && ld.settings.text_widget && ld.settings.text_widget.settings) return ld.settings.text_widget.settings;
        if (ld.lock_settings && ld.lock_settings.text_widget_json && ld.lock_settings.text_widget_json.settings) return ld.lock_settings.text_widget_json.settings;
        if (ld.lock_settings && ld.lock_settings.text_widget && ld.lock_settings.text_widget.settings) return ld.lock_settings.text_widget.settings;
        return null;
    }

    // Auto-generate text messages based on condition types.
    // Returns a translation KEY — the caller runs it through T() so the
    // same rule renders in whatever language the storefront is in.
    function conditionMessageKey(data) {
        var conditions = data.lockData ? data.lockData.conditions || [] : [];
        if (!conditions.length) return 'prompt.default';

        const INPUT_TYPES = ['singlePasscode', 'passcode', 'multiplePasscodes', 'passcodeFromList', 'specificEmail', 'emailContains', 'emailFromList', 'ageVerification'];

        // Collect all condition types across all groups and check operators
        var types = [];
        var operator = 'OR'; // Default to OR

        // Get the operator from the first group (assuming single group for now)
        if (conditions.length > 0 && conditions[0].operator) {
            operator = conditions[0].operator.toUpperCase();
        }

        var signedInValues = [];
        conditions.forEach(function (group) {
            var conds = group.conditions || [];
            conds.forEach(function (c) {
                if (c.type && types.indexOf(c.type) === -1) {
                    types.push(c.type);
                }
                if (c.type === 'signedIn') {
                    signedInValues.push(c.value || 'loggedIn');
                }
            });
        });

        // A signedIn condition can mean "logged-in customers only" OR
        // "guests only" — the instruction must match, or a guest-only lock
        // tells an already-signed-in visitor to sign in.
        var signedInGuestOnly = signedInValues.length > 0 && signedInValues.every(function (v) { return v === 'guest'; });
        var signedInMessage = signedInGuestOnly ? 'prompt.guestOnly' : 'prompt.signIn';

        const hasAnyInput = types.some(function (t) { return INPUT_TYPES.includes(t); });
        const hasAnyNonInput = types.some(function (t) { return !INPUT_TYPES.includes(t); });
        const isAndOperator = operator === 'AND';

        // Priority-based message generation with proper AND/OR awareness
        // Mixed case: non-input gate + input credentials
        if (hasAnyInput && types.indexOf('signedIn') !== -1) {
            return isAndOperator ? 'prompt.signInAndCode' : 'prompt.signInOrCode';
        }
        if (hasAnyInput && types.indexOf('tag') !== -1) {
            return isAndOperator ? 'prompt.tagAndCode' : 'prompt.tagOrCode';
        }
        if (hasAnyInput && (types.indexOf('specificEmail') !== -1 || types.indexOf('emailContains') !== -1 || types.indexOf('emailFromList') !== -1)) {
            return isAndOperator ? 'prompt.emailAndCode' : 'prompt.emailOrCode';
        }
        if (hasAnyInput && types.indexOf('location') !== -1) {
            return 'prompt.codeLocation';
        }

        if (types.indexOf('signedIn') !== -1 && types.length === 1) {
            return signedInMessage;
        }
        if (types.indexOf('tag') !== -1 && types.length === 1) {
            return 'prompt.members';
        }
        if (types.indexOf('singleSecretLink') !== -1 || types.indexOf('secretLinkFromList') !== -1) {
            return 'prompt.secretLink';
        }
        if (types.indexOf('location') !== -1 && types.length === 1) {
            return 'prompt.region';
        }
        if (types.indexOf('ip') !== -1 && types.length === 1) {
            return 'prompt.network';
        }
        if (types.indexOf('specificEmail') !== -1 || types.indexOf('emailContains') !== -1 || types.indexOf('emailFromList') !== -1) {
            return 'prompt.authorizedEmail';
        }
        if (types.indexOf('signedIn') !== -1) {
            return signedInMessage;
        }
        if (types.indexOf('tag') !== -1) {
            return 'prompt.members';
        }

        return 'prompt.contact';
    }

    function generateConditionMessage(data, locale) {
        return T(conditionMessageKey(data), null, locale);
    }

    function resolveColor(value, defaultColor = '#000000') {
        if (!value) return defaultColor;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') {
            // Handle HSB/HSV object { hue: 0-360, saturation: 0-1 (or 100?), brightness: 0-1 (or 100?) }
            // Assuming react-color structure: h (0-360), s (0-1), v/b (0-1)
            // Or { hue, saturation, brightness } from previous context

            let h = value.hue !== undefined ? value.hue : value.h || 0;
            let s = value.saturation !== undefined ? value.saturation : value.s || 0;
            let b = value.brightness !== undefined ? value.brightness : value.b !== undefined ? value.b : value.v || 0;

            // Normalize s, b if > 1 (e.g. 100 scale)
            // Usually typical HSB is S, B in [0,1]. If >1, assume [0,100]
            // But let's look at logic.
            // Safe bet: if (s > 1) s /= 100; if (b > 1) b /= 100;

            if (s > 1) s /= 100;
            if (b > 1) b /= 100;

            const k = (n) => (n + h / 60) % 6;
            const f = (n) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
            const r = Math.round(255 * f(5));
            const g = Math.round(255 * f(3));
            const bl = Math.round(255 * f(1));
            return `rgb(${r}, ${g}, ${bl})`;
        }
        return defaultColor;
    }

    function renderModal(data, requirements, onValidate) {
        // Check for AND operator with signIn + passcode for progressive flow
        var conditions = (data && data.lockData && data.lockData.conditions) || [];
        var hasAndOperator = false;
        var hasSignInCondition = false;
        var hasPasscodeCondition = false;

        if (conditions.length > 0) {
            var group = conditions[0];
            hasAndOperator = (group.operator || 'AND').toUpperCase() === 'AND';

            if (group.conditions) {
                group.conditions.forEach(function (cond) {
                    if (cond.type === 'signedIn' && cond.value === 'loggedIn') {
                        hasSignInCondition = true;
                    }
                    if (['passcode', 'singlePasscode', 'multiplePasscodes', 'passcodeFromList'].includes(cond.type)) {
                        hasPasscodeCondition = true;
                    }
                });
            }
        }

        var customerLoggedIn = data.loggedIn || false;

        // Signing in can satisfy the lock when ANY group contains a
        // signedIn (non-guest) or tag condition — tags only apply to
        // logged-in customers. Scan every group, not just the first.
        var canSatisfyByLogin = false;
        conditions.forEach(function (group) {
            ((group && group.conditions) || []).forEach(function (cond) {
                if (!cond) return;
                if (cond.type === 'signedIn' && cond.value !== 'guest') canSatisfyByLogin = true;
                if (cond.type === 'tag') canSatisfyByLogin = true;
            });
        });

        // CRITICAL FIX: Force text widget BEFORE checking input requirements
        // If AND + signIn + passcode, and user NOT logged in -> FORCE TEXT WIDGET
        var forceTextWidget = hasAndOperator && hasSignInCondition && hasPasscodeCondition && !customerLoggedIn;

        if (forceTextWidget) {
            requirements = []; // Clear requirements to force text behavior
        }

        var hasInputRequirements = Array.isArray(requirements) && requirements.length > 0;
        var lockSettings = data && data.lockData && (data.lockData.lock_settings || data.lockData.settings) || {};

        // Don't check requires_input if we're forcing text widget
        if (!forceTextWidget && !hasInputRequirements && lockSettings && lockSettings.requires_input === true) {
            hasInputRequirements = true;
        }

        // Don't check conditions if we're forcing text widget
        if (!forceTextWidget && !hasInputRequirements) {
            var allConds = (data && data.lockData && data.lockData.conditions) || [];
            var inputTypes = (window.AccessValidator && window.AccessValidator.INPUT_TYPES) || [
                'singlePasscode',
                'passcode',
                'multiplePasscodes',
                'passcodeFromList',
                'specificEmail',
                'emailContains',
                'emailFromList',
                'ageVerification',
            ];
            hasInputRequirements = Array.isArray(allConds) && allConds.some(function (g) {
                var cs = (g && g.conditions) || [];
                return Array.isArray(cs) && cs.some(function (c) { return inputTypes.includes(c.type); });
            });
        }

        // Force text behavior if forceTextWidget is true
        var isTextBehavior = forceTextWidget || !hasInputRequirements;

        // FIXED: Always try to get both widgets, prioritize based on behavior
        var formWidgetSettings = getWidgetSettings(data);
        var textWidgetSettings = getTextWidgetSettings(data);

        // Use form widget for input requirements, text widget for display-only
        var settings = isTextBehavior ? (textWidgetSettings || formWidgetSettings) : (formWidgetSettings || textWidgetSettings);

        // Language: resolve BEFORE any string is built. Defaults to the
        // storefront locale, or the locale the merchant pinned.
        var locale = applyLanguage(settings);
        var dirAttrs = localeDirAttrs(locale);

        // Check all possible locations for allow_email_request
        // legacy lock settings are not needed here

        const design = settings ? settings.designOptions || {} : {};

        // For text widgets, map flat settings to design options if missing
        if (isTextBehavior && settings) {
            if (!design.textColor && settings.textColor) design.textColor = settings.textColor;
            if (!design.cornerRadius && settings.borderRadius) design.cornerRadius = settings.borderRadius;
            // Map other potential flat properties if needed, e.g. background
            if (!design.backgroundColor && settings.backgroundColor) design.backgroundColor = settings.backgroundColor;
        }


        const colors = design.colors || {};
        const layout = design.layout || {};
        // background ignored in new design

        const styles = {
            overlayBg: 'rgba(0,0,0,0.6)',
            modalBg: resolveColor(colors.card || design.backgroundColor, '#FFFFFF'),
            textColor: resolveColor(colors.text || design.textColor, '#333333'),
            primaryColor: resolveColor(colors.buttonBg || design.primaryColor, '#008060'),
            btnTextColor: resolveColor(colors.buttonText, '#FFFFFF'),
            borderColor: resolveColor(design.borderColor, 'transparent'),
            borderWidth: layout.cardBorderWidth ? layout.cardBorderWidth + 'px' : design.borderWidth ? design.borderWidth + 'px' : '0px',
            cornerRadius: layout.cardBorderRadius ? layout.cardBorderRadius + 'px' : design.cornerRadius ? design.cornerRadius + 'px' : '12px',
            cardPadding: typeof layout.cardPadding === 'string' || typeof layout.cardPadding === 'number' ? parseInt(layout.cardPadding, 10) : 40,
            formPadding: typeof layout.formPadding === 'string' || typeof layout.formPadding === 'number' ? parseInt(layout.formPadding, 10) : 0,
            fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
        };

        // Text Content
        const L = (window.AccessUtils && window.AccessUtils.localize)
            ? window.AccessUtils.localize
            : (v) => (typeof v === 'string' ? v : (v?.default || ''));
        let prompt = L(
            (data.lockData && data.lockData.lock_settings && data.lockData.lock_settings.prompt)
            || data.lockData.prompt
            || T('prompt.default', null, locale)
        );

        // Show the sign-in action whenever logging in could satisfy the lock
        // — previously it rendered ONLY in the AND+signedIn+passcode
        // progressive flow, leaving signedIn-only / tag-only locks as a
        // dead-end modal with no way to comply.
        var showSignInButton = forceTextWidget || (canSatisfyByLogin && !customerLoggedIn);

        if (forceTextWidget) {
            prompt = T('prompt.progressiveSignIn', null, locale);
        } else {
            // In mixed setups (Form + Text widgets), still show the text-style condition message
            // even when we render input fields.
            var allCondsForPrompt = (data && data.lockData && data.lockData.conditions) || [];
            var inputTypesForPrompt = (window.AccessValidator && window.AccessValidator.INPUT_TYPES) || [
                'singlePasscode',
                'passcode',
                'multiplePasscodes',
                'passcodeFromList',
                'specificEmail',
                'emailContains',
                'emailFromList',
                'ageVerification',
            ];
            var hasNonInputTypesForPrompt = Array.isArray(allCondsForPrompt) && allCondsForPrompt.some(function (g) {
                var cs = (g && g.conditions) || [];
                return Array.isArray(cs) && cs.some(function (c) { return c && c.type && !inputTypesForPrompt.includes(c.type); });
            });

            if (isTextBehavior || hasNonInputTypesForPrompt) {
                prompt = generateConditionMessage(data, locale);
            }
        }

        // Header — a merchant-authored header wins; otherwise the
        // translated default for the resolved locale.
        const headerText = L(
            (design.headerSettings && design.headerSettings.text) || T('header.locked', null, locale)
        );
        const headerStyle = design.headerSettings
            ? `
             font-size: ${design.headerSettings.fontSize || 24}px;
             font-weight: ${design.headerSettings.bold ? 'bold' : 'normal'};
             font-style: ${design.headerSettings.italics ? 'italic' : 'normal'};
             text-align: ${design.headerSettings.alignment || 'center'};
             color: ${resolveColor(design.headerSettings.color, styles.textColor)};
             margin-bottom: 20px;
        `
            : `font-size:24px;margin:0 0 20px;color:${styles.textColor};text-align:center;`;

        // Description
        const descStyle = design.descriptionSettings
            ? `
             font-size: ${design.descriptionSettings.fontSize || 16}px;
             font-weight: ${design.descriptionSettings.bold ? 'bold' : 'normal'};
             font-style: ${design.descriptionSettings.italics ? 'italic' : 'normal'};
             text-align: ${design.descriptionSettings.alignment || 'center'};
             color: ${resolveColor(design.descriptionSettings.color, styles.textColor)};
             margin-bottom: 30px;
        `
            : `color:${styles.textColor};font-size:16px;margin-bottom:30px;text-align:center;opacity:0.9;`;

        // Submit Button
        const btnText = L(layout.buttonText || design.buttonText || T('button.submit', null, locale));

        // Inputs Generation
        let inputsHTML = '';

        if (!isTextBehavior) {
            // Generate inputs from lock conditions/requirements
            if (requirements && requirements.length > 0) {
                requirements.forEach((req, i) => {
                    // req.labelKey / req.labelVars come from the validator so
                    // auto-generated field labels translate too; a label the
                    // merchant typed on the condition still wins.
                    // Every branch runs through L: on a multi-language store a
                    // baked label is a locale-keyed object, and interpolating
                    // one straight into the HTML renders "[object Object]".
                    const fieldLabel = req.customLabel
                        ? L(req.customLabel)
                        : req.labelKey
                            ? T(req.labelKey, req.labelVars, locale)
                            : L(req.displayLabel) || '';

                    // req.field names the box to draw ('email' | 'passcode' |
                    // 'dob'). A condition can generate two fields of different
                    // kinds, which sniffing req.type cannot express. Older
                    // requirement shapes have no field, so fall back to the
                    // original type test for them.
                    const fieldKind = req.field
                        || (req.type === 'ageVerification' ? 'dob'
                            : String(req.type).toLowerCase().indexOf('email') !== -1 ? 'email' : 'passcode');

                    if (fieldKind === 'dob') {
                        inputsHTML += `
                        <div style="margin-bottom:15px;text-align:${dirAttrs.textAlign};">
                            <label class="access-widget-label" style="display:block;margin-bottom:5px;font-size:14px;color:${styles.textColor};opacity:0.8;font-weight:500">
                                ${fieldLabel || T('label.dob', null, locale)}
                            </label>
                            <input type="date" class="access-code-input access-widget-input" data-index="${i}"
                                style="width:100%;padding:15px;border:2px solid #ddd;
                                border-radius:8px;font-size:16px;box-sizing:border-box;outline:none;"
                                max="${new Date().toISOString().split('T')[0]}"
                                ${i === 0 ? 'autofocus' : ''}>
                            <p style="margin:5px 0 0;font-size:12px;color:${styles.textColor};opacity:0.6">${T('hint.minAge', { age: req.value || '18' }, locale)}</p>
                        </div>`;
                    } else if (fieldKind === 'email') {
                        inputsHTML += `
                        <div style="margin-bottom:15px;text-align:${dirAttrs.textAlign};">
                            <label class="access-widget-label" style="display:block;margin-bottom:5px;font-size:14px;color:${styles.textColor};opacity:0.8;font-weight:500">
                                ${fieldLabel}
                            </label>
                            <input type="email" class="access-code-input access-widget-input" data-index="${i}"
                                placeholder="${L(design.emailPlaceholderText) || T('placeholder.email', null, locale)}"
                                style="width:100%;padding:15px;border:2px solid #ddd;
                                border-radius:8px;font-size:16px;box-sizing:border-box;outline:none;"
                                autocomplete="email" ${i === 0 ? 'autofocus' : ''}>
                        </div>`;
                    } else {
                        inputsHTML += `
                        <div style="margin-bottom:15px;text-align:${dirAttrs.textAlign};">
                            <label class="access-widget-label" style="display:block;margin-bottom:5px;font-size:14px;color:${styles.textColor};opacity:0.8;font-weight:500">
                                ${fieldLabel}
                            </label>
                            <input type="password" class="access-code-input access-widget-input" data-index="${i}"
                                placeholder="${L(design.placeholderText) || T('placeholder.code', null, locale)}"
                                style="width:100%;padding:15px;border:2px solid #ddd;
                                border-radius:8px;font-size:16px;box-sizing:border-box;outline:none;"
                                autocomplete="off" ${i === 0 ? 'autofocus' : ''}>
                        </div>`;
                    }
                });
            }
            // Fallback when no requirements exist
            else if (data.locked) {
                inputsHTML += `
                    <div style="margin-bottom:15px;text-align:${dirAttrs.textAlign};">
                        <label class="access-widget-label" style="display:block;margin-bottom:5px;font-size:14px;color:${styles.textColor};opacity:0.8;font-weight:500">
                           ${T('label.accessKey', null, locale)}
                        </label>
                        <input type="password" class="access-code-input access-widget-input" data-index="0"
                            placeholder="${T('placeholder.accessKey', null, locale)}"
                            style="width:100%;padding:15px;border:2px solid #ddd;
                            border-radius:8px;font-size:16px;box-sizing:border-box" autocomplete="off">
                    </div>`;
            }
        }

        const modalHTML = `
        <div id="access-lock-modal" role="dialog" aria-modal="true"
            aria-labelledby="access-lock-title" aria-describedby="access-lock-desc"
            lang="${dirAttrs.lang}" dir="${dirAttrs.dir}"
            style="
            position:fixed;top:0;left:0;right:0;bottom:0;background:${styles.overlayBg};
            display:flex;align-items:center;justify-content:center;padding:${styles.formPadding}px;
            z-index:2147483647;isolation:isolate;
            font-family:${styles.fontFamily}">
            <div class="access-widget-card" style="background:${styles.modalBg};padding:${styles.cardPadding}px;
                border-radius:${styles.cornerRadius};
                border:${styles.borderWidth} solid ${styles.borderColor};
                max-width:500px;
                width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3)">

                <h2 id="access-lock-title" class="access-widget-title" style="margin:0;${headerStyle}">${headerText}</h2>
                <p id="access-lock-desc" class="access-widget-description" style="margin:0;line-height:1.6;${descStyle}">${prompt}</p>

                ${(() => {
                const settings = data.lockData.lock_settings || data.lockData.settings || {};
                if (settings.allow_email_request === true || settings.allow_email_request === 'true' || settings.allow_email_request === 1) {
                    return `<button id="request-creds-btn" style="width:100%;padding:15px;
                                background:transparent;border:2px solid black;
                                color:red;border-radius:8px;font-size:16px;font-weight:600;
                                cursor:pointer;margin-top:10px;margin-bottom:20px;" type="button">${T('button.requestCredentials', null, locale)}</button>`;
                }
                return '';
            })()}
                
                <div id="access-inputs-container">
                    ${inputsHTML}
                </div>
                
                ${!isTextBehavior
                ? `<button id="submit-btn" class="access-widget-button" style="width:100%;padding:15px;
                    background:${styles.primaryColor};
                    color:${styles.btnTextColor};border:none;border-radius:8px;font-size:16px;font-weight:600;
                    cursor:pointer;margin-top:10px;">${btnText}</button>`
                : ''
            }
                ${showSignInButton
                ? `<a href="/account/login?return_url=${encodeURIComponent(window.location.pathname + window.location.search)}"
                    class="access-widget-button" style="display:block;width:100%;padding:15px;${isTextBehavior
                    ? `background:${styles.primaryColor};color:${styles.btnTextColor};border:none;`
                    : `background:transparent;color:${styles.primaryColor};border:1px solid ${styles.primaryColor};`}border-radius:8px;font-size:16px;font-weight:600;
                    text-decoration:none;box-sizing:border-box;margin-top:10px;text-align:center;">${T('button.signIn', null, locale)}</a>
                   <p style="color:${styles.textColor};opacity:0.7;font-size:13px;margin-top:15px;text-align:center;">${T('text.noAccount', null, locale)} <a href="/account/register" style="color:${styles.primaryColor};text-decoration:underline;">${T('link.createAccount', null, locale)}</a></p>`
                : ''
            }
                ${isTextBehavior
                ? `<p style="margin-top:20px;text-align:center;"><a href="${String((data.lockData && (data.lockData.redirect_url || (data.lockData.lock_settings && data.lockData.lock_settings.redirect_url))) || '/').replace(/"/g, '&quot;')}"
                    style="color:${styles.textColor};opacity:0.7;font-size:14px;text-decoration:underline;">${T('link.backToStore', null, locale)}</a></p>`
                : ''
            }
                
                <div id="error-msg" style="color:#dc2626;margin-top:15px;font-size:14px;display:none;text-align:center;"></div>
                
                ${design.secondaryText ? `<p style="color:#999;font-size:14px;margin-top:25px;text-align:center;">${L(design.secondaryText)}</p>` : ''}
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        try {
            var customCss2 = settings && settings.customCss;
            if (customCss2 && typeof customCss2 === 'string') {
                // Prefix selectors to scope only within unlock modal
                var scope = ':is(#access-unlock-modal,#access-lock-modal)';
                var prefixSelectors = function (src) {
                    return src.replace(/(^|})(\s*[^@}{][^{}]*)\{/g, function (m, b, sel) {
                        var scoped = sel.split(',').map(function (s) { return scope + ' ' + s.trim(); }).join(', ');
                        return b + ' ' + scoped + '{';
                    });
                };
                var scopedCss = customCss2.replace(/@media[^{]+\{([\s\S]*?)\}/g, function (full, inner) {
                    return full.replace(inner, prefixSelectors(inner));
                }).replace(/(^|})(\s*[^@}{][^{}]*)\{/g, function (m, b, sel) {
                    var scoped = sel.split(',').map(function (s) { return scope + ' ' + s.trim(); }).join(', ');
                    return b + ' ' + scoped + '{';
                });
                var styleEl2 = document.getElementById('access-lock-custom-css');
                if (!styleEl2) {
                    styleEl2 = document.createElement('style');
                    styleEl2.id = 'access-lock-custom-css';
                    document.head.appendChild(styleEl2);
                }
                styleEl2.textContent = scopedCss;
            }
        } catch { /* noop */ }
        try {
            var customCss = settings && settings.customCss;
            if (customCss && typeof customCss === 'string') {
                var styleEl = document.getElementById('access-lock-custom-css');
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = 'access-lock-custom-css';
                    document.head.appendChild(styleEl);
                }
                styleEl.textContent = customCss;
            }
        } catch { /* noop */ }

        // Bind Events
        if (!isTextBehavior) {
            const submitBtn = document.getElementById('submit-btn');
            if (submitBtn) {
                submitBtn.onclick = function () {
                    onValidate();
                };
            }
        }

        const inputs = document.querySelectorAll('.access-code-input');
        inputs.forEach((input) => {
            input.onkeypress = function (e) {
                if (e.key === 'Enter') onValidate();
            };
        });

        // PR #9: trap focus inside the modal for keyboard / screen-reader users.
        // The full-lock modal is NOT escape-closable — closing it would reveal
        // gated content. trapFocus() handles Tab cycling regardless of closable.
        const modalEl = document.getElementById('access-lock-modal');
        if (modalEl && window.AccessA11y) {
            window.__accessFocusTrap = window.AccessA11y.trapFocus(modalEl, { closable: false });
        }
    }

    function hideContent(data) {
        // Core hide logic
        const selectors = ['main', '#MainContent', '.main-content', '[role="main"]'];
        selectors.forEach((s) => {
            const el = document.querySelector(s);
            if (el) el.style.display = 'none';
        });

        // Hide navigation if configured
        // Check lock_settings first (new structure), then root fallback
        const settings = (data.lockData && data.lockData.lock_settings) || data.lockData.settings || {};

        if (settings.hide_navigation) {
            const nav = document.querySelector('nav') || document.querySelector('header');
            if (nav) nav.style.display = 'none';
        }

        // Lift the synchronous pre-paint gate from the Liquid block (PR #8).
        // Body becomes visible again so the lock modal renders without the
        // brief flash of locked content underneath.
        document.documentElement.classList.remove('airo-lock-pending');
    }

    function showContent() {
        const selectors = ['main', '#MainContent', '.main-content', '[role="main"]'];
        selectors.forEach((s) => {
            const el = document.querySelector(s);
            if (el) el.style.display = '';
        });
        const nav = document.querySelector('nav') || document.querySelector('header');
        if (nav) nav.style.display = '';

        const modal = document.getElementById('access-lock-modal');
        if (modal) modal.remove();

        if (window.__accessFocusTrap && typeof window.__accessFocusTrap.release === 'function') {
            try { window.__accessFocusTrap.release(); } catch { /* noop */ }
            window.__accessFocusTrap = null;
        }

        document.documentElement.classList.remove('airo-lock-pending');
    }

    function showError(msg) {
        const errorEl = document.getElementById('error-msg');
        if (errorEl) {
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
        }
    }

    function clearInputs() {
        document.querySelectorAll('.access-code-input').forEach((el) => (el.value = ''));
        const first = document.querySelector('.access-code-input');
        if (first) first.focus();
    }

    function getEnteredCodes() {
        return Array.from(document.querySelectorAll('.access-code-input')).map((el) => el.value.trim());
    }

    function hidePrice(message) {
        // Localize the message in case the rule stored it as a per-locale object.
        if (window.AccessUtils && window.AccessUtils.localize) {
            message = window.AccessUtils.localize(message);
        }

        // Expanded selectors for various themes (Dawn, Impulse, Prestige, etc.)
        const priceSelectors = [
            '.price',
            '.product__price',
            '.price-item',
            '.product-single__price',
            '[data-product-price]',
            '.product-price',
            '[data-price]',
            '.price__regular',
            '.price__sale',
            '.product-block--price',
            '.product-info__price',
            '.product-meta__price',
            '.card-information__price-upper',
            // Specific element types that might hold price
            'span.money',
            '.money',
        ];

        const hideAll = () => {
            let hiddenCount = 0;
            priceSelectors.forEach((selector) => {
                const elements = document.querySelectorAll(selector);
                elements.forEach((el) => {
                    if (el.closest('#access-lock-modal')) return;
                    if (el.classList.contains('access-price-hidden')) return; // Already processed

                    // Hide original
                    el.style.display = 'none';
                    el.classList.add('access-price-hidden');
                    hiddenCount++;

                    // Check if we already added a message nearby
                    let msgEl = el.parentNode.querySelector('.access-price-message');
                    if (!msgEl) {
                        msgEl = document.createElement('span');
                        msgEl.className = 'access-price-message';
                        msgEl.style.color = '#666';
                        msgEl.style.fontSize = '14px';
                        msgEl.innerText = message || T('price.signInToSee');
                        // Insert before the hidden element so it stays in place
                        el.parentNode.insertBefore(msgEl, el);
                    }
                });
            });
        };

        // Initial run
        hideAll();

        // MutationObserver to watch for dynamic changes
        if (!window.accessPriceObserver) {
            window.accessPriceObserver = new MutationObserver((mutations) => {
                hideAll();
            });

            window.accessPriceObserver.observe(document.body, {
                childList: true,
                subtree: true,
            });
        }

        // --- Hide/Disable Buttons ---
        const buttonSelectors = [
            'form[action*="/cart/add"]',
            '[name="add"]',
            '.product-form__submit',
            '.shopify-payment-button',
            '.product-form__buttons',
            '[data-shopify="payment-button"]',
            '.add-to-cart',
            '#AddToCart',
            '.shopify-payment-button__button',
        ];

        const hideButtons = () => {
            let hiddenButtons = 0;
            buttonSelectors.forEach((selector) => {
                const elements = document.querySelectorAll(selector);
                elements.forEach((el) => {
                    if (el.closest('#access-lock-modal')) return;
                    if (el.style.display === 'none') return;

                    el.style.display = 'none';
                    hiddenButtons++;
                });
            });
        };

        hideButtons();
    }

    // Closable version of renderModal — for "Hide Add to Cart" mode
    function renderClosableModal(data, requirements, onValidate) {
        var hasInputRequirements = Array.isArray(requirements) && requirements.length > 0;
        var lockSettings = data && data.lockData && (data.lockData.lock_settings || data.lockData.settings) || {};
        if (!hasInputRequirements && lockSettings && lockSettings.requires_input === true) {
            hasInputRequirements = true;
        }
        if (!hasInputRequirements) {
            var allConds = (data && data.lockData && data.lockData.conditions) || [];
            var inputTypes = (window.AccessValidator && window.AccessValidator.INPUT_TYPES) || [
                'singlePasscode',
                'passcode',
                'multiplePasscodes',
                'passcodeFromList',
                'specificEmail',
                'emailContains',
                'emailFromList',
                'ageVerification',
            ];
            hasInputRequirements = Array.isArray(allConds) && allConds.some(function (g) {
                var cs = (g && g.conditions) || [];
                return Array.isArray(cs) && cs.some(function (c) { return inputTypes.includes(c.type); });
            });
        }
        var isTextBehavior = !hasInputRequirements;

        // FIXED: Always try to get both widgets, prioritize based on behavior
        var formWidgetSettings = getWidgetSettings(data);
        var textWidgetSettings = getTextWidgetSettings(data);

        // Use form widget for input requirements, text widget for display-only
        var settings = isTextBehavior ? (textWidgetSettings || formWidgetSettings) : (formWidgetSettings || textWidgetSettings);

        var locale = applyLanguage(settings);
        var dirAttrs = localeDirAttrs(locale);

        const design = settings ? settings.designOptions || {} : {};

        if (isTextBehavior && settings) {
            if (!design.textColor && settings.textColor) design.textColor = settings.textColor;
            if (!design.cornerRadius && settings.borderRadius) design.cornerRadius = settings.borderRadius;
            if (!design.backgroundColor && settings.backgroundColor) design.backgroundColor = settings.backgroundColor;
        }

        const colors = design.colors || {};
        const layout = design.layout || {};
        // background ignored in new design

        const styles = {
            overlayBg: 'rgba(0,0,0,0.6)',
            modalBg: resolveColor(colors.card || design.backgroundColor, '#ffffff'),
            textColor: resolveColor(colors.text || design.textColor, '#1a1a1a'),
            primaryColor: resolveColor(colors.buttonBg || design.primaryColor, '#008060'),
            btnTextColor: resolveColor(colors.buttonText || design.buttonTextColor, '#ffffff'),
            cornerRadius: (layout.cardBorderRadius || design.cornerRadius || 12) + 'px',
            borderWidth: (layout.cardBorderWidth || design.borderWidth || 0) + 'px',
            borderColor: resolveColor(design.borderColor || layout.borderColor, 'transparent'),
            cardPadding: typeof layout.cardPadding === 'string' || typeof layout.cardPadding === 'number' ? parseInt(layout.cardPadding, 10) : 40,
            formPadding: typeof layout.formPadding === 'string' || typeof layout.formPadding === 'number' ? parseInt(layout.formPadding, 10) : 0,
            fontFamily: design.fontFamily || '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
        };

        const L2 = (window.AccessUtils && window.AccessUtils.localize)
            ? window.AccessUtils.localize
            : (v) => (typeof v === 'string' ? v : (v?.default || ''));
        const headerText = L2(design.headerText || settings?.headerText || T('header.unlock', null, locale));
        let prompt = L2(design.bodyText || settings?.bodyText || (data.lockData && data.lockData.prompt) || T('prompt.unlock', null, locale));

        // Same mixed-widget behavior as renderModal(): show text-style message when non-input conditions exist.
        var allCondsForPrompt = (data && data.lockData && data.lockData.conditions) || [];
        var inputTypesForPrompt = (window.AccessValidator && window.AccessValidator.INPUT_TYPES) || [
            'singlePasscode',
            'passcode',
            'multiplePasscodes',
            'passcodeFromList',
            'specificEmail',
            'emailContains',
            'emailFromList',
            'ageVerification',
        ];
        var hasNonInputTypesForPrompt = Array.isArray(allCondsForPrompt) && allCondsForPrompt.some(function (g) {
            var cs = (g && g.conditions) || [];
            return Array.isArray(cs) && cs.some(function (c) { return c && c.type && !inputTypesForPrompt.includes(c.type); });
        });
        if (isTextBehavior || hasNonInputTypesForPrompt) {
            prompt = generateConditionMessage(data, locale);
        }
        const btnText = L2(layout.buttonText || design.buttonText || settings?.buttonText || T('button.submit', null, locale));

        const headerStyle = `color:${styles.textColor};font-size:${design.headerFontSize || layout.headerFontSize || '24'}px;text-align:${design.headerAlignment || layout.headerAlignment || 'center'};margin-bottom:10px;`;
        const descStyle = `color:${styles.textColor};opacity:0.75;font-size:${design.bodyFontSize || layout.bodyFontSize || '16'}px;text-align:${design.bodyAlignment || layout.bodyAlignment || 'center'};margin-bottom:25px;`;

        let inputsHTML = '';
        if (!isTextBehavior) {
            if (requirements && requirements.length > 0) {
                requirements.forEach((req, i) => {
                    // See the note in renderModal — a baked label can be a
                    // locale-keyed object, so no branch may render it raw.
                    const fieldLabel = req.customLabel
                        ? L2(req.customLabel)
                        : req.labelKey
                            ? T(req.labelKey, req.labelVars, locale)
                            : L2(req.displayLabel) || '';

                    // req.field names the box to draw ('email' | 'passcode' |
                    // 'dob'). A condition can generate two fields of different
                    // kinds, which sniffing req.type cannot express. Older
                    // requirement shapes have no field, so fall back to the
                    // original type test for them.
                    const fieldKind = req.field
                        || (req.type === 'ageVerification' ? 'dob'
                            : String(req.type).toLowerCase().indexOf('email') !== -1 ? 'email' : 'passcode');

                    if (fieldKind === 'dob') {
                        inputsHTML += `
                        <div style="margin-bottom:15px;text-align:${dirAttrs.textAlign};">
                            <label style="display:block;margin-bottom:5px;font-size:14px;color:${styles.textColor};opacity:0.8;font-weight:500">
                                ${fieldLabel || T('label.dob', null, locale)}
                            </label>
                            <input type="date" class="access-code-input" data-index="${i}"
                                style="width:100%;padding:15px;border:2px solid #ddd;
                                border-radius:8px;font-size:16px;box-sizing:border-box;outline:none;"
                                max="${new Date().toISOString().split('T')[0]}"
                                ${i === 0 ? 'autofocus' : ''}>
                            <p style="margin:5px 0 0;font-size:12px;color:${styles.textColor};opacity:0.6">${T('hint.minAge', { age: req.value || '18' }, locale)}</p>
                        </div>`;
                    } else if (fieldKind === 'email') {
                        inputsHTML += `
                        <div style="margin-bottom:15px;text-align:${dirAttrs.textAlign};">
                            <label style="display:block;margin-bottom:5px;font-size:14px;color:${styles.textColor};opacity:0.8;font-weight:500">
                                ${fieldLabel}
                            </label>
                            <input type="email" class="access-code-input" data-index="${i}"
                                placeholder="${L2(design.emailPlaceholderText) || T('placeholder.email', null, locale)}"
                                style="width:100%;padding:15px;border:2px solid #ddd;
                                border-radius:8px;font-size:16px;box-sizing:border-box;outline:none;"
                                autocomplete="email" ${i === 0 ? 'autofocus' : ''}>
                        </div>`;
                    } else {
                        inputsHTML += `
                        <div style="margin-bottom:15px;text-align:${dirAttrs.textAlign};">
                            <label style="display:block;margin-bottom:5px;font-size:14px;color:${styles.textColor};opacity:0.8;font-weight:500">
                                ${fieldLabel}
                            </label>
                            <input type="password" class="access-code-input" data-index="${i}"
                                placeholder="${L2(design.placeholderText) || T('placeholder.code', null, locale)}"
                                style="width:100%;padding:15px;border:2px solid #ddd;
                                border-radius:8px;font-size:16px;box-sizing:border-box;outline:none;"
                                autocomplete="off" ${i === 0 ? 'autofocus' : ''}>
                        </div>`;
                    }
                });
            } else if (data.locked) {
                inputsHTML += `
                <div style="margin-bottom:15px;text-align:${dirAttrs.textAlign};">
                    <label style="display:block;margin-bottom:5px;font-size:14px;color:${styles.textColor};opacity:0.8;font-weight:500">
                       ${T('label.accessKey', null, locale)}
                    </label>
                    <input type="password" class="access-code-input" data-index="0"
                        placeholder="${T('placeholder.accessKey', null, locale)}"
                        style="width:100%;padding:15px;border:2px solid #ddd;
                        border-radius:8px;font-size:16px;box-sizing:border-box" autocomplete="off">
                </div>`;
            }
        }

        const modalHTML = `
        <div id="access-unlock-modal" role="dialog" aria-modal="true"
            aria-labelledby="access-unlock-title" aria-describedby="access-unlock-desc"
            lang="${dirAttrs.lang}" dir="${dirAttrs.dir}"
            style="
            position:fixed;top:0;left:0;right:0;bottom:0;background:${styles.overlayBg};padding:${styles.formPadding}px;
            z-index:2147483647;isolation:isolate;display:flex;align-items:center;justify-content:center;
            font-family:${styles.fontFamily}">
            <div class="access-widget-card" style="background:${styles.modalBg};padding:${styles.cardPadding}px;
                border-radius:${styles.cornerRadius};
                border:${styles.borderWidth} solid ${styles.borderColor};
                max-width:500px;
                width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);position:relative">
                <button id="access-unlock-close" aria-label="${T('button.close', null, locale)}" style="position:absolute;top:12px;${dirAttrs.dir === 'rtl' ? 'left' : 'right'}:16px;background:none;border:none;font-size:24px;cursor:pointer;color:${styles.textColor};opacity:0.5;line-height:1" type="button">&times;</button>

                <h2 id="access-unlock-title" class="access-widget-title" style="margin:0;${headerStyle}">${headerText}</h2>
                <p id="access-unlock-desc" class="access-widget-description" style="margin:0;line-height:1.6;${descStyle}">${prompt}</p>

                <div id="access-inputs-container">
                    ${inputsHTML}
                </div>
                
                ${!isTextBehavior
                ? `<button id="submit-btn" class="access-widget-button" style="width:100%;padding:15px;
                    background:${styles.primaryColor};
                    color:${styles.btnTextColor};border:none;border-radius:8px;font-size:16px;font-weight:600;
                    cursor:pointer;margin-top:10px;">${btnText}</button>`
                : ''
            }
                
                <div id="error-msg" style="color:#dc2626;margin-top:15px;font-size:14px;display:none;text-align:center;"></div>
                
                ${design.secondaryText ? `<p style="color:#999;font-size:14px;margin-top:25px;text-align:center;">${L2(design.secondaryText)}</p>` : ''}
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // PR #9: focus trap + Escape-to-close for this closable variant.
        const unlockEl = document.getElementById('access-unlock-modal');
        const teardown = () => {
            const modal = document.getElementById('access-unlock-modal');
            if (modal) modal.remove();
            if (window.__accessUnlockFocusTrap && typeof window.__accessUnlockFocusTrap.release === 'function') {
                try { window.__accessUnlockFocusTrap.release(); } catch { /* noop */ }
                window.__accessUnlockFocusTrap = null;
            }
        };
        if (unlockEl && window.AccessA11y) {
            window.__accessUnlockFocusTrap = window.AccessA11y.trapFocus(unlockEl, {
                closable: true,
                onClose: teardown,
            });
        }

        // Close button
        document.getElementById('access-unlock-close').onclick = teardown;

        // Click outside to close
        document.getElementById('access-unlock-modal').onclick = function (e) {
            if (e.target === this) teardown();
        };

        // Bind submit
        if (!isTextBehavior) {
            const submitBtn = document.getElementById('submit-btn');
            if (submitBtn) {
                submitBtn.onclick = function () {
                    const inputEls = document.querySelectorAll('#access-unlock-modal .access-code-input');
                    const enteredCodes = Array.from(inputEls).map((el) => el.value.trim());
                    onValidate(enteredCodes);
                };
            }
        }

        const inputs = document.querySelectorAll('#access-unlock-modal .access-code-input');
        inputs.forEach((input) => {
            input.onkeypress = function (e) {
                if (e.key === 'Enter') {
                    const inputEls = document.querySelectorAll('#access-unlock-modal .access-code-input');
                    const enteredCodes = Array.from(inputEls).map((el) => el.value.trim());
                    onValidate(enteredCodes);
                }
            };
        });
    }

    return {
        renderModal,
        renderClosableModal,
        hideContent,
        showContent,
        showError,
        clearInputs,
        getEnteredCodes,
        hidePrice,
        t: T,
        conditionMessageKey,
        generateConditionMessage,
    };
})();
