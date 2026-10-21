/**
 * Verify inbound Neon webhook deliveries.
 *
 * Neon does not document an HMAC signature header. Subscriptions may instead
 * require HTTP Basic auth on the notify URL (username/password set when the
 * webhook is created) and/or customParameters for shared secrets.
 *
 * When NEON_WEBHOOK_USERNAME and NEON_WEBHOOK_PASSWORD are set, require a
 * matching Authorization: Basic header. When unset, accept the delivery
 * (hosts should set credentials in production).
 *
 * @see https://developer.neoncrm.com/webhooks/
 *
 * @param {object} opts
 * @param {import('http').IncomingMessage} opts.req
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyNeonWebhook({ req }) {
    const expectedUser = process.env.NEON_WEBHOOK_USERNAME;
    const expectedPass = process.env.NEON_WEBHOOK_PASSWORD;

    if (!expectedUser && !expectedPass) {
        return { valid: true, reason: 'webhook_basic_auth_not_configured' };
    }

    const headers = req?.headers || {};
    const auth = headers.authorization || headers.Authorization;
    if (!auth || typeof auth !== 'string' || !auth.startsWith('Basic ')) {
        return { valid: false, reason: 'missing_basic_auth' };
    }

    let decoded;
    try {
        decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    } catch (_e) {
        return { valid: false, reason: 'invalid_basic_auth' };
    }

    const colon = decoded.indexOf(':');
    if (colon < 0) {
        return { valid: false, reason: 'invalid_basic_auth' };
    }
    const user = decoded.slice(0, colon);
    const pass = decoded.slice(colon + 1);

    if (
        user === String(expectedUser || '') &&
        pass === String(expectedPass || '')
    ) {
        return { valid: true };
    }
    return { valid: false, reason: 'basic_auth_mismatch' };
}

module.exports = { verifyNeonWebhook };
