const crypto = require('crypto');

const TIMESTAMP_HEADER = 'x-personio-webhook-timestamp';
const SIGNATURE_HEADER = 'x-personio-webhook-signature';
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

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
 * Verify a Personio webhook signature.
 *
 * Algorithm (official docs):
 *   signed = `{timestamp}.{raw_body}`
 *   signature = lowercase-hex HMAC-SHA256(secret, signed)
 *   header may contain comma-separated signatures (rotation grace window)
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string|string[]} args.secret - Active secret or [active, retiring]
 * @param {number} [args.toleranceMs]
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyPersonioSignature({
    req,
    secret,
    toleranceMs = MAX_TIMESTAMP_SKEW_MS,
}) {
    const secrets = (Array.isArray(secret) ? secret : String(secret || '').split(','))
        .map((s) => String(s || '').trim())
        .filter(Boolean);
    if (!secrets.length) {
        return { valid: false, reason: 'missing signing secret' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const headers = req.headers || {};
    const timestamp = getHeader(headers, TIMESTAMP_HEADER);
    const signatureHeader = getHeader(headers, SIGNATURE_HEADER);
    if (!timestamp) {
        return { valid: false, reason: `missing ${TIMESTAMP_HEADER} header` };
    }
    if (!signatureHeader) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    const tsMs = Date.parse(timestamp);
    if (Number.isNaN(tsMs)) {
        return { valid: false, reason: 'invalid timestamp' };
    }
    if (Math.abs(Date.now() - tsMs) > toleranceMs) {
        return { valid: false, reason: 'timestamp outside tolerance' };
    }

    const body = extractBodyString(req);
    const provided = String(signatureHeader)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const signed = `${timestamp}.${body}`;

    for (const sec of secrets) {
        const expected = crypto
            .createHmac('sha256', sec)
            .update(signed, 'utf8')
            .digest('hex');
        for (const sig of provided) {
            if (safeCompareHex(expected, sig)) {
                return { valid: true };
            }
        }
    }
    return { valid: false, reason: 'signature mismatch' };
}

module.exports = {
    verifyPersonioSignature,
    extractBodyString,
    safeCompareHex,
    getHeader,
    TIMESTAMP_HEADER,
    SIGNATURE_HEADER,
    MAX_TIMESTAMP_SKEW_MS,
};
