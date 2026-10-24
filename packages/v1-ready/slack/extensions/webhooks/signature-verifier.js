const { Api } = require('../../api');

/**
 * Verify a Slack Events API / interactivity request signature.
 *
 * Thin wrapper around Api.verifyWebhookSignature so the Tier-3 receiver can
 * call a focused helper without constructing request-shaped options twice.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} [args.signingSecret] - defaults to SLACK_SIGNING_SECRET
 * @returns {Promise<{ valid: boolean, reason?: string }>}
 */
async function verifySlackSignature({ req, signingSecret }) {
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }
    const secret =
        signingSecret ||
        process.env.SLACK_SIGNING_SECRET ||
        null;
    if (!secret) {
        return { valid: false, reason: 'missing signing secret' };
    }

    const api = new Api({ webhookSecret: secret });
    const rawBody =
        typeof req.rawBody === 'string' || Buffer.isBuffer(req.rawBody)
            ? req.rawBody
            : undefined;
    const ok = await api.verifyWebhookSignature({
        headers: req.headers || {},
        body: req.body,
        rawBody,
    });
    return ok
        ? { valid: true }
        : { valid: false, reason: 'signature mismatch or stale timestamp' };
}

module.exports = {
    verifySlackSignature,
};
