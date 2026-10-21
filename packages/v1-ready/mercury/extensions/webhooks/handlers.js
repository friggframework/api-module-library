const { verifyMercurySignature } = require('./signature-verifier');
const { findIntegrationByExternalId } = require('./lookup');

function extractExternalId(req, body) {
    if (req && req.query && req.query.externalId) {
        return String(req.query.externalId);
    }
    if (body && body.externalId) return String(body.externalId);
    if (req && req.params && req.params.externalId) {
        return String(req.params.externalId);
    }
    return null;
}

/**
 * Receiver for `POST /webhooks` — DB-free.
 * Verifies Mercury-Signature, then enqueues MERCURY_WEBHOOK_RESOLVE.
 * Entity → integration lookup needs the DB, so it runs in the worker.
 */
async function onMercuryWebhookReceived({ req, res }) {
    const verification = verifyMercurySignature({
        req,
        secret: process.env.MERCURY_WEBHOOK_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[mercury-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = (req && req.body) || {};
    const externalId = extractExternalId(req, body);
    if (!externalId) {
        console.warn(
            '[mercury-webhooks] event missing externalId (pass ?externalId=<entityExternalId> on the webhook URL); skipping'
        );
        res.status(400).json({
            error: 'missing externalId',
            hint: 'Register the webhook URL with ?externalId=<mercury-entity-externalId>',
        });
        return;
    }

    await this.queueWebhook({
        event: 'MERCURY_WEBHOOK_RESOLVE',
        body: { ...body, externalId },
    });

    res.status(200).json({ received: true });
}

/**
 * MERCURY_WEBHOOK_RESOLVE — worker (DB available). Reverse-looks up
 * externalId → owning integration, then re-enqueues MERCURY_WEBHOOK.
 */
async function onMercuryWebhookResolve({ data }) {
    const body = data && data.body;
    const externalId = body && body.externalId;
    if (!externalId) {
        console.warn(
            '[mercury-webhooks] resolve: event missing externalId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByExternalId(this, externalId);
    if (!integrationId) {
        console.warn(
            `[mercury-webhooks] resolve: no integration for externalId=${externalId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'MERCURY_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * MERCURY_WEBHOOK — default no-op; consumers override via binding.handlers.
 */
async function onMercuryWebhook({ data }) {
    // no-op — override via binding.handlers.MERCURY_WEBHOOK
}

module.exports = {
    onMercuryWebhookReceived,
    onMercuryWebhookResolve,
    onMercuryWebhook,
    extractExternalId,
};
