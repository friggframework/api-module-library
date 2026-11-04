const { verifyGhlSignature } = require('./signature-verifier');
const { findIntegrationByLocationId } = require('./lookup');

/**
 * HOP 1 — receiver (useDatabase:false). Runs on a fresh, DB-free integration instance.
 * GoHighLevel posts every location's events to one app-level URL, so we can't know (or look up)
 * the integration here — the receiver only verifies the signature and enqueues the raw body.
 * Fail-closed: reject unverified payloads with 401 and never enqueue them.
 */
async function onGhlWebhookReceived({ req, res }) {
    const body = req.body;
    if (!body || typeof body !== 'object') {
        res.status(400).json({ error: 'Invalid request body' });
        return;
    }

    // Prefer req.rawBody (exact signed bytes) when the host captured it.
    if (!verifyGhlSignature(req.headers, body, req.rawBody)) {
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    await this.queueWebhook({
        event: 'GHL_WEBHOOK_RESOLVE',
        body,
        receivedAt: new Date().toISOString(),
    });

    res.status(200).json({ received: true });
}

/**
 * HOP 2 — resolve (queue worker, DB available, no integrationId yet). Maps the payload's
 * locationId to the owning integration and re-enqueues bound to it. Skips (never throws) on a
 * missing/unknown/ambiguous locationId so a data problem can't DLQ-storm.
 */
async function onGhlWebhookResolve({ data }) {
    const { body } = data || {};
    const locationId = body?.locationId;
    if (!locationId) {
        console.warn(
            '[gohighlevel] webhook missing locationId; skipping resolve'
        );
        return { skipped: true, reason: 'no-location' };
    }

    let integrationId;
    try {
        integrationId = await findIntegrationByLocationId(this, locationId);
    } catch (error) {
        console.error(
            `[gohighlevel] ambiguous locationId ${locationId}; skipping: ${error.message}`
        );
        return { skipped: true, reason: 'ambiguous' };
    }

    if (!integrationId) {
        console.warn(
            `[gohighlevel] no integration for locationId ${locationId}; skipping`
        );
        return { skipped: true, reason: 'no-match' };
    }

    await this.queueWebhook({ event: 'GHL_WEBHOOK', integrationId, body });
    return { resolved: true, integrationId };
}

/**
 * HOP 3 — default no-op. Consumers override via binding.handlers.GHL_WEBHOOK.
 */
async function onGhlWebhook() {
    // no-op — override via binding.handlers.GHL_WEBHOOK
}

module.exports = { onGhlWebhookReceived, onGhlWebhookResolve, onGhlWebhook };
