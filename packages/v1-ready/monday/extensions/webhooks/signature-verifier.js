const { verifyHs256Jwt } = require('../../api');

/**
 * Verify monday integration-webhook JWT (Authorization header) against the
 * app Signing Secret. Challenge requests have no JWT — callers must short-
 * circuit those before calling this.
 *
 * Docs: https://developer.monday.com/api-reference/reference/webhooks
 *       ("Authenticating requests")
 */
function verifyMondayWebhookSignature({
    req,
    headers,
    authorization,
    signingSecret,
} = {}) {
    const hdrs = headers || (req && req.headers) || {};
    const auth =
        authorization ||
        hdrs.Authorization ||
        hdrs.authorization;
    const secret =
        signingSecret || process.env.MONDAY_SIGNING_SECRET || null;

    if (!secret) {
        // Signing secret not configured — skip verification (personal-token
        // / Automations Center webhooks may not include a JWT).
        return { valid: true, skipped: true, reason: 'no_signing_secret' };
    }
    if (!auth) {
        return { valid: false, reason: 'missing_authorization' };
    }
    return verifyHs256Jwt(auth, secret);
}

module.exports = { verifyMondayWebhookSignature };
