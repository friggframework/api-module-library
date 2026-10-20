const { Api } = require('../../api');

const SIGNATURE_HEADER = 'x-salesloft-signature';
const EVENT_HEADER = 'x-salesloft-event';

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
 * Reconstruct the raw body string Salesloft signed.
 * Prefer req.rawBody when body-parser preserved it.
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
 * Verify a Salesloft webhook delivery.
 *
 * Algorithm (official docs):
 *   x-salesloft-signature = HMAC-SHA1(callback_token, body) as hex
 *   https://developers.salesloft.com/docs/platform/webhooks/delivery-headers/
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.callbackToken - Subscription callback_token.
 * @returns {{ valid: boolean, reason?: string, eventType?: string }}
 */
function verifySalesloftSignature({ req, callbackToken }) {
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }
    const headers = req.headers || {};
    const signature = getHeader(headers, SIGNATURE_HEADER);
    const eventType = getHeader(headers, EVENT_HEADER);
    const body = extractBodyString(req);

    const api = new Api({});
    const result = api.verifyWebhookSignature({
        body,
        signature,
        callbackToken,
    });
    if (!result.valid) return result;
    return { valid: true, eventType };
}

module.exports = {
    verifySalesloftSignature,
    extractBodyString,
    getHeader,
    SIGNATURE_HEADER,
    EVENT_HEADER,
};
