/**
 * Factorial webhook delivery verification.
 *
 * Factorial does NOT use HMAC signatures. When you set `challenge` on a
 * subscription, every delivery includes that value in the
 * `x-factorial-wh-challenge` request header. Compare it to the challenge you
 * stored for that subscription.
 *
 * @see https://apidoc.factorialhr.com/docs/manage-webhooks
 * @see https://apidoc.factorialhr.com/docs/payloads-event-types
 */

const CHALLENGE_HEADER = 'x-factorial-wh-challenge';

/**
 * Read a header value case-insensitively.
 * @param {Object} headers
 * @param {string} name
 * @returns {string|undefined}
 */
function getHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    if (headers[name] !== undefined) return headers[name];
    const lower = name.toLowerCase();
    if (headers[lower] !== undefined) return headers[lower];
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) return headers[key];
    }
    return undefined;
}

/**
 * Verify Factorial's x-factorial-wh-challenge header against the expected
 * challenge string.
 *
 * @param {Object} params
 * @param {import('express').Request|Object} [params.req]
 * @param {string} [params.challengeHeader]
 * @param {string} params.challenge - Value stored when the subscription was created
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyFactorialChallenge({
    req,
    challengeHeader,
    challenge,
} = {}) {
    if (!challenge) {
        return { valid: false, reason: 'missing challenge' };
    }

    const header =
        challengeHeader ||
        (req ? getHeader(req.headers, CHALLENGE_HEADER) : undefined);
    if (!header) {
        return {
            valid: false,
            reason: 'missing x-factorial-wh-challenge header',
        };
    }

    if (String(header) !== String(challenge)) {
        return { valid: false, reason: 'challenge mismatch' };
    }
    return { valid: true };
}

module.exports = {
    CHALLENGE_HEADER,
    getHeader,
    verifyFactorialChallenge,
};
