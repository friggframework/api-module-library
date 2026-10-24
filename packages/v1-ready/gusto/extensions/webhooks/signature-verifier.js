const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-gusto-signature';

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
 * Reconstruct the request body string as Gusto signed it.
 * Prefer rawBody (bytes as received); fall back to JSON.stringify of parsed body.
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
 * Verify Gusto's X-Gusto-Signature header.
 *
 * Gusto computes HMAC-SHA256 of the event payload using the webhook
 * subscription's verification_token as the secret, and sends the digest in
 * X-Gusto-Signature.
 *
 * @see https://docs.gusto.com/app-integrations/docs/webhooks
 *      (Secure your webhook endpoint)
 *
 * @param {Object} params
 * @param {import('express').Request|Object} [params.req]
 * @param {string|Buffer} [params.rawBody]
 * @param {string} [params.signature]
 * @param {string} params.verificationToken - From subscription verification
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyGustoSignature({
    req,
    rawBody,
    signature,
    verificationToken,
} = {}) {
    if (!verificationToken) {
        return { valid: false, reason: 'missing verification_token' };
    }

    const sig =
        signature ||
        (req ? getHeader(req.headers, SIGNATURE_HEADER) : undefined);
    if (!sig) {
        return { valid: false, reason: 'missing X-Gusto-Signature header' };
    }

    const body =
        rawBody !== undefined && rawBody !== null
            ? Buffer.isBuffer(rawBody)
                ? rawBody.toString('utf8')
                : String(rawBody)
            : req
              ? extractBodyString(req)
              : '';

    const expected = crypto
        .createHmac('sha256', verificationToken)
        .update(body, 'utf8')
        .digest('hex');

    const a = Buffer.from(String(sig));
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
        return { valid: false, reason: 'signature mismatch' };
    }
    if (!crypto.timingSafeEqual(a, b)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    SIGNATURE_HEADER,
    getHeader,
    extractBodyString,
    verifyGustoSignature,
};
