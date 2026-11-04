const {
    onChargebeeWebhookReceived,
    onChargebeeWebhookResolve,
    onChargebeeWebhook,
} = require('./handlers');

/**
 * Chargebee Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): verifies inbound Basic Auth, then
 * enqueues CHARGEBEE_WEBHOOK_RESOLVE. Site→integration lookup needs the DB, so
 * it runs in the worker, which re-enqueues CHARGEBEE_WEBHOOK bound to the
 * resolved integration. Consumers override CHARGEBEE_WEBHOOK via
 * binding.handlers.
 *
 * Chargebee webhook subscription CRUD is on the REST API
 * (`Api.createWebhookEndpoint` etc.). Inbound auth is Basic Auth only — no HMAC
 * (confirmed in Chargebee docs). Register URLs with `?site=<subdomain>`.
 *
 * Shaped after packages/v1-ready/hubspot/extensions/webhooks/.
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'chargebee-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'CHARGEBEE_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        CHARGEBEE_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onChargebeeWebhookReceived,
        },
        CHARGEBEE_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onChargebeeWebhookResolve,
        },
        CHARGEBEE_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onChargebeeWebhook,
        },
    },
};
