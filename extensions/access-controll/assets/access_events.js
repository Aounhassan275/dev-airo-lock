/**
 * Access Control — Event emitter for Shopify Flow (PR #7).
 *
 * Fires lightweight POSTs to /apps/airo-lock/event after each evaluation
 * so the backend can dispatch matching Shopify Flow triggers
 * (airo-lock-access-attempted / -granted / -denied / -request-submitted).
 *
 * Failures are silent — Flow integration is informational and must never
 * block lock enforcement on the storefront.
 */
window.AccessEvents = (function () {
    const ENDPOINT = '/apps/airo-lock/event';
    const sent = new Set();

    function dedupeKey(payload) {
        return [
            payload.lock_id || '',
            payload.resource_type || '',
            payload.resource_handle || '',
            payload.decision || '',
        ].join('|');
    }

    function emit(data, decision, extra) {
        try {
            const lockData = (data && data.lockData) || {};
            const payload = {
                rule_id: lockData.rule_id || null,
                lock_id: lockData.lock_id || null,
                resource_type: data.type || lockData.resource_type || null,
                resource_handle: data.handle || null,
                decision: decision,
                reason: (extra && extra.reason) || null,
                email: data.customerEmail || null,
                country: data.customerCountry || null,
                customer_id: data.customerId || null,
            };

            // De-dupe per page-load so a customer visiting the same page
            // twice doesn't fire two granted events from the cache path.
            const key = dedupeKey(payload);
            if (sent.has(key)) return;
            sent.add(key);

            const body = JSON.stringify(payload);
            if (navigator.sendBeacon) {
                const blob = new Blob([body], { type: 'application/json' });
                navigator.sendBeacon(ENDPOINT, blob);
                return;
            }
            fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true,
            }).catch(() => { /* silent */ });
        } catch {
            /* silent */
        }
    }

    return {
        granted: (data) => emit(data, 'granted'),
        denied: (data, reason) => emit(data, 'denied', { reason }),
        requestSubmitted: (data) => emit(data, 'request_submitted'),
    };
})();
