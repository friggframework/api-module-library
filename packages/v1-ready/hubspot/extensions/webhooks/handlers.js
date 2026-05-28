const { verifyHubSpotSignature } = require('./signature-verifier');
const { findIntegrationByPortalId } = require('./lookup');

/**
 * Receiver handler for `POST /webhooks` — **DB-free**.
 *
 * HubSpot webhooks are app-level: one URL receives events for every connected
 * portal. This receiver does the minimum that requires no database: verify the
 * v3 signature, then enqueue one `HUBSPOT_WEBHOOK_RESOLVE` job per event,
 * carrying the raw payload (which includes `portalId`). It deliberately does
 * NOT look up the owning integration — that needs the database and happens in
 * the worker (see `onHubSpotWebhookResolve`). This keeps the public HTTP
 * endpoint cheap and lets the extension declare `useDatabase: false`.
 *
 * Events missing a `portalId` are skipped (nothing to resolve later).
 *
 * @this {import('@friggframework/core').IntegrationBase}
 * @param {Object} args
 * @param {import('express').Request} args.req
 * @param {import('express').Response} args.res
 * @returns {Promise<void>}
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

    // Enqueue in parallel — each is an independent SQS send; HubSpot batches
    // can be large and the response budget is tight.
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
 * Resolve handler for `HUBSPOT_WEBHOOK_RESOLVE` — runs in the **queue worker**,
 * where the database is available, on a dry integration instance (no record
 * loaded yet). Reverse-looks up the event's `portalId` to the owning Frigg
 * integration, then re-enqueues a `HUBSPOT_WEBHOOK` job bound to that
 * integration id. The worker hydrates the real integration record on that
 * second hop and dispatches the consumer's bound handler with the correct
 * per-account context.
 *
 * This indirection is what lets the receiver stay DB-free: the only step that
 * needs the database (the portal lookup) is here, in the worker.
 *
 * Ambiguous resolution propagates (the core command throws) so a cross-tenant
 * routing risk surfaces loudly rather than silently misrouting.
 *
 * @this {import('@friggframework/core').IntegrationBase}
 * @param {Object} args
 * @param {Object} args.data - The queued payload; `data.body` is the raw HubSpot event.
 * @returns {Promise<void>}
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
 * Default per-event handler for `HUBSPOT_WEBHOOK`. Runs in the worker with the
 * owning integration hydrated. Integration consumers override this via
 * `binding.handlers.HUBSPOT_WEBHOOK = 'methodName'`; the default is a no-op so
 * a misconfigured binding fails predictably rather than crashing the worker.
 *
 * @this {import('@friggframework/core').IntegrationBase}
 * @param {Object} args
 * @param {Object} args.data
 * @returns {Promise<void>}
 */
async function onHubSpotWebhook({ data }) {
    // intentional no-op — override via binding.handlers.HUBSPOT_WEBHOOK
}

module.exports = {
    onHubSpotWebhookReceived,
    onHubSpotWebhookResolve,
    onHubSpotWebhook,
};
