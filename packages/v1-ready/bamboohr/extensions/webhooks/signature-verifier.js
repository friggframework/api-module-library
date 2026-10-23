const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-bamboohr-signature';
const TIMESTAMP_HEADER = 'x-bamboohr-timestamp';

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
 * Reconstruct the raw body string BambooHR signed.
 * Prefer req.rawBody (bytes as received); otherwise stringify parsed JSON.
 *
 * @param {import('express').Request|Object} req
 * @returns {string}
 */
function extractBodyString(req) {
    if (typeof req.rawBody === 'string') return req.rawBody;
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
    if (req.body === undefined || req.body === null) return '';
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
    return JSON.stringify(req.body);
}

/**
 * Verify a BambooHR permissioned webhook delivery.
 *
 * BambooHR signs `rawBody + timestamp` with HMAC-SHA256 using the webhook's
 * `privateKey` (returned only at create time) and sends:
 *   - X-BambooHR-Timestamp
 *   - X-BambooHR-Signature  (hex digest)
 *
 * Docs: https://documentation.bamboohr.com/docs/webhooks#security
 *
 * @param {import('express').Request|Object} req
 * @param {string} privateKey - privateKey from createWebhook response.
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyBambooHRWebhookSignature(req, privateKey) {
    if (!privateKey) {
        return { valid: false, reason: 'missing privateKey' };
    }
    const headers = (req && req.headers) || {};
    const provided = getHeader(headers, SIGNATURE_HEADER);
    const timestamp = getHeader(headers, TIMESTAMP_HEADER);
    if (!provided) {
        return { valid: false, reason: 'missing X-BambooHR-Signature' };
    }
    if (!timestamp) {
        return { valid: false, reason: 'missing X-BambooHR-Timestamp' };
    }

    const body = extractBodyString(req);
    const expected = crypto
        .createHmac('sha256', privateKey)
        .update(body + String(timestamp), 'utf8')
        .digest('hex');

    const a = Buffer.from(String(provided));
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    verifyBambooHRWebhookSignature,
    getHeader,
    extractBodyString,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
};
