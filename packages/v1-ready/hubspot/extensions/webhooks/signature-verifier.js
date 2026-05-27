const crypto = require('crypto');

const SIGNATURE_HEADER = 'x-hubspot-signature-v3';
const TIMESTAMP_HEADER = 'x-hubspot-request-timestamp';
// HubSpot's documented skew window: reject if older than 5 minutes.
const MAX_TIMESTAMP_SKEW_MS = 5 * 60 * 1000;

/**
 * Read a header value case-insensitively from a request-like object.
 * Express normalises header keys to lowercase, but extension authors may
 * hand us raw objects in tests; tolerate both.
 *
 * @param {Object} headers - The headers map from the incoming request.
 * @param {string} name - The header name (any case).
 * @returns {string|undefined} The header value, or undefined.
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
 * Reconstruct the request body string as it left HubSpot's servers.
 * If middleware preserved the raw body bytes (req.rawBody), use those —
 * any whitespace or key ordering tweak from JSON.parse → JSON.stringify
 * will break the HMAC. Otherwise fall back to JSON.stringify(parsed body),
 * which matches HubSpot's own Node.js sample.
 *
 * @param {import('express').Request|Object} req - The Express request.
 * @returns {string} The body string to feed into the HMAC.
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
 * Reconstruct the full request URL HubSpot signed.
 *
 * HubSpot signs `https://<host><originalUrl>` — protocol, host, path, and
 * query string. Behind a load balancer Express sees `http`, so we honour
 * `X-Forwarded-Proto` and `X-Forwarded-Host` when present. Callers can
 * also set `HUBSPOT_WEBHOOK_BASE_URL` to override entirely (useful for
 * tunnels or custom domains).
 *
 * @param {import('express').Request|Object} req - The Express request.
 * @returns {string} The fully-qualified URL string to feed into the HMAC.
 */
function reconstructUrl(req) {
    const override = process.env.HUBSPOT_WEBHOOK_BASE_URL;
    if (override) {
        const trimmed = override.replace(/\/$/, '');
        return `${trimmed}${req.originalUrl || req.url || ''}`;
    }
    const forwardedProto = getHeader(req.headers, 'x-forwarded-proto');
    const proto =
        (forwardedProto && forwardedProto.split(',')[0].trim()) ||
        req.protocol ||
        'https';
    const forwardedHost = getHeader(req.headers, 'x-forwarded-host');
    const host =
        (forwardedHost && forwardedHost.split(',')[0].trim()) ||
        getHeader(req.headers, 'host') ||
        '';
    const path = req.originalUrl || req.url || '';
    return `${proto}://${host}${path}`;
}

/**
 * Validate that two base64 signatures are equal in constant time.
 *
 * Decodes both into Buffers so timingSafeEqual sees same-length inputs.
 * Returns false on any decode/length mismatch.
 *
 * @param {string} expected - The signature we computed.
 * @param {string} provided - The signature HubSpot sent.
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
 * Verify a HubSpot v3 webhook signature against the configured client secret.
 *
 * Algorithm (per HubSpot docs):
 *   message   = method + uri + body + timestamp
 *   signature = base64(HMAC-SHA256(client_secret, utf8(message)))
 *
 * Returns a structured result instead of throwing so the receiver can map
 * different failures to the right log line and HTTP status. Never throws
 * for normal "untrusted request" cases.
 *
 * @param {Object} args
 * @param {import('express').Request|Object} args.req - The Express request.
 * @param {string} args.clientSecret - The HubSpot app's client secret.
 * @param {number} [args.maxSkewMs=300000] - Allowed timestamp skew in milliseconds.
 * @param {Function} [args.now=Date.now] - Clock source for tests.
 * @returns {{ valid: boolean, reason?: string }}
 */
function verifyHubSpotSignature({
    req,
    clientSecret,
    maxSkewMs = MAX_TIMESTAMP_SKEW_MS,
    now = Date.now,
}) {
    if (!clientSecret || typeof clientSecret !== 'string') {
        return { valid: false, reason: 'missing client secret' };
    }
    if (!req || typeof req !== 'object') {
        return { valid: false, reason: 'missing request' };
    }

    const headers = req.headers || {};
    const signature = getHeader(headers, SIGNATURE_HEADER);
    const timestamp = getHeader(headers, TIMESTAMP_HEADER);

    if (!signature) {
        return { valid: false, reason: `missing ${SIGNATURE_HEADER} header` };
    }
    if (!timestamp) {
        return { valid: false, reason: `missing ${TIMESTAMP_HEADER} header` };
    }

    const tsNumber = Number(timestamp);
    if (!Number.isFinite(tsNumber)) {
        return { valid: false, reason: 'malformed timestamp header' };
    }
    const skew = Math.abs(now() - tsNumber);
    if (skew > maxSkewMs) {
        return {
            valid: false,
            reason: `timestamp skew ${skew}ms exceeds max ${maxSkewMs}ms`,
        };
    }

    const method = (req.method || 'POST').toUpperCase();
    const uri = reconstructUrl(req);
    const body = extractBodyString(req);
    const message = `${method}${uri}${body}${timestamp}`;

    const expected = crypto
        .createHmac('sha256', clientSecret)
        .update(message, 'utf8')
        .digest('base64');

    if (!safeCompare(expected, signature)) {
        return { valid: false, reason: 'signature mismatch' };
    }
    return { valid: true };
}

module.exports = {
    verifyHubSpotSignature,
    extractBodyString,
    reconstructUrl,
    safeCompare,
    SIGNATURE_HEADER,
    TIMESTAMP_HEADER,
    MAX_TIMESTAMP_SKEW_MS,
};
