const { Api, SIGNATURE_HEADER } = require('../../api');

/**
 * Verify an Attentive webhook request.
 *
 * Thin wrapper around `Api.verifyWebhookSignature` so the extension shares
 * the same algorithm as the client helper.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.secret - Webhook signing key from Attentive
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyAttentiveSignature({ req, secret }) {
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }
    return new Api({ webhookSecret: secret }).verifyWebhookSignature({
        headers: req.headers || {},
        rawBody: req.rawBody,
        body: req.body,
        secret,
    });
}

module.exports = {
    verifyAttentiveSignature,
    SIGNATURE_HEADER,
};
