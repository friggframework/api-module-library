/**
 * Blackbaud SKY webhook delivery checks.
 *
 * Official delivery model (CloudEvents / Azure Event Grid):
 *   1. OPTIONS handshake with WebHook-Request-Origin: eventgrid.azure.net —
 *      respond 200–204 + WebHook-Allowed-Origin: eventgrid.azure.net.
 *   2. POST event notifications to the registered webhook_url.
 *
 * Blackbaud does not document an HMAC signature header comparable to HubSpot
 * or Close. The documented pattern is to embed a secret on the webhook_url
 * (e.g. ?webhookKey=…) at create-subscription time; GET subscription responses
 * intentionally omit query strings.
 *
 * @see https://developer.blackbaud.com/skyapi/docs/webhooks/subscriptions
 * @see https://developer.blackbaud.com/skyapi/docs/webhooks/tutorial
 */

const EXPECTED_ORIGIN = 'eventgrid.azure.net';

/**
 * Validate the CloudEvents Abuse Protection OPTIONS handshake.
 *
 * @param {object} opts
 * @param {import('http').IncomingMessage} opts.req
 * @returns {{ valid: boolean, origin?: string, reason?: string }}
 */
function verifyOptionsHandshake({ req }) {
    const headers = req?.headers || {};
    const origin =
        headers['webhook-request-origin'] ||
        headers['WebHook-Request-Origin'] ||
        headers['WEBHOOK-REQUEST-ORIGIN'];

    if (!origin) {
        return { valid: false, reason: 'missing_webhook_request_origin' };
    }
    if (String(origin).toLowerCase() !== EXPECTED_ORIGIN) {
        return { valid: false, reason: 'unexpected_webhook_request_origin' };
    }
    return { valid: true, origin: EXPECTED_ORIGIN };
}

/**
 * Optional shared-secret check against ?webhookKey= on the request URL.
 * When BLACKBAUD_WEBHOOK_KEY (or opts.webhookKey) is unset, verification is
 * skipped so local/dev hosts can still receive events.
 *
 * @param {object} opts
 * @param {import('http').IncomingMessage & { query?: Record<string,string>, url?: string }} opts.req
 * @param {string} [opts.webhookKey]
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyWebhookKey({ req, webhookKey }) {
    const expected =
        webhookKey || process.env.BLACKBAUD_WEBHOOK_KEY || null;
    if (!expected) {
        return { valid: true, reason: 'webhook_key_not_configured' };
    }

    let provided;
    if (req?.query && req.query.webhookKey !== undefined) {
        provided = req.query.webhookKey;
    } else if (req?.url) {
        try {
            const u = new URL(req.url, 'http://localhost');
            provided = u.searchParams.get('webhookKey');
        } catch {
            provided = undefined;
        }
    }

    if (!provided) {
        return { valid: false, reason: 'missing_webhook_key' };
    }
    if (String(provided) !== String(expected)) {
        return { valid: false, reason: 'webhook_key_mismatch' };
    }
    return { valid: true };
}

module.exports = {
    EXPECTED_ORIGIN,
    verifyOptionsHandshake,
    verifyWebhookKey,
};
