const { Api } = require('../../api');

/**
 * Thin wrapper around Api.verifyWebhookSignature for the receive hop.
 * Uses CLICKUP_WEBHOOK_SECRET when present (see extensions/webhooks/index.js).
 */
function verifyClickUpSignature({ req, secret } = {}) {
    const api = new Api({});
    const headers = (req && req.headers) || {};
    const rawBody =
        req && (req.rawBody !== undefined ? req.rawBody : req.body);
    return api.verifyWebhookSignature({
        headers,
        rawBody: req && req.rawBody,
        body: req && req.body,
        secret:
            secret ||
            process.env.CLICKUP_WEBHOOK_SECRET ||
            null,
    });
}

module.exports = { verifyClickUpSignature };
