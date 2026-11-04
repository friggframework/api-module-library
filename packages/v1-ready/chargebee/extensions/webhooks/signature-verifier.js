const crypto = require('crypto');

/**
 * Chargebee inbound webhook authentication.
 *
 * Chargebee does not sign webhook payloads with HMAC. Official docs recommend
 * protecting the webhook URL with HTTP Basic Auth (and HTTPS). When Basic Auth
 * is enabled on the webhook endpoint, Chargebee sends:
 *
 *   Authorization: Basic base64(username:password)
 *
 * Sources:
 * - https://www.chargebee.com/docs/billing/2.0/site-configuration/webhook_settings
 * - https://www.chargebee.com/docs/billing/2.0/site-configuration/events_and_webhooks
 *   (HMAC not supported; Basic Auth only)
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

function safeEqualString(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} [args.username] - Expected Basic Auth username
 * @param {string} [args.password] - Expected Basic Auth password
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyChargebeeBasicAuth({ req, username, password }) {
    if (!username || typeof username !== 'string') {
        return { valid: false, reason: 'missing webhook username' };
    }
    if (password == null || typeof password !== 'string') {
        return { valid: false, reason: 'missing webhook password' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const header = getHeader(req.headers || {}, 'authorization');
    if (!header || typeof header !== 'string') {
        return { valid: false, reason: 'missing Authorization header' };
    }
    if (!header.toLowerCase().startsWith('basic ')) {
        return { valid: false, reason: 'Authorization is not Basic' };
    }

    let decoded;
    try {
        decoded = Buffer.from(header.slice(6).trim(), 'base64').toString(
            'utf8'
        );
    } catch (_err) {
        return { valid: false, reason: 'invalid Basic Auth encoding' };
    }

    const colon = decoded.indexOf(':');
    if (colon === -1) {
        return { valid: false, reason: 'invalid Basic Auth format' };
    }
    const user = decoded.slice(0, colon);
    const pass = decoded.slice(colon + 1);

    if (!safeEqualString(user, username) || !safeEqualString(pass, password)) {
        return { valid: false, reason: 'credentials mismatch' };
    }
    return { valid: true };
}

module.exports = {
    verifyChargebeeBasicAuth,
    getHeader,
    safeEqualString,
};
