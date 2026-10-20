const { Api, SIGNATURE_HEADER } = require('../../api');

/**
 * Verify an Intercom webhook request.
 *
 * Thin wrapper around `Api.verifyWebhookSignature` so the extension can share
 * the same algorithm as the client helper.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.secret - App client_secret (HMAC key)
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyIntercomSignature({ req, secret }) {
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
    verifyIntercomSignature,
    SIGNATURE_HEADER,
};
