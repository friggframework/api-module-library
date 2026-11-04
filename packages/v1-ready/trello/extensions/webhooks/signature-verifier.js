const { Api, SIGNATURE_HEADER } = require('../../api');

/**
 * Verify a Trello webhook request (X-Trello-Webhook).
 *
 * Thin wrapper around `Api.verifyWebhookSignature` so the extension shares
 * the same HMAC-SHA1(body + callbackURL) algorithm as the client helper.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.secret - Application secret (Trello Auth tab)
 * @param {string} [args.callbackURL] - Exact callbackURL used at create time
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyTrelloSignature({ req, secret, callbackURL }) {
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const body = req.body || {};
    const url =
        callbackURL ||
        (body.webhook && body.webhook.callbackURL) ||
        null;

    return new Api({ api_secret: secret }).verifyWebhookSignature({
        headers: req.headers || {},
        rawBody: req.rawBody,
        body: req.body,
        callbackURL: url,
        secret,
    });
}

module.exports = {
    verifyTrelloSignature,
    SIGNATURE_HEADER,
};
