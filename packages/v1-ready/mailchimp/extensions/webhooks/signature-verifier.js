const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-mailchimp-signature';
// Mailchimp's documented skew window: reject if older than 5 minutes.
const MAX_TIMESTAMP_SKEW_SECONDS = 300;

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
 * Reconstruct the raw request body bytes Mailchimp signed.
 * Prefer `req.rawBody` when middleware preserved it.
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
    // Classic deliveries are application/x-www-form-urlencoded; signed
    // examples in the docs also show JSON. Prefer reconstructing neither
    // when rawBody is missing — callers should preserve raw bytes.
    if (
        req.headers &&
        String(getHeader(req.headers, 'content-type') || '').includes(
            'application/x-www-form-urlencoded'
        ) &&
        typeof req.body === 'object'
    ) {
        return new URLSearchParams(
            flattenFormBody(req.body)
        ).toString();
    }
    return JSON.stringify(req.body);
}

/**
 * Flatten Express-style nested form bodies (`data[list_id]`) back into
 * bracket-key pairs for a best-effort raw reconstruction when rawBody is
 * unavailable. Prefer preserving rawBody in middleware.
 *
 * @param {Object} obj
 * @param {string} [prefix]
 * @returns {Array<[string, string]>}
 */
function flattenFormBody(obj, prefix = '') {
    const out = [];
    if (obj === null || obj === undefined) return out;
    if (typeof obj !== 'object' || Array.isArray(obj)) {
        out.push([prefix, obj === undefined || obj === null ? '' : String(obj)]);
        return out;
    }
    for (const [key, value] of Object.entries(obj)) {
        const next = prefix ? `${prefix}[${key}]` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            out.push(...flattenFormBody(value, next));
        } else if (Array.isArray(value)) {
            for (const item of value) {
                out.push([`${next}[]`, item === undefined || item === null ? '' : String(item)]);
            }
        } else {
            out.push([next, value === undefined || value === null ? '' : String(value)]);
        }
    }
    return out;
}

/**
 * Parse `t={unix},v1={hex}` from X-Mailchimp-Signature.
 *
 * @param {string} header
 * @returns {{ timestamp: number, signature: string }|null}
 */
function parseSignatureHeader(header) {
    if (!header || typeof header !== 'string') return null;
    const tsMatch = header.match(/\bt=(\d+)\b/);
    const sigMatch = header.match(/\bv1=([0-9a-fA-F]{64})\b/);
    if (!tsMatch || !sigMatch) return null;
    return {
        timestamp: parseInt(tsMatch[1], 10),
        signature: sigMatch[1].toLowerCase(),
    };
}

/**
 * Verify a Mailchimp list-webhook signature.
 *
 * Per https://mailchimp.com/developer/marketing/guides/sync-audience-data-webhooks/:
 *   HMAC-SHA256(key=signing_secret, message="{timestamp}.{raw_body}") → hex
 *   compared to v1 in `X-Mailchimp-Signature: t={ts},v1={hex}`.
 *   Reject when |now - ts| > 300 seconds.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.secret - The webhook signing_secret (shown once at create).
 * @param {number} [args.toleranceSeconds]
 * @param {number} [args.nowSeconds] - injectable clock for tests
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyMailchimpSignature({
    req,
    secret,
    toleranceSeconds = MAX_TIMESTAMP_SKEW_SECONDS,
    nowSeconds,
} = {}) {
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

    const parsed = parseSignatureHeader(header);
    if (!parsed) {
        return {
            valid: false,
            reason: `malformed ${SIGNATURE_HEADER} header`,
        };
    }

    const now =
        typeof nowSeconds === 'number'
            ? nowSeconds
            : Math.floor(Date.now() / 1000);
    if (Math.abs(now - parsed.timestamp) > toleranceSeconds) {
        return { valid: false, reason: 'timestamp outside tolerance window' };
    }

    const rawBody = extractBodyString(req);
    const expectedHex = crypto
        .createHmac('sha256', secret)
        .update(`${parsed.timestamp}.${rawBody}`)
        .digest('hex');

    try {
        const expected = Buffer.from(expectedHex, 'utf8');
        const received = Buffer.from(parsed.signature, 'utf8');
        if (expected.length !== received.length) {
            return { valid: false, reason: 'signature mismatch' };
        }
        if (!crypto.timingSafeEqual(expected, received)) {
            return { valid: false, reason: 'signature mismatch' };
        }
    } catch (_err) {
        return { valid: false, reason: 'signature mismatch' };
    }

    return { valid: true };
}

module.exports = {
    SIGNATURE_HEADER,
    MAX_TIMESTAMP_SKEW_SECONDS,
    getHeader,
    extractBodyString,
    parseSignatureHeader,
    verifyMailchimpSignature,
};
