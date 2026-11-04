const crypto = require('crypto');

/**
 * Shopmonkey webhook authenticity (Webhook Standard).
 *
 * Docs: https://shopmonkey.dev/webhooks
 *
 * Signed message: `${webhook-id}.${webhook-timestamp}.${rawBody}`
 * Algorithm: HMAC-SHA256, compared against `webhook-signature` (base64; may be
 * space-separated after secret rotation).
 */

const ID_HEADER = 'webhook-id';
const TIMESTAMP_HEADER = 'webhook-timestamp';
const SIGNATURE_HEADER = 'webhook-signature';
const MAX_TIMESTAMP_SKEW_SEC = 5 * 60;

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

function extractBodyString(req) {
    if (typeof req.rawBody === 'string') return req.rawBody;
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
    if (req.body === undefined || req.body === null) return '';
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
    return JSON.stringify(req.body);
}

/**
 * Verify a Shopmonkey webhook delivery.
 *
 * @param {object} req - Express-like request (headers + body/rawBody)
 * @param {string} secret - Shared webhook secret
 * @param {{ maxSkewSec?: number }} [opts]
 * @returns {{ ok: boolean, reason?: string }}
 */
function verifyShopmonkeyWebhookSignature(req, secret, opts = {}) {
    if (!secret) {
        return { ok: false, reason: 'missing_secret' };
    }

    const headers = req.headers || {};
    const msgId = getHeader(headers, ID_HEADER);
    const timestamp = getHeader(headers, TIMESTAMP_HEADER);
    const signatureHeader = getHeader(headers, SIGNATURE_HEADER);

    if (!msgId || !timestamp || !signatureHeader) {
        return { ok: false, reason: 'missing_headers' };
    }

    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
        return { ok: false, reason: 'invalid_timestamp' };
    }

    const maxSkew = opts.maxSkewSec ?? MAX_TIMESTAMP_SKEW_SEC;
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > maxSkew) {
        return { ok: false, reason: 'timestamp_skew' };
    }

    const payload = extractBodyString(req);
    const signed = `${msgId}.${timestamp}.${payload}`;
    const expected = crypto
        .createHmac('sha256', String(secret))
        .update(signed, 'utf8')
        .digest('base64');

    const candidates = String(signatureHeader)
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean)
        // Tolerate `v1,<sig>` / `whsec_…` style prefixes if present.
        .map((s) => {
            const parts = s.split(',');
            return parts[parts.length - 1];
        });

    const expectedBuf = Buffer.from(expected);
    for (const candidate of candidates) {
        const got = Buffer.from(candidate);
        if (
            got.length === expectedBuf.length &&
            crypto.timingSafeEqual(got, expectedBuf)
        ) {
            return { ok: true };
        }
    }

    return { ok: false, reason: 'signature_mismatch' };
}

module.exports = {
    verifyShopmonkeyWebhookSignature,
    getHeader,
    extractBodyString,
    ID_HEADER,
    TIMESTAMP_HEADER,
    SIGNATURE_HEADER,
};
