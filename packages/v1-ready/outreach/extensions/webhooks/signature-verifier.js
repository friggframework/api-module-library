const crypto = require('crypto');

const SIGNATURE_HEADER = 'Outreach-Webhook-Signature';

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
 * Reconstruct the raw body string Outreach signed.
 * Prefer req.rawBody when body-parser preserved the original bytes.
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

function timingSafeEqualHex(a, b) {
    const bufA = Buffer.from(String(a), 'utf8');
    const bufB = Buffer.from(String(b), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify an Outreach webhook delivery.
 * Docs: https://developers.outreach.io/api/webhooks#authenticity-validation
 *
 * Outreach-Webhook-Signature === HMAC-SHA256-hex(secret, raw_body)
 *
 * @param {Object} opts
 * @param {import('express').Request|Object} opts.req
 * @param {string} opts.secret - Webhook attributes.secret
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyOutreachSignature({ req, secret }) {
    if (!secret) {
        return { valid: false, reason: 'missing webhook secret' };
    }
    const signature = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!signature) {
        return { valid: false, reason: 'missing Outreach-Webhook-Signature' };
    }
    const body = extractBodyString(req);
    const expected = crypto
        .createHmac('sha256', String(secret))
        .update(body)
        .digest('hex');
    if (!timingSafeEqualHex(expected, signature)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    verifyOutreachSignature,
    SIGNATURE_HEADER,
    getHeader,
    extractBodyString,
};
