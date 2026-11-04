/**
 * Copper webhook authenticity helpers.
 *
 * Copper does not sign notifications with HMAC. Instead, when you create a
 * subscription you may attach:
 *   - `secret`: key/value pairs flattened into the notification body
 *   - `headers`: custom HTTP headers on every delivery
 *
 * This verifier checks those optional shared values against env when set.
 * If neither COPPER_WEBHOOK_SECRET nor COPPER_WEBHOOK_AUTH_HEADER is
 * configured, verification is a no-op pass (receiver still accepts traffic —
 * callers that need auth must set env + matching subscription config).
 *
 * @see https://developer.copper.com/webhooks/notification-example.html
 */

function getHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    const want = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === want) {
            const v = headers[key];
            return Array.isArray(v) ? v[0] : v;
        }
    }
    return undefined;
}

/**
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} [args.secret] - Expected secret field value
 *   (matches any body value equal to this string, e.g. secret:"hook_source")
 * @param {string} [args.authHeader] - Expected Authorization (or custom) header
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyCopperWebhook({ req, secret, authHeader } = {}) {
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const headers = req.headers || {};

    // Header check first when configured.
    if (authHeader) {
        const authorization =
            getHeader(headers, 'authorization') ||
            getHeader(headers, 'Authentication');
        if (authorization !== authHeader) {
            return { valid: false, reason: 'auth header mismatch' };
        }
    }

    // Body secret: Copper flattens the secret object into top-level body keys.
    // Accept a match against any string value in the body, or the common
    // `secret` / `key` fields from the docs examples.
    if (secret) {
        const candidates = [];
        if (typeof body.secret === 'string') candidates.push(body.secret);
        if (typeof body.key === 'string') candidates.push(body.key);
        for (const v of Object.values(body)) {
            if (typeof v === 'string') candidates.push(v);
        }
        if (!candidates.includes(secret)) {
            return { valid: false, reason: 'secret mismatch' };
        }
    }

    return { valid: true };
}

module.exports = {
    verifyCopperWebhook,
    getHeader,
};
