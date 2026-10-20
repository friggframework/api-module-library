const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-xero-signature';

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
 * Reconstruct the raw body string Xero signed.
 * Prefer req.rawBody (bytes as received); otherwise stringify parsed JSON.
 * Whitespace / key-order changes from JSON.parse → JSON.stringify break HMAC.
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
 * Verify a Xero webhook payload.
 *
 * Xero signs the **raw request body** with HMAC-SHA256 using the webhook
 * signing key from the Developer Portal, then base64-encodes the digest into
 * the `x-xero-signature` header.
 *
 * Docs: https://developer.xero.com/documentation/guides/webhooks/overview/
 *
 * @param {import('express').Request|Object} req
 * @param {string} webhookKey - Signing key from the Xero Developer Portal.
 * @returns {boolean}
 */
function verifyXeroWebhookSignature(req, webhookKey) {
    if (!webhookKey) return false;
    const provided = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!provided) return false;

    const body = extractBodyString(req);
    const expected = crypto
        .createHmac('sha256', webhookKey)
        .update(body, 'utf8')
        .digest('base64');

    const a = Buffer.from(String(provided));
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

module.exports = {
    SIGNATURE_HEADER,
    getHeader,
    extractBodyString,
    verifyXeroWebhookSignature,
};
