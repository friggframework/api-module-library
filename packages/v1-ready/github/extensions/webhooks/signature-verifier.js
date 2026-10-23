const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-hub-signature-256';

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
 * Reconstruct the raw request body string GitHub signed.
 * Prefer `req.rawBody` (bytes as delivered); fall back to JSON.stringify of
 * the parsed body (best-effort — whitespace changes break HMAC).
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
 * Verify GitHub's `X-Hub-Signature-256` HMAC-SHA256 webhook signature.
 *
 * Docs: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 *
 * @param {Object} params
 * @param {import('express').Request|Object} params.req
 * @param {string} params.secret - Shared webhook secret from hook config
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyGitHubSignature({ req, secret }) {
    if (!secret) {
        return { valid: false, reason: 'missing webhook secret' };
    }
    const signatureHeader = getHeader(req.headers, SIGNATURE_HEADER);
    if (!signatureHeader) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }
    if (!signatureHeader.startsWith('sha256=')) {
        return { valid: false, reason: 'signature must use sha256= prefix' };
    }

    const body = extractBodyString(req);
    const expected =
        'sha256=' +
        crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');

    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    verifyGitHubSignature,
    extractBodyString,
    getHeader,
    SIGNATURE_HEADER,
};
