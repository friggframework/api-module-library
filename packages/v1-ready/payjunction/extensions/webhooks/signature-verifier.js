const crypto = require('crypto');

/**
 * Verify a PayJunction webhook delivery signature.
 *
 * When a webhook subscription is created/updated with `secret`, PayJunction
 * sends `X-Pj-Signature`: HMAC-SHA256 of the entire JSON payload using the
 * secret as the key.
 *
 * @see https://developer.payjunction.com/hc/en-us/articles/219970868-Securing-Your-Webhooks
 * @see https://developer.payjunction.com/hc/en-us/articles/360007196134-Webhook-HTTP-Headers
 *
 * @param {object} opts
 * @param {import('http').IncomingMessage & { rawBody?: Buffer|string, body?: any }} opts.req
 * @param {string} [opts.secret]
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyPayJunctionWebhook({ req, secret }) {
    const key = secret || process.env.PAYJUNCTION_WEBHOOK_SECRET;
    if (!key) {
        // Hosts that have not persisted a per-subscription secret yet can skip
        // verification in local/dev; production should always set the secret.
        return { valid: true, reason: 'webhook_secret_not_configured' };
    }

    const headers = req?.headers || {};
    const signature =
        headers['x-pj-signature'] ||
        headers['X-Pj-Signature'] ||
        headers['X-PJ-SIGNATURE'];

    if (!signature) {
        return { valid: false, reason: 'missing_signature_header' };
    }

    let raw;
    if (req.rawBody !== undefined && req.rawBody !== null) {
        raw =
            typeof req.rawBody === 'string'
                ? req.rawBody
                : Buffer.from(req.rawBody).toString('utf8');
    } else if (typeof req.body === 'string') {
        raw = req.body;
    } else if (req.body && typeof req.body === 'object') {
        raw = JSON.stringify(req.body);
    } else {
        return { valid: false, reason: 'missing_body' };
    }

    const expected = crypto
        .createHmac('sha256', String(key))
        .update(raw, 'utf8')
        .digest('hex');

    const a = Buffer.from(String(signature), 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length) {
        return { valid: false, reason: 'signature_mismatch' };
    }
    const ok = crypto.timingSafeEqual(a, b);
    return ok ? { valid: true } : { valid: false, reason: 'signature_mismatch' };
}

module.exports = { verifyPayJunctionWebhook };
