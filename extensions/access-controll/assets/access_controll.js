
const API_URL = 'https://lock.airoapps.com/api/storefront';

window.AccessControl = (function () {
    const INPUT_TYPES = ['singlePasscode', 'passcode', 'multiplePasscodes', 'passcodeFromList', 'specificEmail', 'emailContains', 'emailFromList', 'ageVerification'];

    // Helper functions
    // Simple hash function for conditions
    function hashConditions(conditions) {
        if (!conditions || !Array.isArray(conditions)) return '';
        try {
            const str = JSON.stringify(conditions);
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash).toString(36);
        } catch (e) {
            return '';
        }
    }

    function getCacheKey(data) {
        // Include conditions hash to invalidate cache when conditions change
        const conditionsHash = data.lockData?.conditions ? hashConditions(data.lockData.conditions) : '';
        return 'access_' + data.type + '_' + data.handle + '_' + (data.ruleId || '') + '_' + conditionsHash;
    }

    function validateLocally(passcode, lockData) {
        if (!lockData || !lockData.simple_passcodes) return false;
        const simplePasscodes = lockData.simple_passcodes || [];
        return simplePasscodes.includes(passcode);
    }

    // Helper to find all passcode conditions required
    // Helper to find all passcode conditions required across ALL groups
    function getPasscodeRequirements(conditions) {
        let requirements = [];
        if (!conditions || conditions.length === 0) return [];
        if (!Array.isArray(conditions)) {
            return [];
        }



        // Distribute inputs for all recognizable passcode conditions
        // logic: We show inputs for EVERY passcode condition found.
        // If groups are OR, the user only needs to fill the valid set for one group.
        // But showing all gives them the option.

        conditions.forEach((group, groupIndex) => {
            if (group && group.conditions && group.conditions.length > 0) {
                group.conditions.forEach((sub, subIndex) => {
                    // Check if this condition needs an input
                    // We now allow Email types to accept manual input if user is not logged in

                    if (INPUT_TYPES.includes(sub.type)) {
                        // On a multi-language store sub.label is a locale-keyed
                        // object, and this file renders `${req.label}` straight
                        // into the markup — without resolving it the customer
                        // sees "[object Object]" above the input.
                        let label = (window.AccessUtils && window.AccessUtils.localize)
                            ? window.AccessUtils.localize(sub.label)
                            : (typeof sub.label === 'string' ? sub.label : (sub.label && sub.label.default) || '');
                        if (!label) {
                            if (String(sub.type).toLowerCase().includes('email')) label = 'Email Address';
                            else if (sub.type === 'ageVerification') label = 'Date of Birth';
                            else label = 'Enter Passcode';
                        }


                        requirements.push({
                            ...sub,
                            groupIndex: groupIndex,
                            subIndex: subIndex,
                            label: label,
                        });
                    }
                });
            }
        });

        // Add index for UI mapping
        return requirements.map((req, i) => ({
            ...req,
            inputIndex: i,
            label: req.label === 'Enter Passcode' ? (requirements.length > 1 ? `Passcode ${i + 1}` : 'Access Code') : req.label,
        }));
    }

    function showLockModal(data) {
        const conditions = data.lockData.conditions || [];
        const passcodeReqs = getPasscodeRequirements(conditions);
        
        // Check if we have AND operator with signedIn + passcode conditions
        let hasAndOperator = false;
        let hasSignInCondition = false;
        let hasPasscodeCondition = false;
        
        if (conditions.length > 0) {
            const group = conditions[0];
            hasAndOperator = (group.operator || 'AND').toUpperCase() === 'AND';
            
            if (group.conditions) {
                group.conditions.forEach(cond => {
                    if (cond.type === 'signedIn' && cond.value === 'loggedIn') {
                        hasSignInCondition = true;
                    }
                    if (['passcode', 'singlePasscode', 'multiplePasscodes'].includes(cond.type)) {
                        hasPasscodeCondition = true;
                    }
                });
            }
        }
        
        const customerData = {
            loggedIn: data.loggedIn || false,
            tags: data.customerTags || [],
            email: data.customerEmail || '',
            country: data.customerCountry || '',
            ip_address: data.customerIP || '',
        };
        
        // PROGRESSIVE FLOW: If AND operator with signIn + passcode
        // Step 1: Show text widget if user NOT signed in
        // Step 2: Show form widget if user IS signed in
        if (hasAndOperator && hasSignInCondition && hasPasscodeCondition) {
            if (!customerData.loggedIn) {
                // User NOT signed in - show TEXT widget with sign-in message
                
                if (window.AccessUI && typeof window.AccessUI.renderModal === 'function') {
                    // Force text widget behavior by passing empty requirements
                    window.AccessUI.renderModal(data, [], function () {
                        // No validation needed, just show message
                    });
                } else {
                    // Fallback: Show simple text modal
                    showSignInOnlyModal(data);
                }
                return;
            } else {
                // User IS signed in - show FORM widget with passcode input
                // Continue to normal form widget rendering below
            }
        }

        // If AccessUI is available (custom widget styling), delegate to it
        if (window.AccessUI && typeof window.AccessUI.renderModal === 'function') {
            window.AccessUI.renderModal(data, passcodeReqs, function () {
                validatePasscode(data);
            });
            return;
        }

        // Fallback: default plain modal (no widget design)
        const prompt = (data.lockData && data.lockData.prompt) || 'Access restricted. Please enter credentials.';

        let inputsHTML = '';
        passcodeReqs.forEach((req, i) => {
            if (req.type === 'ageVerification') {
                inputsHTML += `
                <div style="margin-bottom:15px;text-align:left;">
                    <label style="display:block;margin-bottom:5px;font-size:14px;color:#666;font-weight:500">${req.label}</label>
                    <input type="date" class="access-code-input" data-index="${i}" data-group-index="${req.groupIndex}"
                        style="width:100%;padding:15px;border:2px solid #ddd;
                        border-radius:8px;font-size:16px;box-sizing:border-box" ${i === 0 ? 'autofocus' : ''}
                        max="${new Date().toISOString().split('T')[0]}">
                    <p style="margin:5px 0 0;font-size:12px;color:#888">You must be at least ${req.value || '18'} years old</p>
                </div>`;
            } else {
                inputsHTML += `
                <div style="margin-bottom:15px;text-align:left;">
                    <label style="display:block;margin-bottom:5px;font-size:14px;color:#666;font-weight:500">${req.label}</label>
                    <input type="password" class="access-code-input" data-index="${i}" data-group-index="${req.groupIndex}" placeholder="Enter code"
                        style="width:100%;padding:15px;border:2px solid #ddd;
                        border-radius:8px;font-size:16px;box-sizing:border-box" autocomplete="off" ${i === 0 ? 'autofocus' : ''}>
                </div>`;
            }
        });

        // If no passcode requirements explicitly found (e.g. tag access only?), but we are here,
        // it means auto-check failed. Maybe prompt for fallback password or just show error?
        // Fallback for empty requirements but forced lock:
        if (passcodeReqs.length === 0 && conditions.length === 0 && data.locked) {
            inputsHTML = `
                <div style="margin-bottom:15px;text-align:left;">
                    <label style="display:block;margin-bottom:5px;font-size:14px;color:#666;font-weight:500">Access Key</label>
                    <input type="password" class="access-code-input" data-index="0" placeholder="Enter access key"
                        style="width:100%;padding:15px;border:2px solid #ddd;
                        border-radius:8px;font-size:16px;box-sizing:border-box" autocomplete="off">
                </div>`;
        }

        const modalHTML = `
        <div id="access-lock-modal" style="
            position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);
            z-index:999999;display:flex;align-items:center;justify-content:center;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
            <div style="background:white;padding:40px;border-radius:12px;max-width:500px;
                width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
                <h2 style="margin:0 0 20px;color:#1a1a1a;font-size:24px">🔒 Access Required</h2>
                <p style="color:#666;line-height:1.6;margin-bottom:30px;font-size:16px">${prompt}</p>
                <div id="access-inputs-container">
                    ${inputsHTML}
                </div>
                <button id="submit-btn" style="width:100%;padding:15px;background:#008060;
                    color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;
                    cursor:pointer">Unlock Access</button>
                <div id="error-msg" style="color:#dc2626;margin-top:15px;font-size:14px;display:none"></div>
                <p style="color:#999;font-size:14px;margin-top:25px">Contact store owner for access</p>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('submit-btn').onclick = function () {
            validatePasscode(data);
        };

        const inputs = document.querySelectorAll('.access-code-input');
        inputs.forEach((input) => {
            input.onkeypress = function (e) {
                if (e.key === 'Enter') validatePasscode(data);
            };
        });
    }
    
    // Helper function to show sign-in only modal (text widget style)
    function showSignInOnlyModal(data) {
        const prompt = 'Please sign in to your account to continue.';
        
        const modalHTML = `
        <div id="access-lock-modal" style="
            position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);
            z-index:999999;display:flex;align-items:center;justify-content:center;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
            <div style="background:white;padding:40px;border-radius:12px;max-width:500px;
                width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
                <h2 style="margin:0 0 20px;color:#1a1a1a;font-size:24px">🔒 Sign In Required</h2>
                <p style="color:#666;line-height:1.6;margin-bottom:30px;font-size:16px">${prompt}</p>
                <p style="color:#888;font-size:15px;margin-bottom:20px">After signing in, you'll be asked to enter your access code.</p>
                <a href="/account/login?return_url=${encodeURIComponent(window.location.pathname)}" 
                   style="display:inline-block;width:100%;padding:15px;background:#008060;
                   color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;
                   text-decoration:none;box-sizing:border-box">Sign In</a>
                <p style="color:#999;font-size:14px;margin-top:25px">Don't have an account? <a href="/account/register" style="color:#008060">Create one</a></p>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async function validatePasscode(data) {
        const inputEls = document.querySelectorAll('.access-code-input');
        const errorEl = document.getElementById('error-msg');

        // Collect inputs mapped by index
        const enteredCodes = Array.from(inputEls).map((el) => el.value.trim());

        // Wait! We need to map inputs back to their conditions during evaluation.
        // We can pass the raw array, but we need to know which input corresponds to which condition.
        // Simpler approach:
        // Pass the array of codes. In evaluateConditionsWithInputs, we consume them in the same order we generated them.

        if (enteredCodes.every((c) => c === '') && inputEls.length > 0) {
            errorEl.textContent = 'Please enter access code';
            errorEl.style.display = 'block';
            return;
        }


        const customerData = {
            loggedIn: data.loggedIn || false,
            tags: data.customerTags || [],
            email: data.customerEmail || '',
            country: data.customerCountry || '',
            ip_address: data.customerIP || '',
        };

        const conditions = data.lockData.conditions || [];

        // Check conditions using the inputs
        if (evaluateConditionsWithInputs(conditions, customerData, enteredCodes)) {
            // Store the code(s) that worked? Or just granted.
            // Storing the joined codes creates a unique signature for this success
            grantAccess(enteredCodes.join('||'), data);
            return;
        }

        // Fallback for simple/legacy locks with no conditions array structure
        if (conditions.length === 0 && data.lockData.simple_passcodes) {
            if (validateLocally(enteredCodes[0], data.lockData)) {
                grantAccess(enteredCodes[0], data);
                return;
            }
        }

        
        // Generate helpful error message based on failed conditions
        const conditions = data.lockData.conditions || [];
        let errorMessage = 'Access denied. ';
        
        // Get operator
        let operator = 'OR';
        if (conditions.length > 0 && conditions[0].operator) {
            operator = conditions[0].operator.toUpperCase();
        }
        
        // Check what's missing
        let needsSignIn = false;
        let needsPasscode = false;
        
        conditions.forEach(group => {
            if (group.conditions) {
                group.conditions.forEach(cond => {
                    if (cond.type === 'signedIn' && cond.value === 'loggedIn') {
                        needsSignIn = true;
                    }
                    if (['passcode', 'singlePasscode', 'multiplePasscodes'].includes(cond.type)) {
                        needsPasscode = true;
                    }
                });
            }
        });
        
        if (operator === 'AND') {
            // AND logic - both required
            if (needsSignIn && !customerData.loggedIn) {
                errorMessage = 'You must be signed in AND enter the correct access code.';
            } else if (needsPasscode) {
                errorMessage = 'Incorrect access code. Please try again.';
            } else {
                errorMessage = 'Access denied. Please check your credentials.';
            }
        } else {
            // OR logic - either one works
            if (needsSignIn && needsPasscode) {
                errorMessage = 'Please sign in OR enter the correct access code.';
            } else if (needsPasscode) {
                errorMessage = 'Incorrect access code. Please try again.';
            } else {
                errorMessage = 'Access denied. Please check your credentials.';
            }
        }
        
        errorEl.textContent = errorMessage;
        errorEl.style.display = 'block';
        inputEls.forEach((el) => (el.value = ''));
        if (inputEls[0]) inputEls[0].focus();
    }

    // Specialized evaluator that distributes inputs to conditions
    function evaluateConditionsWithInputs(conditions, customerData, enteredCodes) {
        if (!conditions || conditions.length === 0) return false;

        // Re-generate the mapping structure to align inputs
        // IMPORTANT: This must strictly match getPasscodeRequirements logic

        // We can't easily re-use getPasscodeRequirements here without context,
        // so we'll implement a stateful consumer.

        let inputIterator = 0;

        // Check ALL groups (OR logic)
        for (let i = 0; i < conditions.length; i++) {
            const group = conditions[i];
            const groupOperator = (group.operator || 'AND').toUpperCase();
            const groupConditions = group.conditions || [];

            // Evaluator for this group
            let groupResults = groupConditions.map((condition) => {
                // If this condition Type required an input, consume one value
                if (INPUT_TYPES.includes(condition.type)) {
                    const codeToTest = enteredCodes[inputIterator];
                    inputIterator++; // Advance input pointer (globally across all groups)
                    return evaluateCondition(condition, customerData, codeToTest);
                } else {
                    return evaluateCondition(condition, customerData, null);
                }
            });

            // Logic for Group
            let groupPassed = false;
            if (groupOperator === 'AND') {
                groupPassed = groupResults.every((r) => r === true);
            } else {
                // OR
                groupPassed = groupResults.some((r) => r === true);
            }

            if (groupPassed) return true;
        }

        // Wait, the iterator approach is wrong because if we fail Group 1, we must verify Group 2.
        // But the inputIterator would have advanced through Group 1's inputs already.
        // This is correct. The iterator aligns globally with the flat list of inputs we rendered.

        // Re-verify logic:
        // Rendered: [Input 0 (for G0C0), Input 1 (for G1C0)]
        // Loop G0:
        //   Check C0 using Input 0.
        //   Result: False.
        //   Group G0 False.
        // Loop G1:
        //   Check C0 using Input 1. (Iterator is at 1).
        //   Result: True.
        //   Group G1 True.
        // Return True.

        // The one edge case: What if `getPasscodeRequirements` filtered differently?
        // It filters based on .type match.
        // My loop here matches same .type list.
        // OK.

        // Reseting logic just in case? No, iterator must persist.
        // But wait, what if I implemented logic where I re-evaluate?
        // Since we check linearly, it works.

        // BUT, there is a catch. `evaluateConditions` loop stops on first success.
        // We MUST verify inputs for ALL groups to keep the iterator in sync?
        // If G0 passes, we return true. We don't care about G1 inputs.
        // Correct.

        // BUT `inputIterator` needs to point to the correct index for G1 if G0 fails.
        // If G0 has 2 inputs. We check G0C0 (idx 0), G0C1 (idx 1).
        // If G0 fails, loop continues to G1. Iterator is at 2.
        // G1C0 uses idx 2.
        // Correct.

        return false;
    }

    function showContent() {
        // Show main content
        const mainSelectors = ['main', '#MainContent', '.main-content', '[role="main"]'];
        for (var i = 0; i < mainSelectors.length; i++) {
            var selector = mainSelectors[i];
            var el = document.querySelector(selector);
            if (el) {
                el.style.display = '';
            }
        }

        // Show navigation
        var nav = document.querySelector('nav');
        if (nav) {
            nav.style.display = '';
        }
    }

    function hideContent(data) {
        // Hide main content
        const mainSelectors = ['main', '#MainContent', '.main-content', '[role="main"]'];
        mainSelectors.forEach((selector) => {
            const el = document.querySelector(selector);
            if (el) {
                el.style.display = 'none';
            }
        });

        // Optionally hide navigation based on settings
        if (data.lockData && data.lockData.settings && data.lockData.settings.hide_navigation) {
            const nav = document.querySelector('nav');
            if (nav) {
                nav.style.display = 'none';
            }
        }
    }

    // ===== HIDE ADD TO CART MODE =====
    const ADD_TO_CART_SELECTORS = [
        'form[action="/cart/add"]',
        'form[action*="/cart/add"]',
        'button[name="add"]',
        '.product-form__submit',
        '.add-to-cart',
        '#AddToCart',
        '.shopify-payment-button',
        // Sticky/floating cart bars
        '.sticky-add-to-cart',
        '.product-sticky-form',
        '[data-section-type="sticky-cart"]',
        '.cart-notification',
        '.quick-add-modal',
        // Common theme selectors for quick add/buy buttons
        '.quick-add__submit',
        '.product-form__cart-submit',
        'buy-it-now-button',
        '.shopify-payment-button__button',
    ];

    let _hideCartObserver = null;

    function hideAddToCartButtons() {
        // Signal to access_price.js to not interfere
        window.__accessCartManagedByLock = true;

        const doHide = () => {
            ADD_TO_CART_SELECTORS.forEach((sel) => {
                const els = document.querySelectorAll(sel);
                els.forEach((el) => {
                    // Don't hide our own unlock button
                    if (el.id === 'access-unlock-purchase-btn') return;
                    if (el.closest('#access-unlock-modal')) return;
                    if (el.dataset.accessHidden === 'true') return;
                    el.dataset.accessHidden = 'true';
                    el.dataset.originalDisplay = el.style.display;
                    el.style.display = 'none';
                });
            });
        };

        doHide();

        // Watch for dynamically added buttons (sticky bars, quick-add, etc.)
        if (!_hideCartObserver) {
            _hideCartObserver = new MutationObserver(() => { doHide(); });
            _hideCartObserver.observe(document.body, { childList: true, subtree: true });
        }
    }

    function restoreAddToCartButtons() {
        // Stop the observer first so it doesn't re-hide buttons
        if (_hideCartObserver) {
            _hideCartObserver.disconnect();
            _hideCartObserver = null;
        }
        // Clear the managed flag
        window.__accessCartManagedByLock = false;

        // Restore display-hidden buttons
        const hiddenEls = document.querySelectorAll('[data-access-hidden="true"]');
        hiddenEls.forEach((el) => {
            el.style.display = el.dataset.originalDisplay || '';
            delete el.dataset.accessHidden;
            delete el.dataset.originalDisplay;
        });

        // Also restore any buttons that access_price.js may have disabled
        const disabledBtns = document.querySelectorAll('[data-access-disabled="true"]');
        disabledBtns.forEach((btn) => {
            btn.disabled = false;
            btn.style.opacity = '';
            btn.style.cursor = '';
            if (btn.dataset.originalText) {
                btn.innerText = btn.dataset.originalText;
            }
            delete btn.dataset.accessDisabled;
            delete btn.dataset.originalText;
        });

        // Show payment buttons
        const paymentBtns = document.querySelectorAll('.shopify-payment-button');
        paymentBtns.forEach((el) => (el.style.display = ''));
        // Remove unlock button
        const unlockBtn = document.getElementById('access-unlock-purchase-btn');
        if (unlockBtn) unlockBtn.remove();
    }

    function insertUnlockButton(data) {
        // Find the Add to Cart form to place the unlock button near it
        const form = document.querySelector('form[action="/cart/add"]');
        const target = form || document.querySelector('.product-form, .product-form__buttons, .product__info-container');
        if (!target) return;

        const btn = document.createElement('button');
        btn.id = 'access-unlock-purchase-btn';
        btn.type = 'button';
        btn.innerHTML = '🔒 Unlock to Purchase';
        btn.style.cssText = 'width:100%;padding:15px;background:#1a1a1a;color:#fff;border:none;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin-top:10px;transition:background 0.2s;';
        btn.onmouseenter = function () { btn.style.background = '#333'; };
        btn.onmouseleave = function () { btn.style.background = '#1a1a1a'; };
        btn.onclick = function () { showUnlockModal(data); };

        if (form) {
            form.parentNode.insertBefore(btn, form.nextSibling);
        } else {
            target.appendChild(btn);
        }
    }

    function showUnlockModal(data) {
        // Check if AccessUI is available (custom widget)
        if (window.AccessUI && typeof window.AccessUI.renderClosableModal === 'function') {
            const conditions = data.lockData.conditions || [];
            const passcodeReqs = getPasscodeRequirements(conditions);
            window.AccessUI.renderClosableModal(data, passcodeReqs, function (enteredCodes) {
                validatePasscodeForUnlock(data, enteredCodes);
            });
            return;
        }

        // Default unlock modal (closable)
        const prompt = (data.lockData && data.lockData.prompt) || 'Enter your credentials to unlock purchasing.';
        const conditions = data.lockData.conditions || [];
        const passcodeReqs = getPasscodeRequirements(conditions);

        let inputsHTML = '';
        passcodeReqs.forEach((req, i) => {
            if (req.type === 'ageVerification') {
                inputsHTML += `
                <div style="margin-bottom:15px;text-align:left;">
                    <label style="display:block;margin-bottom:5px;font-size:14px;color:#666;font-weight:500">${req.label}</label>
                    <input type="date" class="access-code-input" data-index="${i}" data-group-index="${req.groupIndex}"
                        style="width:100%;padding:12px;border:2px solid #ddd;
                        border-radius:8px;font-size:16px;box-sizing:border-box" ${i === 0 ? 'autofocus' : ''}
                        max="${new Date().toISOString().split('T')[0]}">
                    <p style="margin:5px 0 0;font-size:12px;color:#888">You must be at least ${req.value || '18'} years old</p>
                </div>`;
            } else {
                inputsHTML += `
                <div style="margin-bottom:15px;text-align:left;">
                    <label style="display:block;margin-bottom:5px;font-size:14px;color:#666;font-weight:500">${req.label}</label>
                    <input type="password" class="access-code-input" data-index="${i}" data-group-index="${req.groupIndex}" placeholder="Enter code"
                        style="width:100%;padding:12px;border:2px solid #ddd;
                        border-radius:8px;font-size:16px;box-sizing:border-box" autocomplete="off" ${i === 0 ? 'autofocus' : ''}>
                </div>`;
            }
        });

        if (passcodeReqs.length === 0 && conditions.length === 0 && data.locked) {
            inputsHTML = `
            <div style="margin-bottom:15px;text-align:left;">
                <label style="display:block;margin-bottom:5px;font-size:14px;color:#666;font-weight:500">Access Key</label>
                <input type="password" class="access-code-input" data-index="0" placeholder="Enter access key"
                    style="width:100%;padding:12px;border:2px solid #ddd;
                    border-radius:8px;font-size:16px;box-sizing:border-box" autocomplete="off">
            </div>`;
        }

        const modalHTML = `
        <div id="access-unlock-modal" style="
            position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);
            z-index:999999;display:flex;align-items:center;justify-content:center;
            font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
            <div style="background:white;padding:40px;border-radius:12px;max-width:460px;
                width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);position:relative">
                <button id="access-unlock-close" style="position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;cursor:pointer;color:#999;line-height:1" type="button">&times;</button>
                <h2 style="margin:0 0 10px;color:#1a1a1a;font-size:22px">🔓 Unlock Purchase</h2>
                <p style="color:#666;line-height:1.5;margin-bottom:25px;font-size:15px">${prompt}</p>
                <div id="access-inputs-container">
                    ${inputsHTML}
                </div>
                <button id="access-unlock-submit" style="width:100%;padding:14px;background:#008060;
                    color:white;border:none;border-radius:8px;font-size:16px;font-weight:600;
                    cursor:pointer">Unlock Access</button>
                <div id="access-unlock-error" style="color:#dc2626;margin-top:12px;font-size:14px;display:none"></div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Close button
        document.getElementById('access-unlock-close').onclick = function () {
            const modal = document.getElementById('access-unlock-modal');
            if (modal) modal.remove();
        };

        // Click outside to close
        document.getElementById('access-unlock-modal').onclick = function (e) {
            if (e.target === this) this.remove();
        };

        // Submit
        document.getElementById('access-unlock-submit').onclick = function () {
            const inputEls = document.querySelectorAll('#access-unlock-modal .access-code-input');
            const enteredCodes = Array.from(inputEls).map((el) => el.value.trim());
            validatePasscodeForUnlock(data, enteredCodes);
        };

        // Enter key
        const inputs = document.querySelectorAll('#access-unlock-modal .access-code-input');
        inputs.forEach((input) => {
            input.onkeypress = function (e) {
                if (e.key === 'Enter') {
                    const inputEls = document.querySelectorAll('#access-unlock-modal .access-code-input');
                    const enteredCodes = Array.from(inputEls).map((el) => el.value.trim());
                    validatePasscodeForUnlock(data, enteredCodes);
                }
            };
        });
    }

    function validatePasscodeForUnlock(data, enteredCodes) {
        const errorEl = document.getElementById('access-unlock-error') || document.getElementById('error-msg');
        const inputEls = document.querySelectorAll('#access-unlock-modal .access-code-input, #access-lock-modal .access-code-input');

        if (enteredCodes.every((c) => c === '') && enteredCodes.length > 0) {
            if (errorEl) { errorEl.textContent = 'Please enter access code'; errorEl.style.display = 'block'; }
            return;
        }

        const customerData = {
            loggedIn: data.loggedIn || false,
            tags: data.customerTags || [],
            email: data.customerEmail || '',
            country: data.customerCountry || '',
            ip_address: data.customerIP || '',
        };

        const conditions = data.lockData.conditions || [];

        if (evaluateConditionsWithInputs(conditions, customerData, enteredCodes)) {
            grantAccess(enteredCodes.join('||'), data);
            return;
        }

        // Fallback for simple/legacy locks
        if (conditions.length === 0 && data.lockData.simple_passcodes) {
            if (validateLocally(enteredCodes[0], data.lockData)) {
                grantAccess(enteredCodes[0], data);
                return;
            }
        }

        if (errorEl) {
            // Generate helpful error message
            const conditions = data.lockData.conditions || [];
            let errorMessage = 'Access denied. ';
            
            // Get operator
            let operator = 'OR';
            if (conditions.length > 0 && conditions[0].operator) {
                operator = conditions[0].operator.toUpperCase();
            }
            
            let needsSignIn = false;
            let needsPasscode = false;
            
            conditions.forEach(group => {
                if (group.conditions) {
                    group.conditions.forEach(cond => {
                        if (cond.type === 'signedIn' && cond.value === 'loggedIn') {
                            needsSignIn = true;
                        }
                        if (['passcode', 'singlePasscode', 'multiplePasscodes'].includes(cond.type)) {
                            needsPasscode = true;
                        }
                    });
                }
            });
            
            const customerData = {
                loggedIn: data.loggedIn || false,
                tags: data.customerTags || [],
                email: data.customerEmail || '',
                country: data.customerCountry || '',
                ip_address: data.customerIP || '',
            };
            
            if (operator === 'AND') {
                // AND logic - both required
                if (needsSignIn && !customerData.loggedIn) {
                    errorMessage = 'You must be signed in AND enter the correct access code.';
                } else if (needsPasscode) {
                    errorMessage = 'Incorrect access code. Please try again.';
                } else {
                    errorMessage = 'Access denied. Please check your credentials.';
                }
            } else {
                // OR logic - either one works
                if (needsSignIn && needsPasscode) {
                    errorMessage = 'Please sign in OR enter the correct access code.';
                } else if (needsPasscode) {
                    errorMessage = 'Incorrect access code. Please try again.';
                } else {
                    errorMessage = 'Access denied. Please check your credentials.';
                }
            }
            
            errorEl.textContent = errorMessage;
            errorEl.style.display = 'block';
        }
        inputEls.forEach((el) => (el.value = ''));
        if (inputEls[0]) inputEls[0].focus();
    }

    function grantAccess(passcode, data) {

        // Store passcode for future use
        if (passcode) {
            localStorage.setItem('passcode_' + data.handle, passcode);
        }

        // Cache the access grant
        const cacheKey = getCacheKey(data);
        localStorage.setItem(cacheKey, 'granted');

        // Remove modals if they exist
        const modal = document.getElementById('access-lock-modal');
        if (modal) modal.remove();
        const unlockModal = document.getElementById('access-unlock-modal');
        if (unlockModal) unlockModal.remove();

        // Restore Add to Cart buttons if in hide_add_to_cart mode
        restoreAddToCartButtons();

        // Show content
        showContent();
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
                if (passcode) {
                    const passcodes = value
                        .split('\n')
                        .map((p) => p.trim())
                        .filter((p) => p);
                    result = passcodes.includes(passcode.trim());
                }
                break;

            case 'passcodeFromList':
                // For now, treat as multiplePasscodes (value contains list)
                if (passcode) {
                    const passcodes = value
                        .split('\n')
                        .map((p) => p.trim())
                        .filter((p) => p);
                    result = passcodes.includes(passcode.trim());
                }
                break;

            case 'tag':
                const customerTags = customerData.tags || [];
                result = customerTags.includes(value);
                break;

            case 'signedIn':
                const isLoggedIn = customerData.loggedIn || false;
                if (value === 'loggedIn') {
                    result = isLoggedIn;
                } else if (value === 'guest') {
                    result = !isLoggedIn;
                }
                break;

            case 'specificEmail':
                // Check logged-in email OR manually entered email
                const email = (customerData.email || passcode || '').toLowerCase();
                const targetEmail = (value || '').toLowerCase();
                result = email && email === targetEmail;
                break;

            case 'emailContains':
                const emailForContains = (customerData.email || passcode || '').toLowerCase();
                result = emailForContains && emailForContains.includes(value.toLowerCase());
                break;

            case 'emailFromList':
                const emailForList = (customerData.email || passcode || '').toLowerCase();
                if (emailForList) {
                    const emails = value
                        .split('\n')
                        .map((e) => e.trim().toLowerCase())
                        .filter((e) => e);
                    result = emails.includes(emailForList);
                }
                break;

            case 'singleSecretLink':
                // Check if URL contains the secret link code
                const urlParams = new URLSearchParams(window.location.search);
                const secretCode = urlParams.get('access') || urlParams.get('code');
                result = secretCode && secretCode === value;
                break;

            case 'secretLinkFromList':
                // Check if URL contains any secret link code from list
                const urlParamsForList = new URLSearchParams(window.location.search);
                const secretCodeForList = urlParamsForList.get('access') || urlParamsForList.get('code');
                if (secretCodeForList) {
                    const codes = value
                        .split('\n')
                        .map((c) => c.trim())
                        .filter((c) => c);
                    result = codes.includes(secretCodeForList);
                }
                break;

            case 'ageVerification':
                // passcode contains the date-of-birth string (YYYY-MM-DD)
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
                    const customValue = condition.custom || '';
                    result = customerCountry && customerCountry.includes(customValue.toUpperCase());
                } else {
                    result = customerCountry && customerCountry === value.toUpperCase();
                }
                break;

            case 'ip':
                // IP address check - requires server-side validation
                // For now, we'll check if IP is provided in customerData
                const customerIP = customerData.ip_address || '';
                result = customerIP && customerIP === value;
                break;

            default:
                result = false;
        }

        // Apply invert flag
        const finalResult = invert ? !result : result;
        return finalResult;
    }

    function evaluateGroup(group, customerData, passcode) {
        const conditions = group.conditions || [];
        const operator = (group.operator || 'AND').toUpperCase();

        if (conditions.length === 0) {
            return true; // Empty group grants access
        }


        const results = conditions.map((condition) => evaluateCondition(condition, customerData, passcode));

        if (operator === 'AND') {
            // All conditions must be true
            const allTrue = results.every((r) => r === true);
            return allTrue;
        } else {
            // At least one condition must be true (OR)
            const anyTrue = results.some((r) => r === true);
            return anyTrue;
        }
    }

    function evaluateConditions(conditions, customerData, passcode) {
        if (!conditions || conditions.length === 0) {
            return false; // No conditions = locked by default
        }


        // OR logic between groups - any group passing grants access
        for (var i = 0; i < conditions.length; i++) {
            if (evaluateGroup(conditions[i], customerData, passcode)) {
                return true;
            }
        }

        return false;
    }

    function checkAccess(data) {
        // STEP 1: Check localStorage cache FIRST
        const cacheKey = getCacheKey(data);
        const cachedAccess = localStorage.getItem(cacheKey);

        if (cachedAccess === 'granted') {
            
            // IMPORTANT: Validate cache against current conditions
            // If conditions require sign-in and user is NOT logged in, invalidate cache
            const conditions = data.lockData.conditions || [];
            let requiresSignIn = false;
            let hasPasscodeCondition = false;
            let isAndOperator = false;
            
            if (conditions.length > 0) {
                const group = conditions[0];
                isAndOperator = (group.operator || 'AND').toUpperCase() === 'AND';
                
                if (group.conditions) {
                    group.conditions.forEach(cond => {
                        if (cond.type === 'signedIn' && cond.value === 'loggedIn') {
                            requiresSignIn = true;
                        }
                        if (['passcode', 'singlePasscode', 'multiplePasscodes'].includes(cond.type)) {
                            hasPasscodeCondition = true;
                        }
                    });
                }
                
                // Cache invalidation logic:
                // 1. AND operator with signIn: User MUST be logged in
                // 2. OR operator with signIn: If user WAS logged in but now logged out, re-check
                if (requiresSignIn) {
                    if (isAndOperator && !data.loggedIn) {
                        // AND: User must be logged in
                        localStorage.removeItem(cacheKey);
                        localStorage.removeItem('passcode_' + data.handle);
                        // Continue to show lock modal
                    } else if (!isAndOperator && !data.loggedIn && !hasPasscodeCondition) {
                        // OR with ONLY signIn condition: User must be logged in
                        localStorage.removeItem(cacheKey);
                        // Continue to show lock modal
                    } else {
                        // Cache is valid
                        showContent();
                        return;
                    }
                } else {
                    // No sign-in requirement, cache is valid
                    showContent();
                    return;
                }
            } else {
                // No conditions to validate, cache is valid
                showContent();
                return;
            }
        }

        // STEP 2: Check if resource is locked via metafield
        if (!data.locked || !data.lockData || !data.lockData.enabled) {
            showContent();
            return;
        }

        // STEP 3: If "Hide Price" rule is active, do not block page access.
        // The access_price.js script will handle hiding the price/buttons.

        if (data.lockData.hide_price === true || (data.lockData.settings && data.lockData.settings.hide_price === true)) {
            showContent();
            return;
        }


        // STEP 4: Get customer data
        const customerData = {
            loggedIn: data.loggedIn || false,
            tags: data.customerTags || [],
            email: data.customerEmail || '',
            country: data.customerCountry || '',
            ip_address: data.customerIP || '',
        };

        // STEP 5: Check if we have full conditions to evaluate
        const conditions = data.lockData.conditions || [];

        if (conditions.length > 0) {

            // Check if user already has a passcode stored
            const storedPasscode = localStorage.getItem('passcode_' + data.handle);

            // Try to evaluate without passcode first (for non-passcode conditions)
            if (evaluateConditions(conditions, customerData, storedPasscode)) {
                if (storedPasscode) {
                    grantAccess(storedPasscode, data);
                } else {
                    // Grant access without passcode (e.g., tag-only or email-only condition)
                    localStorage.setItem(cacheKey, 'granted');
                    showContent();
                }
                return;
            }
        }

        // STEP 5.5: "Hide Add to Cart" mode — page visible, only button hidden
        const hideAddToCart = data.lockData.hide_add_to_cart || (data.lockData.settings && data.lockData.settings.hide_add_to_cart);
        if (hideAddToCart) {
            showContent();
            hideAddToCartButtons();
            insertUnlockButton(data);
            return;
        }

        // STEP 6: Show lock modal (full overlay — default behavior)
        showLockModal(data);
        hideContent(data);
    }

    return {
        init: function (expectedType) {

            const initEl = document.getElementById('access-control-init');
            if (!initEl) {
                return;
            }

            // Get metafield data from liquid - HANDLE NULL/UNDEFINED
            const lockDataString = initEl.dataset.lockData || '{}';
            let lockData;
            try {
                lockData = JSON.parse(lockDataString);
            } catch (e) {
                lockData = {};
            }

            // Ensure lockData is an object
            if (!lockData || typeof lockData !== 'object') {
                lockData = {};
            }

            const isLocked = initEl.dataset.locked === 'true';

            // Extract customer data
            const customerLoggedIn = initEl.dataset.customerLoggedIn === 'true';
            const customerEmail = initEl.dataset.customerEmail || '';
            const customerTagsString = initEl.dataset.customerTags || '';
            const customerTags = customerTagsString
                ? customerTagsString
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t)
                : [];

            const data = {
                type: initEl.dataset.type,
                handle: initEl.dataset.handle,
                shop: initEl.dataset.shop,
                loggedIn: customerLoggedIn,
                customerEmail: customerEmail,
                customerTags: customerTags,
                locked: isLocked,
                lockData: lockData,
                ruleId: lockData && lockData.rule_id ? lockData.rule_id : null,
            };

            checkAccess(data);
        },
    };
})();

// Dispatch event for other scripts
document.dispatchEvent(new Event('AccessControlReady'));
