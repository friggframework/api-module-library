/**
 * Paychex webhook delivery verification helpers.
 *
 * Unlike HubSpot/Gusto HMAC signatures, Paychex authenticates *to* the
 * subscriber URI using the authentication object registered on the hook
 * (NO_AUTH | BASIC_AUTH | APIKEY | OAUTH2 | OAUTH2_BASIC).
 *
 * For APIKEY subscriptions, compare the presented API key header against the
 * secret you configured when calling createWebhook.
 *
 * @see https://developer.paychex.com/documentation (Add a webhook)
 */

/**
 * Read a header value case-insensitively.
 * @param {Object} headers
 * @param {string} name
 * @returns {string|undefined}
 */
function getHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    if (headers[name] !== undefined) return headers[name];
    const lower = name.toLowerCase();
    if (headers[lower] !== undefined) return headers[lower];
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) return headers[key];
    }
    return undefined;
}

/**
 * Verify an inbound Paychex webhook when the subscription uses APIKEY auth.
 *
 * @param {Object} params
 * @param {Object} [params.headers]
 * @param {string} params.expectedApiKey - apiKey registered on the webhook
 * @param {string} [params.headerName='x-api-key']
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyPaychexApiKeyDelivery({
    headers = {},
    expectedApiKey,
    headerName = 'x-api-key',
} = {}) {
    if (!expectedApiKey) {
        return { valid: false, reason: 'missing expectedApiKey' };
    }

    const presented =
        getHeader(headers, headerName) ||
        getHeader(headers, 'x-api-key') ||
        getHeader(headers, 'api-key') ||
        (() => {
            const auth = getHeader(headers, 'authorization');
            if (!auth) return undefined;
            const m = String(auth).match(/^ApiKey\s+(.+)$/i);
            return m ? m[1] : undefined;
        })();

    if (!presented) {
        return {
            valid: false,
            reason: `missing ${headerName} (or Authorization: ApiKey) header`,
        };
    }

    if (String(presented) !== String(expectedApiKey)) {
        return { valid: false, reason: 'api key mismatch' };
    }
    return { valid: true };
}

module.exports = {
    getHeader,
    verifyPaychexApiKeyDelivery,
};
