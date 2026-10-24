const crypto = require('crypto');

const SIGNATURE_HEADER = 'klaviyo-signature';
const TIMESTAMP_HEADER = 'klaviyo-timestamp';
const WEBHOOK_ID_HEADER = 'klaviyo-webhook-id';

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
 * Reconstruct the raw request body bytes Klaviyo signed.
 * Prefer `req.rawBody` when middleware preserved it — JSON.parse →
 * JSON.stringify will break the HMAC.
 *
 * @param {import('express').Request|Object} req
 * @returns {string|Buffer}
 */
function extractBodyString(req) {
    if (typeof req.rawBody === 'string') return req.rawBody;
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
    if (req.body === undefined || req.body === null) return '';
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return req.body;
    return JSON.stringify(req.body);
}

/**
 * Constant-time compare of two hex digests.
 *
 * @param {string} expected
 * @param {string} provided
 * @returns {boolean}
 */
function safeCompareHex(expected, provided) {
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
 * Verify a Klaviyo system-webhook signature.
 *
 * Per https://developers.klaviyo.com/en/docs/working_with_system_webhooks:
 *   HMAC-SHA256(secret_key, rawBody + Klaviyo-Timestamp) → lowercase hex
 *   compared to the `Klaviyo-Signature` header.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.secret - The webhook `secret_key` (min 16 chars).
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyKlaviyoSignature({ req, secret }) {
    if (!secret || typeof secret !== 'string') {
        return { valid: false, reason: 'missing webhook secret' };
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
    const computed = crypto
        .createHmac('sha256', secret)
        .update(body)
        .update(String(timestamp))
        .digest('hex');

    if (!safeCompareHex(computed, String(signature))) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    verifyKlaviyoSignature,
    extractBodyString,
    safeCompareHex,
    getHeader,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    WEBHOOK_ID_HEADER,
};
