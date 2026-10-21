const crypto = require('crypto');

const TIMESTAMP_HEADER = 'api-timestamp';
const SIGNATURE_HEADER = 'api-signature';

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
 * Reconstruct the raw body string Housecall Pro signed.
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
 * Constant-time compare of two hex HMAC digests.
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
 * Verify a Housecall Pro webhook using Api-Timestamp + Api-Signature.
 *
 * Per official Webhooks docs:
 *   signature_body = timestamp + "." + json_payload
 *   digest = HMAC-SHA256(signing_secret, signature_body) as hex
 *   compare to Api-Signature header
 *
 * Docs: https://docs.housecallpro.com/docs/housecall-public-api/46e9e1be07621-webhooks
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.signingSecret - Webhooks app signing secret
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyHousecallProSignature({ req, signingSecret }) {
    if (!signingSecret || typeof signingSecret !== 'string') {
        return { valid: false, reason: 'missing signing secret' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const timestamp = getHeader(req.headers || {}, TIMESTAMP_HEADER);
    if (!timestamp) {
        return { valid: false, reason: `missing ${TIMESTAMP_HEADER} header` };
    }

    const signature = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!signature) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    const body = extractBodyString(req);
    const signatureBody = `${timestamp}.${body}`;
    const expected = crypto
        .createHmac('sha256', signingSecret)
        .update(signatureBody, 'utf8')
        .digest('hex');

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
 * @param {string} signingSecret
 * @param {string} [timestamp]
 * @returns {boolean}
 */
function verifyWebhookSignature(
    rawBody,
    signatureHeader,
    signingSecret,
    timestamp
) {
    const result = verifyHousecallProSignature({
        req: {
            headers: {
                [SIGNATURE_HEADER]: signatureHeader,
                [TIMESTAMP_HEADER]: timestamp,
            },
            rawBody:
                typeof rawBody === 'string'
                    ? rawBody
                    : Buffer.isBuffer(rawBody)
                      ? rawBody.toString('utf8')
                      : String(rawBody || ''),
        },
        signingSecret,
    });
    return result.valid;
}

module.exports = {
    verifyHousecallProSignature,
    verifyWebhookSignature,
    extractBodyString,
    safeCompare,
    TIMESTAMP_HEADER,
    SIGNATURE_HEADER,
};
