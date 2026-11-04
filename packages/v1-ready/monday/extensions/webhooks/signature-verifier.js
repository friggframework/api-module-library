const { tokenFromAuthorization, verifyHs256Jwt } = require('../../jwt-verifier');

/**
 * Verify monday integration-webhook JWT (Authorization header) against the
 * app Signing Secret. Only HS256 is accepted (`alg: none` is rejected).
 * Challenge requests have no JWT — callers must short-circuit those first.
 *
 * Docs: https://developer.monday.com/apps/docs/authorization-header
 *       https://developer.monday.com/api-reference/reference/webhooks
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
        return { valid: false, reason: 'no_secret' };
    }
    if (!auth) {
        return { valid: false, reason: 'missing' };
    }

    const token = tokenFromAuthorization(auth);
    const result = verifyHs256Jwt(token, [
        { name: 'signing_secret', value: secret },
    ]);
    if (!result.ok) {
        return { valid: false, reason: result.reason };
    }
    return {
        valid: true,
        payload: result.claims,
        secretName: result.secretName,
    };
}

module.exports = { verifyMondayWebhookSignature };
