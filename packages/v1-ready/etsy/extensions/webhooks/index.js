const {
    onEtsyWebhookReceived,
    onEtsyWebhookResolve,
    onEtsyWebhook,
} = require('./handlers');

/**
 * Etsy Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): ETSY_WEBHOOK_RECEIVED verifies
 * webhook-id / webhook-timestamp / webhook-signature (HMAC-SHA256 over
 * id.timestamp.body with the portal `whsec_` secret), then enqueues
 * ETSY_WEBHOOK_RESOLVE. shop_id → integration lookup needs the DB, so it
 * runs in the worker, which re-enqueues ETSY_WEBHOOK bound to the resolved
 * integration. Consumers override ETSY_WEBHOOK via binding.handlers.
 *
 * Subscription management is portal-only (no Open API webhook CRUD).
 *
 * Pattern mirrors packages/v1-ready/hubspot/extensions/webhooks/.
 *
 * Docs: https://developers.etsy.com/documentation/essentials/webhooks
 */
module.exports = {
    name: 'etsy-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'ETSY_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        ETSY_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onEtsyWebhookReceived,
        },
        ETSY_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onEtsyWebhookResolve,
        },
        ETSY_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onEtsyWebhook,
        },
    },
};
