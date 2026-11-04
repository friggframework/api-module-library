const crypto = require('crypto');

/**
 * PandaDoc signs every webhook delivery with HMAC-SHA256 over the raw HTTP
 * body (UTF-8), using the subscription's shared key. The signature is
 * delivered as the `signature` query parameter on the POST URL:
 *
 *   POST https://your.endpoint/webhooks?signature=<hex>
 *
 * Docs: https://developers.pandadoc.com/docs/webhook-verification
 */

/**
 * Reconstruct the raw body string PandaDoc signed. Prefer `req.rawBody`
 * (bytes as received) — any JSON.parse → JSON.stringify round-trip can
 * change whitespace/key order and break the HMAC.
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
 * Pull `signature` from the request URL query (Express `req.query` or raw URL).
 *
 * @param {import('express').Request|Object} req
 * @returns {string|undefined}
 */
function extractSignature(req) {
    if (req && req.query && req.query.signature) {
        return String(req.query.signature);
    }
    const url = (req && (req.originalUrl || req.url)) || '';
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return undefined;
    const params = new URLSearchParams(url.slice(qIndex + 1));
    return params.get('signature') || undefined;
}

/**
 * Verify a PandaDoc webhook signature.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.sharedKey - Subscription shared key (or env fallback).
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyPandaDocSignature({ req, sharedKey }) {
    if (!sharedKey) {
        return { valid: false, reason: 'missing shared key' };
    }
    const received = extractSignature(req);
    if (!received) {
        return { valid: false, reason: 'missing signature query param' };
    }

    const body = extractBodyString(req);
    const expected = crypto
        .createHmac('sha256', String(sharedKey))
        .update(body, 'utf8')
        .digest('hex');

    try {
        const a = Buffer.from(expected, 'hex');
        const b = Buffer.from(String(received), 'hex');
        if (a.length !== b.length || a.length === 0) {
            return { valid: false, reason: 'signature mismatch' };
        }
        if (!crypto.timingSafeEqual(a, b)) {
            return { valid: false, reason: 'signature mismatch' };
        }
        return { valid: true };
    } catch (e) {
        return { valid: false, reason: 'signature compare failed' };
    }
}

module.exports = {
    verifyPandaDocSignature,
    extractBodyString,
    extractSignature,
};
