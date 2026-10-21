const { Api, SIGNATURE_HEADER } = require('../../api');

/**
 * Verify a Kit webhook request.
 *
 * Thin wrapper around `Api.verifyWebhookSignature` so the extension shares
 * the same algorithm as the client helper.
 *
 * @see https://developers.kit.com/webhooks/verifying-signatures
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.secret - Endpoint signing secret (`whsec_...`)
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyKitSignature({ req, secret }) {
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
    verifyKitSignature,
    SIGNATURE_HEADER,
};
