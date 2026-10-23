const crypto = require('crypto');

// Max accepted age of an inbound GHL webhook (ISO timestamp in payload) — bounds replay.
const GHL_WEBHOOK_MAX_SKEW_SECONDS = 300;

/**
 * Official GHL Ed25519 public key for X-GHL-Signature (Webhook Integration Guide).
 * Prefer env GOHIGHLEVEL_WEBHOOK_PUBLIC_KEY_ED25519 when set (allows key rotation).
 * @see https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide
 */
const DEFAULT_GHL_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

/**
 * Verify the inbound GoHighLevel webhook signature, fail-closed.
 * GHL signs the request body with Ed25519 and sends the base64 signature in the
 * X-GHL-Signature header. Legacy X-WH-Signature (RSA-SHA256) is deprecated and
 * intentionally not supported here.
 *
 * Prefer rawBody (unparsed request bytes). When absent, fall back to
 * JSON.stringify(body) (matches GHL signed bytes on live deliveries when the
 * host re-serializes equivalently).
 */
function verifyGhlSignature(headers, body, rawBody) {
    const payloadTs = body?.timestamp;
    if (!payloadTs) {
        console.warn(
            '[gohighlevel] Missing timestamp in webhook payload; rejecting'
        );
        return false;
    }
    const ageSeconds = (Date.now() - new Date(payloadTs).getTime()) / 1000;
    if (
        !Number.isFinite(ageSeconds) ||
        Math.abs(ageSeconds) > GHL_WEBHOOK_MAX_SKEW_SECONDS
    ) {
        console.warn(
            `[gohighlevel] Webhook timestamp outside ${GHL_WEBHOOK_MAX_SKEW_SECONDS}s skew window; rejecting`
        );
        return false;
    }

    const ed25519Sig = headers?.['x-ghl-signature'];
    if (!ed25519Sig) {
        console.warn('[gohighlevel] No X-GHL-Signature header; rejecting');
        return false;
    }

    const key = (
        process.env.GOHIGHLEVEL_WEBHOOK_PUBLIC_KEY_ED25519 ||
        DEFAULT_GHL_ED25519_PUBLIC_KEY
    ).replace(/\\n/g, '\n');
    if (!key) {
        console.warn(
            '[gohighlevel] X-GHL-Signature present but no Ed25519 public key available; rejecting'
        );
        return false;
    }

    const signedBytes =
        typeof rawBody === 'string' && rawBody.length > 0
            ? rawBody
            : JSON.stringify(body);

    try {
        return crypto.verify(
            null,
            Buffer.from(signedBytes),
            key,
            Buffer.from(ed25519Sig, 'base64')
        );
    } catch (error) {
        console.warn(
            '[gohighlevel] Ed25519 signature verification error:',
            error.message
        );
        return false;
    }
}

module.exports = { verifyGhlSignature, GHL_WEBHOOK_MAX_SKEW_SECONDS };
