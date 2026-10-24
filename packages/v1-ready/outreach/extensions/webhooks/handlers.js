const { verifyOutreachSignature } = require('./signature-verifier');
const { findIntegrationByExternalId } = require('./lookup');

/**
 * Receiver for POST /webhooks and POST /webhooks/:externalId — DB-free.
 * Verifies Outreach-Webhook-Signature, then enqueues OUTREACH_WEBHOOK_RESOLVE.
 *
 * Multi-tenant note: official payloads carry data + meta.eventName only (no org
 * id). Prefer registering a unique URL per install that includes :externalId.
 */
async function onOutreachWebhookReceived({ req, res }) {
    const secret =
        process.env.OUTREACH_WEBHOOK_SECRET ||
        (req.frigg && req.frigg.webhookSecret);
    const verification = verifyOutreachSignature({ req, secret });
    if (!verification.valid) {
        console.warn(
            `[outreach-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const externalId =
        (req.params && req.params.externalId) ||
        (req.body &&
            req.body.meta &&
            (req.body.meta.orgGuid ||
                req.body.meta.org_guid ||
                req.body.meta.orgUuid)) ||
        null;

    await this.queueWebhook({
        event: 'OUTREACH_WEBHOOK_RESOLVE',
        body: {
            externalId,
            payload: req.body,
            eventName:
                (req.body && req.body.meta && req.body.meta.eventName) || null,
        },
    });

    res.status(200).json({ received: 1, queued: 1 });
}

/**
 * OUTREACH_WEBHOOK_RESOLVE — worker hop with DB. Looks up the owning
 * integration by externalId, then re-enqueues OUTREACH_WEBHOOK bound to it.
 */
async function onOutreachWebhookResolve({ data }) {
    const body = data && data.body;
    const externalId = body && body.externalId;
    if (!externalId) {
        console.warn(
            '[outreach-webhooks] resolve: missing externalId; skipping ' +
                '(register per-install webhook URLs with :externalId)'
        );
        return;
    }

    const integrationId = await findIntegrationByExternalId(this, externalId);
    if (!integrationId) {
        console.warn(
            `[outreach-webhooks] resolve: no integration for externalId=${externalId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'OUTREACH_WEBHOOK',
        integrationId,
        body: body.payload,
    });
}

/**
 * Default OUTREACH_WEBHOOK handler — no-op. Consumers override via
 * binding.handlers.
 */
async function onOutreachWebhook() {
    // Intentionally empty — product integrations bind their own handler.
}

module.exports = {
    onOutreachWebhookReceived,
    onOutreachWebhookResolve,
    onOutreachWebhook,
};
