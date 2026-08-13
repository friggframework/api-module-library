const crypto = require('crypto');

// Podium does not publish a webhook signing scheme, and its docs describe the
// partner webhook URL as something Podium configures on your behalf rather than
// something you register yourself. Rather than invent an HMAC scheme that would
// look like security while verifying nothing, this module protects the inbound
// endpoint with a high-entropy token carried in the URL path.
//
// That is a real control — an attacker who does not hold the token cannot reach
// the handler — and it is the standard fallback for providers without signing.
// Replace it with signature verification once Podium confirms one.

// Constant-time comparison over fixed-width digests, so neither the token's
// value nor its length leaks through timing.
function verifyPathToken(provided, expected) {
    if (!expected) {
        throw new Error(
            'A Podium webhook path token is required. Generate one with generatePathToken() and store it with the integration.'
        );
    }
    if (!provided) return false;

    const digestA = crypto.createHash('sha256').update(String(provided)).digest();
    const digestB = crypto.createHash('sha256').update(String(expected)).digest();
    return crypto.timingSafeEqual(digestA, digestB);
}

function generatePathToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Message event types delivered by Podium's message webhook.
const EVENTS = {
    MESSAGE_SENT: 'message.sent',
    MESSAGE_RECEIVED: 'message.received',
    MESSAGE_FAILED: 'message.failed',
};

// Podium's payloads carry `contact` and `sender` objects that its own docs mark
// as deprecated and slated for removal. Read identity from the channel and
// conversation fields instead, so the integration does not break when they go.
function normalizeMessageEvent(payload = {}) {
    const channel = payload.channel || {};
    return {
        eventType: payload.type || payload.event || null,
        conversationUid: payload.conversationUid || payload.conversation?.uid || null,
        locationUid: payload.locationUid || null,
        organizationUid: payload.organizationUid || null,
        channelType: channel.type || null,
        identifier: channel.identifier || null,
        body: payload.body ?? null,
        createdAt: payload.createdAt || null,
        failureReason: payload.failureReason || null,
        // Direction matters for conversation writeback: only inbound messages
        // and business replies are worth writing to ServiceTitan, and an
        // outbound message we ourselves just sent must not loop back in.
        direction:
            payload.type === EVENTS.MESSAGE_RECEIVED
                ? 'inbound'
                : payload.type === EVENTS.MESSAGE_SENT
                  ? 'outbound'
                  : null,
    };
}

module.exports = {
    EVENTS,
    verifyPathToken,
    generatePathToken,
    normalizeMessageEvent,
};
