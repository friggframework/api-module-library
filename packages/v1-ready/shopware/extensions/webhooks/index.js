const {
    onShopWareWebhookReceived,
    onShopWareWebhookResolve,
    onShopWareWebhook,
} = require('./handlers');

/**
 * Shop-Ware Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): SHOPWARE_WEBHOOK_RECEIVED verifies
 * the X-Api-Secret header and enqueues a resolve job. The tenant→integration
 * lookup needs the DB, so it runs in the worker (SHOPWARE_WEBHOOK_RESOLVE),
 * which re-enqueues SHOPWARE_WEBHOOK bound to the resolved integration.
 * Consumers override SHOPWARE_WEBHOOK via binding.handlers.
 *
 * Pattern: packages/v1-ready/hubspot/extensions/webhooks/
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'shopware-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'SHOPWARE_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        SHOPWARE_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onShopWareWebhookReceived,
        },
        SHOPWARE_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onShopWareWebhookResolve,
        },
        SHOPWARE_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onShopWareWebhook,
        },
    },
};
