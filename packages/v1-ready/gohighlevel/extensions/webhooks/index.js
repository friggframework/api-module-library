const {
    onGhlWebhookReceived,
    onGhlWebhookResolve,
    onGhlWebhook,
} = require('./handlers');

/**
 * GoHighLevel application-level webhook extension (Tier-3 Integration Extension).
 *
 * One URL is registered once in the GHL Marketplace app and serves every connected
 * location. Three hops: GHL_WEBHOOK_RECEIVED (DB-free receiver — verify signature,
 * enqueue) → GHL_WEBHOOK_RESOLVE (worker — locationId → integrationId, re-enqueue) →
 * GHL_WEBHOOK (hydrated integration — override via binding.handlers).
 *
 * HubSpot-shaped (see packages/v1-ready/hubspot/extensions/webhooks/).
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 *
 * Marketplace webhooks are configured in the app UI (not via REST subscription CRUD).
 * @see https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide
 */
module.exports = {
    name: 'gohighlevel-webhooks',
    useDatabase: false,
    routes: [
        { path: '/webhooks', method: 'POST', event: 'GHL_WEBHOOK_RECEIVED' },
    ],
    events: {
        GHL_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGhlWebhookReceived,
        },
        GHL_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGhlWebhookResolve,
        },
        GHL_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGhlWebhook,
        },
    },
};
