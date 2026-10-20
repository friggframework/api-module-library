const crypto = require('crypto');

const VERIFICATION_TOKEN_HEADER = 'Verification-Token';
const VALIDATION_TOKEN_HEADER = 'Validation-Token';

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
 * Verify an inbound RingCentral webhook.
 *
 * RingCentral does not HMAC-sign bodies. When a subscription was created with
 * `deliveryMode.verificationToken`, every delivery includes that value as the
 * `Verification-Token` header. Compare it to the configured token.
 *
 * If no verification token is configured, this returns valid:true only when
 * the request is a Validation-Token handshake (subscription setup) — actual
 * event deliveries without a configured token are treated as unverified.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} [args.verificationToken]
 * @returns {{ valid: boolean, reason?: string, isValidation?: boolean, validationToken?: string }}
 */
function verifyRingCentralWebhook({ req, verificationToken }) {
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const headers = req.headers || {};
    const validationToken = getHeader(headers, VALIDATION_TOKEN_HEADER);
    if (validationToken) {
        // Subscription handshake — echo required; no Verification-Token check.
        return {
            valid: true,
            isValidation: true,
            validationToken: String(validationToken),
        };
    }

    if (!verificationToken || typeof verificationToken !== 'string') {
        return {
            valid: false,
            reason: 'missing verification token configuration',
        };
    }

    const provided = getHeader(headers, VERIFICATION_TOKEN_HEADER);
    if (!provided) {
        return {
            valid: false,
            reason: `missing ${VERIFICATION_TOKEN_HEADER} header`,
        };
    }

    if (!safeCompare(verificationToken, String(provided))) {
        return { valid: false, reason: 'verification token mismatch' };
    }
    return { valid: true, isValidation: false };
}

module.exports = {
    verifyRingCentralWebhook,
    getHeader,
    safeCompare,
    VERIFICATION_TOKEN_HEADER,
    VALIDATION_TOKEN_HEADER,
};
