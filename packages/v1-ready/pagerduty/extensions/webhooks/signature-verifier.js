const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-pagerduty-signature';
const SIGNATURE_PREFIX = 'v1=';

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
 * Reconstruct the raw body string PagerDuty signed.
 * Prefer req.rawBody when middleware preserved it.
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
 * Verify a PagerDuty V3 webhook delivery.
 *
 * PagerDuty signs the raw request body with HMAC-SHA256 using the
 * subscription secret and sends one or more signatures in
 * `X-PagerDuty-Signature` as `v1=<hex>[,v1=<hex>...]`.
 *
 * Docs: https://developer.pagerduty.com/docs/verifying-signatures
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.secret - delivery_method.secret from createWebhookSubscription
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyPagerDutySignature({ req, secret }) {
    if (!secret) {
        return { valid: false, reason: 'missing webhook secret' };
    }

    const header = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!header) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    const body = extractBodyString(req);
    if (!body) {
        return { valid: false, reason: 'empty body' };
    }

    const expectedHex = crypto
        .createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('hex');
    const expectedBuf = Buffer.from(expectedHex, 'utf8');

    const candidates = String(header)
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.startsWith(SIGNATURE_PREFIX))
        .map((s) => s.slice(SIGNATURE_PREFIX.length));

    if (candidates.length === 0) {
        return { valid: false, reason: 'malformed signature header' };
    }

    for (const candidate of candidates) {
        const candBuf = Buffer.from(String(candidate), 'utf8');
        if (
            candBuf.length === expectedBuf.length &&
            crypto.timingSafeEqual(candBuf, expectedBuf)
        ) {
            return { valid: true };
        }
    }

    return { valid: false, reason: 'signature mismatch' };
}

/**
 * Convenience for Api / capability `verify` pointers — same algorithm as
 * verifyPagerDutySignature but with explicit body + header strings.
 *
 * @param {string|Buffer} rawBody
 * @param {string} signatureHeader
 * @param {string} secret
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
    const result = verifyPagerDutySignature({
        req: {
            headers: { [SIGNATURE_HEADER]: signatureHeader },
            rawBody:
                typeof rawBody === 'string'
                    ? rawBody
                    : Buffer.isBuffer(rawBody)
                      ? rawBody.toString('utf8')
                      : String(rawBody || ''),
        },
        secret,
    });
    return result.valid;
}

module.exports = {
    verifyPagerDutySignature,
    verifyWebhookSignature,
    SIGNATURE_HEADER,
};
