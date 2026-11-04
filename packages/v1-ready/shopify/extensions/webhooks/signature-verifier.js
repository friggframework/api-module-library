const crypto = require('crypto');

/**
 * Shopify HTTPS webhook HMAC verification.
 * Docs: https://shopify.dev/docs/apps/build/webhooks/subscribe/https
 *
 * Header: X-Shopify-Hmac-Sha256 (base64 HMAC-SHA256 of the raw body, keyed
 * with the app client secret).
 */

function getHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    const lower = name.toLowerCase();
    if (headers[name] !== undefined) return headers[name];
    if (headers[lower] !== undefined) return headers[lower];
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lower) return headers[key];
    }
    return undefined;
}

function extractBodyBuffer(req) {
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
    if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
    if (req.body === undefined || req.body === null) return Buffer.from('');
    return Buffer.from(JSON.stringify(req.body), 'utf8');
}

/**
 * @param {object} params
 * @param {import('express').Request|object} params.req
 * @param {string} params.clientSecret - SHOPIFY_CLIENT_SECRET
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyShopifySignature({ req, clientSecret }) {
    if (!clientSecret) {
        return { valid: false, reason: 'missing client secret' };
    }
    const headers = req.headers || {};
    const hmacHeader = getHeader(headers, 'x-shopify-hmac-sha256');
    if (!hmacHeader) {
        return { valid: false, reason: 'missing X-Shopify-Hmac-Sha256' };
    }

    const raw = extractBodyBuffer(req);
    const digest = crypto
        .createHmac('sha256', clientSecret)
        .update(raw)
        .digest('base64');

    try {
        const a = Buffer.from(digest, 'base64');
        const b = Buffer.from(String(hmacHeader), 'base64');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return { valid: false, reason: 'hmac mismatch' };
        }
        return { valid: true };
    } catch (e) {
        return { valid: false, reason: e.message || 'hmac compare failed' };
    }
}

module.exports = {
    verifyShopifySignature,
    getHeader,
    extractBodyBuffer,
};
