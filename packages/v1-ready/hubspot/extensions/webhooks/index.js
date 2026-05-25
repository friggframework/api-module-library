const {
    onHubSpotWebhookReceived,
    onHubSpotWebhook,
} = require('./handlers');

/**
 * HubSpot Webhooks — Tier 3 Integration Extension bundle.
 *
 * Contributes a single receiver route (`POST /webhooks`) plus two events:
 *
 *   HUBSPOT_WEBHOOK_RECEIVED  — bound to the route; verifies signature,
 *                                resolves portalId → integrationId, queues
 *                                one HUBSPOT_WEBHOOK per matched event.
 *   HUBSPOT_WEBHOOK           — default no-op; integrations override via
 *                                `binding.handlers.HUBSPOT_WEBHOOK`.
 *
 * See the binding contract at:
 * https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'hubspot-webhooks',
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
        HUBSPOT_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHubSpotWebhook,
        },
    },
};
