const {
    Api,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    CHALLENGE_HEADER,
} = require('../../api');

/**
 * Verify a Front application-webhook request.
 *
 * Thin wrapper around `Api.verifyWebhookSignature` so the extension can share
 * the same algorithm as the client helper.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.secret - Application webhook signing secret
 * @returns {{ valid: boolean, reason?: string, challenge?: string }}
 */
function verifyFrontSignature({ req, secret }) {
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
    verifyFrontSignature,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    CHALLENGE_HEADER,
};
