const {
    onShopmonkeyWebhookReceived,
    onShopmonkeyWebhookResolve,
    onShopmonkeyWebhook,
} = require('./handlers');

/**
 * Shopmonkey Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): SHOPMONKEY_WEBHOOK_RECEIVED verifies
 * the Webhook Standard HMAC (webhook-id / webhook-timestamp / webhook-signature)
 * when SHOPMONKEY_WEBHOOK_SECRET is set, then enqueues resolve. Company/user →
 * integration lookup needs the DB, so it runs in the worker
 * (SHOPMONKEY_WEBHOOK_RESOLVE), which re-enqueues SHOPMONKEY_WEBHOOK bound to
 * the resolved integration. Consumers override SHOPMONKEY_WEBHOOK via
 * binding.handlers.
 *
 * Subscriptions: POST/PUT/DELETE /v3/webhook (see Api.createWebhook).
 * Docs: https://shopmonkey.dev/webhooks
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'shopmonkey-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'SHOPMONKEY_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        SHOPMONKEY_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onShopmonkeyWebhookReceived,
        },
        SHOPMONKEY_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onShopmonkeyWebhookResolve,
        },
        SHOPMONKEY_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onShopmonkeyWebhook,
        },
    },
};
