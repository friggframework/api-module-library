const crypto = require('crypto');

/**
 * Optional shared-secret check for Clockwork webhook deliveries.
 *
 * Clockwork's public support KB does not publish a signature algorithm. When
 * CLOCKWORK_WEBHOOK_SHARED_SECRET is set, require header
 * `x-clockwork-webhook-secret` (or `x-webhook-secret`) to match via timing-safe
 * compare. When unset, accept the delivery (local/dev) and note the reason.
 *
 * @param {object} opts
 * @param {import('http').IncomingMessage & { headers?: object }} opts.req
 * @param {string} [opts.sharedSecret]
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyClockworkWebhook({ req, sharedSecret }) {
    const secret =
        sharedSecret || process.env.CLOCKWORK_WEBHOOK_SHARED_SECRET || '';
    if (!secret) {
        return { valid: true, reason: 'shared_secret_not_configured' };
    }

    const headers = req?.headers || {};
    const provided =
        headers['x-clockwork-webhook-secret'] ||
        headers['X-Clockwork-Webhook-Secret'] ||
        headers['x-webhook-secret'] ||
        headers['X-Webhook-Secret'];

    if (!provided) {
        return { valid: false, reason: 'missing_webhook_secret_header' };
    }

    const a = Buffer.from(String(provided));
    const b = Buffer.from(String(secret));
    if (a.length !== b.length) {
        return { valid: false, reason: 'webhook_secret_mismatch' };
    }
    const match = crypto.timingSafeEqual(a, b);
    return match
        ? { valid: true }
        : { valid: false, reason: 'webhook_secret_mismatch' };
}

module.exports = { verifyClockworkWebhook };
