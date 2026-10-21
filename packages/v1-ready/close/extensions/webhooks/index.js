const {
    onCloseWebhookReceived,
    onCloseWebhookResolve,
    onCloseWebhook,
} = require('./handlers');

/**
 * Close Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): CLOSE_WEBHOOK_RECEIVED verifies
 * close-sig-hash (HMAC-SHA256 over timestamp+body with hex signature_key from
 * createWebhook), then enqueues CLOSE_WEBHOOK_RESOLVE. Organization /
 * subscription → integration lookup needs the DB, so it runs in the worker,
 * which re-enqueues CLOSE_WEBHOOK bound to the resolved integration.
 * Consumers override CLOSE_WEBHOOK via binding.handlers.
 *
 * Pattern mirrors packages/v1-ready/hubspot/extensions/webhooks/.
 *
 * Docs: https://developer.close.com/api/resources/webhooks.md
 */
module.exports = {
    name: 'close-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'CLOSE_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        CLOSE_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onCloseWebhookReceived,
        },
        CLOSE_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onCloseWebhookResolve,
        },
        CLOSE_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onCloseWebhook,
        },
    },
};
