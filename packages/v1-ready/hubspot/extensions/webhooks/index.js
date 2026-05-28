const {
    onHubSpotWebhookReceived,
    onHubSpotWebhookResolve,
    onHubSpotWebhook,
} = require('./handlers');

/**
 * HubSpot Webhooks — Tier 3 Integration Extension bundle.
 *
 * `useDatabase: false` — the receiver route is DB-free (verify signature +
 * enqueue only). The portal→integration lookup happens in the worker.
 *
 * Contributes one receiver route (`POST /webhooks`) plus three events:
 *
 *   HUBSPOT_WEBHOOK_RECEIVED  — bound to the route (DB-free). Verifies the v3
 *                                signature and enqueues one
 *                                HUBSPOT_WEBHOOK_RESOLVE per event.
 *   HUBSPOT_WEBHOOK_RESOLVE   — queue event (worker, DB). Reverse-looks up
 *                                portalId → integrationId and re-enqueues a
 *                                HUBSPOT_WEBHOOK bound to that integration.
 *   HUBSPOT_WEBHOOK           — queue event (worker, hydrated). Default no-op;
 *                                integrations override via
 *                                `binding.handlers.HUBSPOT_WEBHOOK`.
 *
 * Routes are namespaced under the binding key by the framework, so the live
 * URL is `/api/{integration}-integration/{bindingKey}/webhooks`.
 *
 * See the binding contract at:
 * https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'hubspot-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'HUBSPOT_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        HUBSPOT_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHubSpotWebhookReceived,
        },
        HUBSPOT_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHubSpotWebhookResolve,
        },
        HUBSPOT_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHubSpotWebhook,
        },
    },
};
