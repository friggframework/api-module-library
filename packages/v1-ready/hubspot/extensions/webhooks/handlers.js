const { verifyHubSpotSignature } = require('./signature-verifier');
const { findIntegrationByPortalId } = require('./lookup');

const EVENT_NAME_DISPATCH = 'HUBSPOT_WEBHOOK';

/**
 * Resolve the HubSpot app client secret used to sign webhook payloads.
 *
 * Precedence:
 *   1. Definition.env.client_secret on the integration class (preferred — same
 *      env block the api-module already reads for OAuth)
 *   2. process.env.HUBSPOT_CLIENT_SECRET (escape hatch when extensions are
 *      used outside a full integration class context, e.g. tests)
 *
 * @param {Object} integration - The IntegrationBase instance running the handler.
 * @returns {string|undefined} The client secret, or undefined if neither source has it.
 */
function resolveClientSecret(integration) {
    const fromDefinition =
        integration &&
        integration.constructor &&
        integration.constructor.Definition &&
        integration.constructor.Definition.modules &&
        Object.values(integration.constructor.Definition.modules)
            .map((m) => m && m.definition && m.definition.env)
            .find((env) => env && env.client_secret);
    return fromDefinition?.client_secret || process.env.HUBSPOT_CLIENT_SECRET;
}

/**
 * Receiver handler for `POST /webhooks`.
 *
 * Verifies HubSpot's v3 signature, iterates the inbound batch, resolves each
 * event's `portalId` to a Frigg integration via the platform-neutral reverse
 * lookup, and enqueues a per-event `HUBSPOT_WEBHOOK` job for the matched
 * integration. Events whose portal does not map to any integration are
 * silently skipped (HubSpot sends events for the whole app, not per-account).
 *
 * Per the Tier 3 contract, this function is bound as a plain function on the
 * integration instance — `this` is the IntegrationBase instance and exposes
 * `findIntegrationByEntityExternalId` and `queueWebhook`.
 *
 * @this {import('@friggframework/core').IntegrationBase}
 * @param {Object} args
 * @param {import('express').Request} args.req
 * @param {import('express').Response} args.res
 * @returns {Promise<void>}
 */
async function onHubSpotWebhookReceived({ req, res }) {
    const clientSecret = resolveClientSecret(this);
    const verification = verifyHubSpotSignature({ req, clientSecret });
    if (!verification.valid) {
        console.warn(
            `[hubspot-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const events = Array.isArray(req.body) ? req.body : [];
    if (events.length === 0) {
        res.status(200).json({ received: 0, queued: 0 });
        return;
    }

    let queued = 0;
    let skipped = 0;
    for (let i = 0; i < events.length; i++) {
        const evt = events[i];
        const portalId = evt && evt.portalId;
        const subscriptionType = evt && evt.subscriptionType;
        if (portalId === undefined || portalId === null) {
            console.warn(
                `[hubspot-webhooks] event[${i}] missing portalId (subscriptionType=${subscriptionType}); skipping`
            );
            skipped++;
            continue;
        }

        // Intentionally do not catch — ambiguous resolution is a cross-tenant
        // routing risk and the core helper throws by design.
        const integrationId = await findIntegrationByPortalId(this, portalId);
        if (!integrationId) {
            skipped++;
            continue;
        }

        await this.queueWebhook({
            integrationId,
            body: evt,
            event: EVENT_NAME_DISPATCH,
        });
        queued++;
    }

    res.status(200).json({
        received: events.length,
        queued,
        skipped,
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
    resolveClientSecret,
    EVENT_NAME_DISPATCH,
};
