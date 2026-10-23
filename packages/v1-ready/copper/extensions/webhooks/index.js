const {
    onCopperWebhookReceived,
    onCopperWebhookResolve,
    onCopperWebhook,
} = require('./handlers');

/**
 * Copper Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): COPPER_WEBHOOK_RECEIVED optionally
 * verifies a shared secret (body field and/or Authorization header configured
 * on the subscription), then enqueues COPPER_WEBHOOK_RESOLVE. Account→
 * integration lookup needs the DB, so it runs in the worker, which re-enqueues
 * COPPER_WEBHOOK bound to the resolved integration. Consumers override
 * COPPER_WEBHOOK via binding.handlers.
 *
 * Copper does not publish a platform-wide HMAC scheme; authenticity is the
 * optional `secret` object and/or custom `headers` you set at
 * createWebhook/updateWebhook time. See:
 * https://developer.copper.com/webhooks/overview.html
 * https://developer.copper.com/webhooks/notification-example.html
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'copper-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'COPPER_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        COPPER_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onCopperWebhookReceived,
        },
        COPPER_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onCopperWebhookResolve,
        },
        COPPER_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onCopperWebhook,
        },
    },
};
