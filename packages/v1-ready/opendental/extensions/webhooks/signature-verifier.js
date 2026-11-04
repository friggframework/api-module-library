/**
 * Open Dental API Events do not use an HMAC signature. Deliveries include the
 * Customer API Key in the `Authorization` header (raw customer key — not the
 * ODFHIR developer/customer pair used for outbound API calls), plus
 * `Workstation` and `Event-Type` headers.
 *
 * Docs: https://www.opendental.com/site/apievents.html
 *
 * Verification here is a constant-time compare of the inbound Authorization
 * value against the known customer key for the install.
 */

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
 * Constant-time string compare.
 *
 * @param {string} expected
 * @param {string} provided
 * @returns {boolean}
 */
function safeCompare(expected, provided) {
    if (typeof expected !== 'string' || typeof provided !== 'string') {
        return false;
    }
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length) return false;
    const crypto = require('crypto');
    return crypto.timingSafeEqual(a, b);
}

/**
 * Verify an inbound Open Dental API Event.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req
 * @param {string} args.customerKey - Expected Customer API Key
 * @returns {{ valid: boolean, reason?: string, eventType?: string, workstation?: string }}
 */
function verifyOpenDentalEvent({ req, customerKey }) {
    if (!customerKey || typeof customerKey !== 'string') {
        return { valid: false, reason: 'missing customer key' };
    }

    const headers = (req && req.headers) || {};
    const provided = getHeader(headers, 'authorization');
    if (!provided) {
        return { valid: false, reason: 'missing Authorization header' };
    }

    // Docs show the raw CustomerKey; tolerate an accidental "ODFHIR …/key" form.
    let candidate = String(provided).trim();
    const odfhir = /^ODFHIR\s+[^/]+\/(.+)$/i.exec(candidate);
    if (odfhir) {
        candidate = odfhir[1];
    }

    if (!safeCompare(customerKey, candidate)) {
        return { valid: false, reason: 'customer key mismatch' };
    }

    return {
        valid: true,
        eventType: getHeader(headers, 'event-type') || undefined,
        workstation: getHeader(headers, 'workstation') || undefined,
    };
}

module.exports = {
    verifyOpenDentalEvent,
    getHeader,
    safeCompare,
};
