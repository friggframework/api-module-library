const { verifyHubSpotSignature } = require('./signature-verifier');
const { findIntegrationByPortalId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the v3 signature, then
 * enqueues one HUBSPOT_WEBHOOK_RESOLVE per event (carrying the raw payload incl.
 * portalId). It does NOT resolve the owning integration — that needs the DB and
 * happens in the worker, which is what lets the extension declare
 * useDatabase: false. Events missing a portalId are skipped.
 */
async function onHubSpotWebhookReceived({ req, res }) {
    const verification = verifyHubSpotSignature({
        req,
        clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[hubspot-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const events = Array.isArray(req.body) ? req.body : [];

    // Parallel: each is an independent SQS send and HubSpot batches can be large.
    const outcomes = await Promise.all(
        events.map(async (evt, i) => {
            const portalId = evt && evt.portalId;
            if (portalId === undefined || portalId === null) {
                console.warn(
                    `[hubspot-webhooks] event[${i}] missing portalId ` +
                        `(subscriptionType=${evt && evt.subscriptionType}); skipping`
                );
                return 'skipped';
            }
            await this.queueWebhook({
                event: 'HUBSPOT_WEBHOOK_RESOLVE',
                body: evt,
            });
            return 'queued';
        })
    );

    const queued = outcomes.filter((o) => o === 'queued').length;
    res.status(200).json({
        received: events.length,
        queued,
        skipped: events.length - queued,
    });
}

/**
 * HUBSPOT_WEBHOOK_RESOLVE — runs in the queue worker (DB available) on a dry
 * integration instance. Reverse-looks up portalId → owning integration, then
 * re-enqueues HUBSPOT_WEBHOOK bound to that id (the worker hydrates the real
 * record on that hop). Keeping the lookup here is what lets the receiver stay
 * DB-free. Ambiguous resolution propagates rather than risk cross-tenant misrouting.
 */
async function onHubSpotWebhookResolve({ data }) {
    const body = data && data.body;
    const portalId = body && body.portalId;
    if (portalId === undefined || portalId === null) {
        console.warn(
            '[hubspot-webhooks] resolve: event missing portalId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByPortalId(this, portalId);
    if (!integrationId) {
        console.warn(
            `[hubspot-webhooks] resolve: no integration for portalId=${portalId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'HUBSPOT_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * HUBSPOT_WEBHOOK — runs in the worker with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.HUBSPOT_WEBHOOK.
 */
async function onHubSpotWebhook({ data }) {
    // no-op — override via binding.handlers.HUBSPOT_WEBHOOK
}

module.exports = {
    onHubSpotWebhookReceived,
    onHubSpotWebhookResolve,
    onHubSpotWebhook,
};
