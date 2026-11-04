const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-notion-signature';

function getHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    const want = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === want) {
            const v = headers[key];
            return Array.isArray(v) ? v[0] : v;
        }
    }
    return undefined;
}

/**
 * Prefer raw body bytes — JSON.parse → JSON.stringify changes whitespace/key
 * order and breaks Notion's HMAC. Fallback matches Notion's Node sample
 * (JSON.stringify of the parsed body).
 */
function extractBodyString(req) {
    if (typeof req.rawBody === 'string') return req.rawBody;
    if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString('utf8');
    if (req.body === undefined || req.body === null) return '';
    if (typeof req.body === 'string') return req.body;
    if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
    return JSON.stringify(req.body);
}

function safeCompare(expected, provided) {
    if (typeof expected !== 'string' || typeof provided !== 'string') {
        return false;
    }
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/**
 * Verify Notion webhook HMAC.
 *
 * Algorithm (per Notion docs):
 *   signature = "sha256=" + hex(HMAC-SHA256(verification_token, raw_body))
 * Header: X-Notion-Signature
 *
 * @see https://developers.notion.com/reference/webhooks
 */
function verifyNotionSignature({ req, verificationToken }) {
    if (!verificationToken || typeof verificationToken !== 'string') {
        return { valid: false, reason: 'missing verification token' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const signature = getHeader(req.headers || {}, SIGNATURE_HEADER);
    if (!signature) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }

    const body = extractBodyString(req);
    const expected = `sha256=${crypto
        .createHmac('sha256', verificationToken)
        .update(body, 'utf8')
        .digest('hex')}`;

    if (!safeCompare(expected, signature)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    verifyNotionSignature,
    extractBodyString,
    safeCompare,
    SIGNATURE_HEADER,
};
