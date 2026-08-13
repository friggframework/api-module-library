const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-servicetitan-signature';

// ServiceTitan signs V2 webhook deliveries with HMAC-SHA256 over the raw
// request body, using the per-app webhook secret from the developer portal.
//
// IMPORTANT: this must run against the *raw* body bytes. If a JSON body parser
// has already run, `JSON.stringify(req.body)` is not byte-identical to what was
// signed (key order, whitespace, unicode escaping) and every signature fails.
// Capture the raw body first — e.g. express.json({ verify: (req, _res, buf) =>
// { req.rawBody = buf; } }).
function verifySignature({ rawBody, signature, secret }) {
    if (!secret) {
        throw new Error('A ServiceTitan webhook secret is required to verify a delivery');
    }
    if (!signature) return false;

    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody ?? '', 'utf8');
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');

    // Signatures may arrive hex-encoded or base64-encoded depending on app
    // configuration; accept either rather than silently rejecting valid ones.
    const expectedBase64 = Buffer.from(expected, 'hex').toString('base64');
    const provided = String(signature).trim();

    return timingSafeEqual(provided, expected) || timingSafeEqual(provided, expectedBase64);
}

// crypto.timingSafeEqual throws on length mismatch, which itself leaks length.
// Compare fixed-width digests of both sides instead.
function timingSafeEqual(a, b) {
    const digestA = crypto.createHash('sha256').update(String(a)).digest();
    const digestB = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(digestA, digestB);
}

// Extracts the signature regardless of header casing or of whether the caller
// passed an express `req.headers` object or a Lambda event's `headers`.
function getSignatureFromHeaders(headers = {}) {
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === SIGNATURE_HEADER) {
            return Array.isArray(value) ? value[0] : value;
        }
    }
    return null;
}

// The V2 event names this integration subscribes to. Anything else is ignored
// rather than treated as an error — ServiceTitan may add events to an app
// version without the handler knowing about them.
const EVENTS = {
    JOB_CREATED: 'job.created',
    JOB_UPDATED: 'job.updated',
    JOB_COMPLETED: 'job.completed',
    APPOINTMENT_CREATED: 'appointment.created',
    APPOINTMENT_UPDATED: 'appointment.updated',
    APPOINTMENT_RESCHEDULED: 'appointment.rescheduled',
    CUSTOMER_CREATED: 'customer.created',
    CUSTOMER_UPDATED: 'customer.updated',
    INVOICE_CREATED: 'invoice.created',
    INVOICE_UPDATED: 'invoice.updated',
};

module.exports = {
    SIGNATURE_HEADER,
    EVENTS,
    verifySignature,
    getSignatureFromHeaders,
};
