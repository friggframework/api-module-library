const crypto = require('crypto');

const SIGNATURE_HEADER = 'signature';

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
 * Prefer rawBody — JSON.parse → JSON.stringify will break the HMAC.
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

function safeCompareHex(expected, provided) {
    if (typeof expected !== 'string' || typeof provided !== 'string') {
        return false;
    }
    try {
        const a = Buffer.from(expected.toLowerCase(), 'utf8');
        const b = Buffer.from(provided.toLowerCase(), 'utf8');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch (_err) {
        return false;
    }
}

/**
 * Verify a TriNet webhook Signature header.
 *
 * Algorithm (official docs):
 *   signature = lowercase-hex HMAC-SHA256(webhook_shared_secret, raw_body)
 *
 * Official test vector:
 *   secret  = lDVtBQnoRcqYv4fUeVD0oyzgsKWHGtqhatjBX5wXRFQzkVUCzBA571E4qUxvR5LE
 *   payload = {"test":"valid payload"}
 *   Signature: 219a08ea32f319931dc849badc076323f40367aad859ddba4de82e33135fad31
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.secret - Application webhook shared secret
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyTriNetSignature({ req, secret }) {
    if (!secret || typeof secret !== 'string') {
        return { valid: false, reason: 'missing webhook shared secret' };
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
        .createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('hex');

    if (!safeCompareHex(expected, signature)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    verifyTriNetSignature,
    extractBodyString,
    safeCompareHex,
    getHeader,
    SIGNATURE_HEADER,
};
