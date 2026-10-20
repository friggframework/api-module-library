const crypto = require('crypto');

const SIGNATURE_HEADER = 'typeform-signature';

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
 * Reconstruct the raw body string Typeform signed.
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
 * Verify a Typeform webhook delivery.
 *
 * Typeform HMAC-SHA256s the raw payload with the webhook `secret`, base64-
 * encodes the digest, and sends `Typeform-Signature: sha256=<digest>`.
 *
 * Docs: https://www.typeform.com/developers/webhooks/secure-your-webhooks/
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.secret - Webhook secret configured via createOrUpdateWebhook
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyTypeformSignature({ req, secret }) {
    if (!secret) {
        return { valid: false, reason: 'missing webhook secret' };
    }

    const received = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!received) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    const body = extractBodyString(req);
    const hash = crypto.createHmac('sha256', secret).update(body).digest('base64');
    const expected = `sha256=${hash}`;

    const sigBuf = Buffer.from(String(received));
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) {
        return { valid: false, reason: 'signature mismatch' };
    }
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    SIGNATURE_HEADER,
    verifyTypeformSignature,
    extractBodyString,
    getHeader,
};
