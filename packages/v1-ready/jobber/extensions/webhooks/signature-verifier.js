const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-jobber-hmac-sha256';

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
 * Reconstruct the raw body string Jobber signed.
 * Prefer req.rawBody when middleware preserved it — JSON.stringify of a
 * parsed body can change key order / whitespace and break the HMAC.
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
 * Constant-time compare of two base64 HMAC digests.
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
        const a = Buffer.from(expected, 'base64');
        const b = Buffer.from(provided, 'base64');
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    } catch (_err) {
        return false;
    }
}

/**
 * Verify a Jobber webhook using X-Jobber-Hmac-SHA256.
 *
 * Per Jobber docs (Setting Up Webhooks):
 *   digest = HMAC-SHA256(client_secret, raw_body)
 *   header = Base64(digest)
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.clientSecret - App OAuth client secret
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyJobberSignature({ req, clientSecret }) {
    if (!clientSecret || typeof clientSecret !== 'string') {
        return { valid: false, reason: 'missing client secret' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const signature = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!signature) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    const body = extractBodyString(req);
    const expected = crypto
        .createHmac('sha256', clientSecret)
        .update(body, 'utf8')
        .digest('base64');

    if (!safeCompare(expected, signature)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

/**
 * Convenience wrapper matching the verifyWebhookSignature naming used in
 * capability manifests across api-modules.
 *
 * @param {string|Buffer} rawBody
 * @param {string} signatureHeader
 * @param {string} clientSecret
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signatureHeader, clientSecret) {
    const result = verifyJobberSignature({
        req: {
            headers: { [SIGNATURE_HEADER]: signatureHeader },
            rawBody:
                typeof rawBody === 'string'
                    ? rawBody
                    : Buffer.isBuffer(rawBody)
                      ? rawBody.toString('utf8')
                      : String(rawBody || ''),
        },
        clientSecret,
    });
    return result.valid;
}

module.exports = {
    verifyJobberSignature,
    verifyWebhookSignature,
    extractBodyString,
    safeCompare,
    SIGNATURE_HEADER,
};
