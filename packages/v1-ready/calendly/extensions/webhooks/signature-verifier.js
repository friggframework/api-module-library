const crypto = require('crypto');

const SIGNATURE_HEADER = 'calendly-webhook-signature';
// Calendly's documented tolerance zone: reject timestamps older than 3 minutes.
const MAX_TIMESTAMP_SKEW_SEC = 180;

/**
 * Read a header value case-insensitively from a request-like object.
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
 * Reconstruct the request body string as Calendly signed it.
 * Prefer req.rawBody when middleware preserved the exact bytes.
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
 * Parse `t=<unix>,v1=<hex>` from Calendly-Webhook-Signature.
 *
 * @param {string} header
 * @returns {{ t: string, signature: string }|null}
 */
function parseSignatureHeader(header) {
    if (!header || typeof header !== 'string') return null;
    const parts = header.split(',').reduce(
        (acc, currentValue) => {
            const [key, ...rest] = currentValue.split('=');
            const value = rest.join('=');
            if (key === 't') acc.t = value;
            if (key === 'v1') acc.signature = value;
            return acc;
        },
        { t: '', signature: '' }
    );
    if (!parts.t || !parts.signature) return null;
    return parts;
}

/**
 * Constant-time hex digest comparison.
 *
 * @param {string} expected
 * @param {string} provided
 * @returns {boolean}
 */
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
 * Verify a Calendly webhook signature.
 *
 * Algorithm (per Calendly docs):
 *   signed_payload = `${t}.${rawBody}`
 *   expected       = hex(HMAC-SHA256(signing_key, signed_payload))
 *   compare to v1; reject if timestamp older than tolerance (default 180s).
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.signingKey - OAuth app or subscription signing key
 * @param {number} [args.maxSkewSec=180]
 * @param {Function} [args.now=Date.now]
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyCalendlySignature({
    req,
    signingKey,
    maxSkewSec = MAX_TIMESTAMP_SKEW_SEC,
    now = Date.now,
}) {
    if (!signingKey || typeof signingKey !== 'string') {
        return { valid: false, reason: 'missing signing key' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const header = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!header) {
        return {
            valid: false,
            reason: `missing ${SIGNATURE_HEADER} header`,
        };
    }

    const parsed = parseSignatureHeader(header);
    if (!parsed) {
        return { valid: false, reason: 'malformed signature header' };
    }

    const tsNumber = Number(parsed.t);
    if (!Number.isFinite(tsNumber)) {
        return { valid: false, reason: 'malformed timestamp' };
    }
    const skewSec = Math.abs(now() / 1000 - tsNumber);
    if (skewSec > maxSkewSec) {
        return {
            valid: false,
            reason: `timestamp skew ${Math.round(skewSec)}s exceeds max ${maxSkewSec}s`,
        };
    }

    const body = extractBodyString(req);
    const signedPayload = `${parsed.t}.${body}`;
    const expected = crypto
        .createHmac('sha256', signingKey)
        .update(signedPayload, 'utf8')
        .digest('hex');

    if (!safeCompare(expected, parsed.signature)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    verifyCalendlySignature,
    extractBodyString,
    parseSignatureHeader,
    safeCompare,
    SIGNATURE_HEADER,
    MAX_TIMESTAMP_SKEW_SEC,
};
