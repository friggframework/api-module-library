const crypto = require('crypto');

/**
 * Verify Segment Webhooks (Actions) HMAC signature.
 *
 * Official docs (Webhooks Actions destination):
 *   If you provide a shared secret, Segment signs requests with an HMAC in the
 *   "X-Signature" request header. The HMAC is a hex-encoded SHA1 hash generated
 *   using the shared secret and the request body.
 *
 *   https://www.twilio.com/docs/segment/connections/destinations/catalog/actions-webhook
 *
 * @param {object} params
 * @param {object} params.req Express-like request (headers, rawBody|body)
 * @param {string} params.secret Shared secret from the Webhooks destination
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifySegmentSignature({ req, secret }) {
    if (!secret) {
        return { valid: false, reason: 'missing SEGMENT_WEBHOOK_SHARED_SECRET' };
    }

    const headers = (req && req.headers) || {};
    const signature =
        headers['x-signature'] ||
        headers['X-Signature'] ||
        headers['x-signature'.toLowerCase()];

    if (!signature) {
        return { valid: false, reason: 'missing X-Signature header' };
    }

    let rawBody;
    if (req.rawBody !== undefined && req.rawBody !== null) {
        rawBody =
            typeof req.rawBody === 'string'
                ? req.rawBody
                : Buffer.from(req.rawBody).toString('utf8');
    } else if (typeof req.body === 'string') {
        rawBody = req.body;
    } else if (req.body !== undefined) {
        rawBody = JSON.stringify(req.body);
    } else {
        return { valid: false, reason: 'missing request body' };
    }

    const expected = crypto
        .createHmac('sha1', String(secret))
        .update(rawBody, 'utf8')
        .digest('hex');

    const provided = String(signature).trim().toLowerCase();
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');
    if (expectedBuf.length !== providedBuf.length) {
        return { valid: false, reason: 'signature mismatch' };
    }
    if (!crypto.timingSafeEqual(expectedBuf, providedBuf)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = { verifySegmentSignature };
