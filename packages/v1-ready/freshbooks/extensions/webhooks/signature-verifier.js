const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-freshbooks-hmac-sha256';

/**
 * FreshBooks webhook signature verification.
 *
 * Per https://www.freshbooks.com/api/webhooks:
 *   - Header: X-FreshBooks-Hmac-SHA256
 *   - Secret: the verifier string returned when the callback was first registered
 *   - Message: UTF-8 JSON of the form-urlencoded parameters, with spaces after
 *     every `:` and `,` (Python json.dumps default), and all values cast to string
 *   - Signature: base64(HMAC-SHA256(secret, message))
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
 * Build the spaced JSON string FreshBooks signs.
 * All values are cast to string; keys keep insertion order of `params`.
 *
 * @param {Record<string, unknown>} params
 * @returns {string}
 */
function buildSignedPayload(params = {}) {
    const normalized = {};
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        normalized[key] = String(value);
    }
    // json.dumps default separators include spaces after : and ,
    return JSON.stringify(normalized).replace(/":/g, '": ').replace(/,"/g, ', "');
}

function extractParams(req) {
    if (!req || typeof req !== 'object') return {};
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        return req.body;
    }
    if (typeof req.body === 'string' && req.body.length) {
        const usp = new URLSearchParams(req.body);
        const out = {};
        for (const [k, v] of usp.entries()) out[k] = v;
        return out;
    }
    return {};
}

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
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.verifier - Callback verifier / webhook secret
 * @returns {{ valid: boolean, reason?: string, params?: Object }}
 */
function verifyFreshBooksSignature({ req, verifier }) {
    if (!verifier || typeof verifier !== 'string') {
        return { valid: false, reason: 'missing verifier secret' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const signature = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!signature) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    const params = extractParams(req);
    const message = buildSignedPayload(params);
    const expected = crypto
        .createHmac('sha256', verifier)
        .update(message, 'utf8')
        .digest('base64');

    if (!safeCompare(expected, signature)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true, params };
}

module.exports = {
    verifyFreshBooksSignature,
    buildSignedPayload,
    extractParams,
    safeCompare,
    SIGNATURE_HEADER,
};
