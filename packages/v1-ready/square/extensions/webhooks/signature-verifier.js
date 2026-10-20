const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-square-hmacsha256-signature';

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
 * Reconstruct the raw body string Square signed.
 * Prefer req.rawBody when middleware preserved it.
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
 * Verify a Square webhook notification.
 *
 * Square signs `notificationUrl + body` with HMAC-SHA256 using the
 * subscription signature key and sends the digest in
 * `x-square-hmacsha256-signature` (base64).
 *
 * Docs: https://developer.squareup.com/docs/webhooks/step3validate
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.signatureKey - Webhook subscription signature key
 * @param {string} args.notificationUrl - Exact notification URL configured on the subscription
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifySquareSignature({ req, signatureKey, notificationUrl }) {
    if (!signatureKey) {
        return { valid: false, reason: 'missing signature key' };
    }
    if (!notificationUrl) {
        return { valid: false, reason: 'missing notification URL' };
    }

    const signature = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!signature) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    const body = extractBodyString(req);
    const payload = notificationUrl + body;
    const expected = crypto
        .createHmac('sha256', signatureKey)
        .update(payload, 'utf8')
        .digest('base64');

    const sigBuf = Buffer.from(String(signature));
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) {
        return { valid: false, reason: 'signature mismatch' };
    }
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    SIGNATURE_HEADER,
    verifySquareSignature,
    extractBodyString,
    getHeader,
};
