const {
    onHubSpotWebhookReceived,
    onHubSpotWebhookResolve,
    onHubSpotWebhook,
} = require('./handlers');

/**
 * HubSpot Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): HUBSPOT_WEBHOOK_RECEIVED verifies the
 * v3 signature and enqueues a resolve job. The portal→integration lookup needs
 * the DB, so it runs in the worker (HUBSPOT_WEBHOOK_RESOLVE), which re-enqueues
 * HUBSPOT_WEBHOOK bound to the resolved integration. Consumers override
 * HUBSPOT_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
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
