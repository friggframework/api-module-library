const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-drchrono-signature';
const EVENT_HEADER = 'x-drchrono-event';
const DELIVERY_HEADER = 'x-drchrono-delivery';

/**
 * Read a header value case-insensitively.
 *
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
 * Constant-time string compare.
 *
 * @param {string} expected
 * @param {string} provided
 * @returns {boolean}
 */
function safeCompare(expected, provided) {
    if (typeof expected !== 'string' || typeof provided !== 'string') {
        return false;
    }
    try {
        const a = Buffer.from(expected, 'utf8');
        const b = Buffer.from(provided, 'utf8');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch (_err) {
        return false;
    }
}

/**
 * Verify a DrChrono webhook delivery.
 *
 * Official security guidance: X-drchrono-signature carries the webhook's
 * secret token; compare it to the configured secret (not an HMAC of the body).
 *
 * Docs: https://app.drchrono.com/api-docs/v2/documentation (Webhooks security)
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.signingSecret
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyDrChronoSignature({ req, signingSecret }) {
    if (!signingSecret || typeof signingSecret !== 'string') {
        return { valid: false, reason: 'missing signing secret' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const signature = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!signature) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    if (!safeCompare(signingSecret, signature)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

/**
 * Build the GET challenge response for DrChrono webhook verification.
 *
 * Docs: HMAC-SHA256(secret_token, msg) → hex digest returned as secret_token.
 *
 * @param {string} msg - Query parameter from DrChrono's GET verify request
 * @param {string} signingSecret - Webhook secret token
 * @returns {{ secret_token: string }}
 */
function buildWebhookChallengeResponse(msg, signingSecret) {
    const digest = crypto
        .createHmac('sha256', signingSecret)
        .update(String(msg), 'utf8')
        .digest('hex');
    return { secret_token: digest };
}

/**
 * Convenience wrapper matching capability-manifest naming.
 *
 * @param {string} signatureHeader
 * @param {string} signingSecret
 * @returns {boolean}
 */
function verifyWebhookSignature(signatureHeader, signingSecret) {
    const result = verifyDrChronoSignature({
        req: {
            headers: {
                [SIGNATURE_HEADER]: signatureHeader,
            },
        },
        signingSecret,
    });
    return result.valid;
}

module.exports = {
    verifyDrChronoSignature,
    verifyWebhookSignature,
    buildWebhookChallengeResponse,
    safeCompare,
    getHeader,
    SIGNATURE_HEADER,
    EVENT_HEADER,
    DELIVERY_HEADER,
};
