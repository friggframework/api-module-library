const {
    onJobberWebhookReceived,
    onJobberWebhookResolve,
    onJobberWebhook,
} = require('./handlers');

/**
 * Jobber Webhooks — Tier 3 Integration Extension bundle.
 *
 * Subscriptions are configured in the Jobber Developer Center (per app), not
 * via the GraphQL API. This extension receives those POSTs, verifies
 * X-Jobber-Hmac-SHA256, and routes by accountId → Frigg integration.
 *
 * DB-free receiver (`useDatabase: false`): JOBBER_WEBHOOK_RECEIVED verifies
 * the HMAC and enqueues resolve. Account→integration lookup needs the DB, so
 * it runs in the worker (JOBBER_WEBHOOK_RESOLVE), which re-enqueues
 * JOBBER_WEBHOOK bound to the resolved integration. Consumers override
 * JOBBER_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'jobber-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'JOBBER_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        JOBBER_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onJobberWebhookReceived,
        },
        JOBBER_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onJobberWebhookResolve,
        },
        JOBBER_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onJobberWebhook,
        },
    },
};
