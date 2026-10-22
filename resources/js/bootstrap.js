import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Cache the Shopify session token to avoid fetching a new one on every request.
// Tokens last ~60s; we refresh after 50s to stay ahead of expiry.
let cachedToken = null;
let tokenExpiresAt = 0;

async function getSessionToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt) {
        return cachedToken;
    }
    cachedToken = await shopify.idToken();
    tokenExpiresAt = now + 50000; // 50 seconds
    return cachedToken;
}

window.axios.interceptors.request.use(async function (config) {
    config.headers.Authorization = `Bearer ${await getSessionToken()}`;
    return config;
}, function (error) {
    return Promise.reject(error);
});

// Automatically retry requests when the session token has expired (403/400).
window.axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (
            error.response &&
            (error.response.status === 403 || error.response.status === 400) &&
            !originalRequest._retry
        ) {
            originalRequest._retry = true;
            // Force a fresh token
            cachedToken = null;
            tokenExpiresAt = 0;
            const newToken = await getSessionToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return window.axios(originalRequest);
        }
        return Promise.reject(error);
    }
);
