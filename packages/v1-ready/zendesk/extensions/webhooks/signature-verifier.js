const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-zendesk-webhook-signature';
const TIMESTAMP_HEADER = 'x-zendesk-webhook-signature-timestamp';
// Methods whose requests may carry no body.
const BODYLESS_METHODS = ['GET', 'HEAD', 'DELETE'];

/**
 * Read a header value case-insensitively from a request-like object.
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
 * Reconstruct the request body string Zendesk signed.
 * Prefer rawBody (middleware-preserved bytes); otherwise stringify.
 *
 * @param {import('express').Request|Object} req
 * @returns {string}
 */
function extractBodyString(req) {
    if (typeof req.rawBody === 'string') return req.rawBody;
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
    if (BODYLESS_METHODS.includes((req.method || '').toUpperCase())) return '';
    if (req.body === undefined || req.body === null) return '';
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
    return JSON.stringify(req.body);
}

/**
 * Constant-time compare of two base64 signatures.
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
        const a = Buffer.from(expected, 'base64');
        const b = Buffer.from(provided, 'base64');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch (_err) {
        return false;
    }
}

/**
 * Verify a Zendesk webhook signature.
 *
 * Algorithm (official docs):
 *   signature = base64(HMAC-SHA256(signing_secret, TIMESTAMP + BODY))
 *
 * Headers: X-Zendesk-Webhook-Signature, X-Zendesk-Webhook-Signature-Timestamp
 * @see https://developer.zendesk.com/documentation/webhooks/verifying/
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.signingSecret - Per-webhook secret (or static test secret)
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyZendeskSignature({ req, signingSecret }) {
    if (!signingSecret || typeof signingSecret !== 'string') {
        return { valid: false, reason: 'missing signing secret' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const headers = req.headers || {};
    const signature = getHeader(headers, SIGNATURE_HEADER);
    const timestamp = getHeader(headers, TIMESTAMP_HEADER);

    if (!signature) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }
    if (!timestamp) {
        return { valid: false, reason: `missing ${TIMESTAMP_HEADER} header` };
    }

    const body = extractBodyString(req);
    const expected = crypto
        .createHmac('sha256', signingSecret)
        .update(String(timestamp) + body, 'utf8')
        .digest('base64');

    if (!safeCompare(expected, signature)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    verifyZendeskSignature,
    extractBodyString,
    safeCompare,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
};
