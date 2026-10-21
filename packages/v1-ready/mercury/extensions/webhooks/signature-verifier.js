const crypto = require('crypto');

const SIGNATURE_HEADER = 'Mercury-Signature';

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
 * Reconstruct the raw body string Mercury signed.
 * Prefer req.rawBody when middleware preserved it — re-serializing JSON
 * breaks the HMAC.
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
 * Parse `Mercury-Signature: t=<unix>,v1=<hex>` into parts.
 *
 * @param {string} header
 * @returns {{ t: string, v1: string }|null}
 */
function parseMercurySignature(header) {
    if (!header || typeof header !== 'string') return null;
    const parts = {};
    for (const segment of header.split(',')) {
        const eq = segment.indexOf('=');
        if (eq === -1) continue;
        const key = segment.slice(0, eq).trim();
        const value = segment.slice(eq + 1).trim();
        if (key && value) parts[key] = value;
    }
    if (!parts.t || !parts.v1) return null;
    return { t: parts.t, v1: parts.v1 };
}

/**
 * Verify a Mercury webhook delivery.
 *
 * Mercury signs `timestamp.rawBody` with HMAC-SHA256 using the webhook
 * endpoint's `secret` (returned once by createWebhook) and sends the digest
 * in the `Mercury-Signature` header as `t=<unix>,v1=<hex>`.
 *
 * Docs: https://docs.mercury.com/reference/webhooks
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.secret - Webhook endpoint signing secret
 * @param {number} [args.maxSkewSeconds=300] - Reject if timestamp skew exceeds this
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyMercurySignature({ req, secret, maxSkewSeconds = 300 }) {
    if (!secret || typeof secret !== 'string') {
        return { valid: false, reason: 'missing webhook secret' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const header = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!header) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    const parsed = parseMercurySignature(header);
    if (!parsed) {
        return { valid: false, reason: 'invalid Mercury-Signature format' };
    }

    const ts = Number(parsed.t);
    if (!Number.isFinite(ts)) {
        return { valid: false, reason: 'invalid signature timestamp' };
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > maxSkewSeconds) {
        return { valid: false, reason: 'signature timestamp skew' };
    }

    const body = extractBodyString(req);
    const signedPayload = `${parsed.t}.${body}`;
    const expected = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');

    const sigBuf = Buffer.from(String(parsed.v1), 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');
    if (sigBuf.length !== expBuf.length) {
        return { valid: false, reason: 'signature mismatch' };
    }
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    verifyMercurySignature,
    parseMercurySignature,
    extractBodyString,
    getHeader,
    SIGNATURE_HEADER,
};
