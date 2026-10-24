const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-attentive-hmac-sha256';

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
 * Reconstruct the request body string Attentive signed.
 * Prefer rawBody — JSON.parse → JSON.stringify will break the HMAC.
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
 * Verify an Attentive webhook signature.
 *
 * Algorithm (per https://docs.attentive.com/docs/webhook-authentication):
 *   signature = hex(HMAC-SHA256(signing_key, utf8(raw_body)))
 *   header    = x-attentive-hmac-sha256
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.signingKey - Signing key from the Attentive app Webhooks tab
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyAttentiveSignature({ req, signingKey }) {
    if (!signingKey || typeof signingKey !== 'string') {
        return { valid: false, reason: 'missing signing key' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const signature = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!signature) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    const body = extractBodyString(req);
    const expected = crypto
        .createHmac('sha256', signingKey)
        .update(body, 'utf8')
        .digest('hex');

    if (!safeCompare(expected, signature)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    verifyAttentiveSignature,
    extractBodyString,
    safeCompare,
    getHeader,
    SIGNATURE_HEADER,
};
