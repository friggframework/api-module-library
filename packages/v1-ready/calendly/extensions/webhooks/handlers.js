const { verifyCalendlySignature } = require('./signature-verifier');
const { findIntegrationByUserUri } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies Calendly-Webhook-Signature,
 * then enqueues one CALENDLY_WEBHOOK_RESOLVE carrying the raw payload
 * (incl. created_by). It does NOT resolve the owning integration — that needs
 * the DB and happens in the worker.
 */
async function onCalendlyWebhookReceived({ req, res }) {
    const verification = verifyCalendlySignature({
        req,
        signingKey: process.env.CALENDLY_WEBHOOK_SIGNING_KEY,
    });
    if (!verification.valid) {
        console.warn(
            `[calendly-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const createdBy = body.created_by;
    if (!createdBy) {
        console.warn(
            '[calendly-webhooks] event missing created_by; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'CALENDLY_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * CALENDLY_WEBHOOK_RESOLVE — runs in the queue worker (DB available).
 * Reverse-looks up created_by (user URI) → owning integration, then
 * re-enqueues CALENDLY_WEBHOOK bound to that id.
 */
async function onCalendlyWebhookResolve({ data }) {
    const body = data && data.body;
    const createdBy = body && body.created_by;
    if (!createdBy) {
        console.warn(
            '[calendly-webhooks] resolve: event missing created_by; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByUserUri(this, createdBy);
    if (!integrationId) {
        console.warn(
            `[calendly-webhooks] resolve: no integration for created_by=${createdBy}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'CALENDLY_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * CALENDLY_WEBHOOK — runs in the worker with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.CALENDLY_WEBHOOK.
 */
async function onCalendlyWebhook({ data }) {
    // no-op — override via binding.handlers.CALENDLY_WEBHOOK
}

module.exports = {
    onCalendlyWebhookReceived,
    onCalendlyWebhookResolve,
    onCalendlyWebhook,
};
