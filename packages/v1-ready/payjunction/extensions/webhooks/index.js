const {
    onPayJunctionWebhookReceived,
    onPayJunctionWebhookResolve,
    onPayJunctionWebhook,
} = require('./handlers');

/**
 * PayJunction Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): PAYJUNCTION_WEBHOOK_RECEIVED verifies
 * X-Pj-Signature (HMAC-SHA256 of the JSON body with the subscription secret),
 * then enqueues PAYJUNCTION_WEBHOOK_RESOLVE. Pj-Merchant → integration lookup
 * needs the DB, so it runs in the worker, which re-enqueues PAYJUNCTION_WEBHOOK
 * bound to the resolved integration. Consumers override PAYJUNCTION_WEBHOOK via
 * binding.handlers.
 *
 * Pattern mirrors packages/v1-ready/hubspot/extensions/webhooks/.
 *
 * Docs:
 *   https://developer.payjunction.com/hc/en-us/articles/115004486287-Available-Webhooks
 *   https://developer.payjunction.com/hc/en-us/articles/219970868-Securing-Your-Webhooks
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'payjunction-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'PAYJUNCTION_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        PAYJUNCTION_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPayJunctionWebhookReceived,
        },
        PAYJUNCTION_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPayJunctionWebhookResolve,
        },
        PAYJUNCTION_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPayJunctionWebhook,
        },
    },
};
