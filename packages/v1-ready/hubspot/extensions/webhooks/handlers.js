const { verifyHubSpotSignature } = require('./signature-verifier');
const { findIntegrationByPortalId } = require('./lookup');

/**
 * Receiver handler for `POST /webhooks`.
 *
 * Verifies HubSpot's v3 signature using `process.env.HUBSPOT_CLIENT_SECRET`
 * (the same env var the api-module already reads for OAuth), iterates the
 * inbound batch, resolves each event's `portalId` to a Frigg integration via
 * the platform-neutral reverse lookup, and enqueues a per-event
 * `HUBSPOT_WEBHOOK` job for the matched integration. Events whose portal
 * does not map to any integration are silently skipped (HubSpot sends events
 * for the whole app, not per-account).
 *
 * Per the Tier 3 contract, this function is bound as a plain function on the
 * integration instance — `this` is the IntegrationBase instance and exposes
 * `commands.findIntegrationByEntityExternalId` and `queueWebhook`.
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

    // Phase 1 — resolve every portalId in parallel before queueing anything.
    // Two reasons for two-phase: (a) HubSpot batches can be large and each
    // lookup is an independent DB round-trip; running them serially blows
    // the HubSpot response budget; (b) if any lookup is ambiguous, the core
    // command throws by design — we want that throw to land BEFORE any
    // queueWebhook fires so we never leave the batch in a partial-enqueue
    // state that HubSpot's retry would then duplicate.
    const resolutions = await Promise.all(
        events.map(async (evt, i) => {
            const portalId = evt && evt.portalId;
            if (portalId === undefined || portalId === null) {
                console.warn(
                    `[hubspot-webhooks] event[${i}] missing portalId ` +
                        `(subscriptionType=${evt && evt.subscriptionType}); skipping`
                );
                return null;
            }
            const integrationId = await findIntegrationByPortalId(
                this,
                portalId
            );
            if (!integrationId) return null;
            return { integrationId, evt };
        })
    );

    // Phase 2 — enqueue matched events in parallel. Every match resolved
    // cleanly above, so any failure here is genuinely SQS-side and should
    // surface to HubSpot for retry.
    const matches = resolutions.filter(Boolean);
    await Promise.all(
        matches.map(({ integrationId, evt }) =>
            this.queueWebhook({
                integrationId,
                body: evt,
                event: 'HUBSPOT_WEBHOOK',
            })
        )
    );

    res.status(200).json({
        received: events.length,
        queued: matches.length,
        skipped: events.length - matches.length,
    });
}

/**
 * Default per-event handler. Integration consumers override this via
 * `binding.handlers.HUBSPOT_WEBHOOK = 'methodName'`; the default is a no-op
 * so a misconfigured binding fails predictably rather than crashing the
 * queue worker.
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
    onHubSpotWebhook,
};
