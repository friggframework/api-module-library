const crypto = require('crypto');

const SIGNATURE_HEADER = 'bob-signature';

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

function safeCompareBase64(expected, provided) {
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
 * Verify a Bob webhook signature.
 *
 * Official algorithm
 * (https://apidocs.hibob.com/reference/getting-started-webhooks):
 *   signature = Base64(HMAC-SHA512(secret, raw_body_bytes))
 *   header: Bob-Signature
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string|string[]} args.secret - Active secret or [active, retiring]
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyHiBobSignature({ req, secret }) {
    const secrets = (
        Array.isArray(secret) ? secret : String(secret || '').split(',')
    )
        .map((s) => String(s || '').trim())
        .filter(Boolean);
    if (!secrets.length) {
        return { valid: false, reason: 'missing signing secret' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const headers = req.headers || {};
    const signatureHeader = getHeader(headers, SIGNATURE_HEADER);
    if (!signatureHeader) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    const body = extractBodyString(req);
    const provided = String(signatureHeader)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    for (const sec of secrets) {
        const expected = crypto
            .createHmac('sha512', sec)
            .update(body, 'utf8')
            .digest('base64');
        for (const sig of provided) {
            if (safeCompareBase64(expected, sig)) {
                return { valid: true };
            }
        }
    }
    return { valid: false, reason: 'signature mismatch' };
}

/**
 * Bob sends an initial connection check as plain text " Ping test" or
 * JSON {"text":"Ping test"}. Listener must return 200.
 */
function isPingTest(req) {
    const body = req && req.body;
    if (body == null) return false;
    if (typeof body === 'string') {
        return body.trim() === 'Ping test';
    }
    if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        return body.text === 'Ping test';
    }
    if (Buffer.isBuffer(body)) {
        return body.toString('utf8').trim() === 'Ping test';
    }
    return false;
}

module.exports = {
    verifyHiBobSignature,
    extractBodyString,
    safeCompareBase64,
    getHeader,
    isPingTest,
    SIGNATURE_HEADER,
};
