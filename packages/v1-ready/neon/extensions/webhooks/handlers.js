const { verifyNeonWebhook } = require('./signature-verifier');
const { findIntegrationByOrganizationId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Optionally verifies inbound Basic
 * auth, then enqueues NEON_WEBHOOK_RESOLVE.
 *
 * Payload shape (official):
 *   { eventTrigger, eventTimestamp, organizationId, data, customParameters? }
 * @see https://developer.neoncrm.com/webhooks/
 */
async function onNeonWebhookReceived({ req, res }) {
    const verification = verifyNeonWebhook({ req });
    if (!verification.valid) {
        console.warn(
            `[neon-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'unauthorized' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    // form-urlencoded deliveries wrap JSON in a `payload` field
    const event =
        typeof body.payload === 'string'
            ? safeJsonParse(body.payload) || body
            : body;

    const organizationId = event.organizationId || event.organization_id;
    if (!organizationId) {
        console.warn(
            '[neon-webhooks] event missing organizationId; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'NEON_WEBHOOK_RESOLVE',
        body: event,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * NEON_WEBHOOK_RESOLVE — queue worker (DB available). Looks up organizationId
 * → owning integration, then re-enqueues NEON_WEBHOOK bound to that id.
 */
async function onNeonWebhookResolve({ data }) {
    const body = data && data.body;
    if (!body) {
        console.warn('[neon-webhooks] resolve: missing body; skipping');
        return;
    }

    const organizationId = body.organizationId || body.organization_id;
    const integrationId = await findIntegrationByOrganizationId(
        this,
        organizationId
    );

    if (!integrationId) {
        console.warn(
            `[neon-webhooks] resolve: no integration for organizationId=${organizationId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'NEON_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * NEON_WEBHOOK — worker with owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.NEON_WEBHOOK.
 */
async function onNeonWebhook({ data }) {
    // no-op — override via binding.handlers.NEON_WEBHOOK
}

function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    } catch (_e) {
        return null;
    }
}

module.exports = {
    onNeonWebhookReceived,
    onNeonWebhookResolve,
    onNeonWebhook,
};
