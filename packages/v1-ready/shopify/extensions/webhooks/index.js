const {
    onShopifyWebhookReceived,
    onShopifyWebhookResolve,
    onShopifyWebhook,
} = require('./handlers');

/**
 * Shopify Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): SHOPIFY_WEBHOOK_RECEIVED verifies
 * the HMAC and enqueues a resolve job. The shop-domain → integration lookup
 * needs the DB, so it runs in the worker (SHOPIFY_WEBHOOK_RESOLVE), which
 * re-enqueues SHOPIFY_WEBHOOK bound to the resolved integration.
 *
 * Docs: https://shopify.dev/docs/apps/build/webhooks
 */
module.exports = {
    name: 'shopify-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'SHOPIFY_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        SHOPIFY_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onShopifyWebhookReceived,
        },
        SHOPIFY_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onShopifyWebhookResolve,
        },
        SHOPIFY_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onShopifyWebhook,
        },
    },
};
