const {
    onTriNetWebhookReceived,
    onTriNetWebhookResolve,
    onTriNetWebhook,
} = require('./handlers');

/**
 * TriNet Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): TRINET_WEBHOOK_RECEIVED verifies
 * the Signature HMAC and enqueues a resolve job. company id → integration
 * lookup needs the DB, so it runs in the worker (TRINET_WEBHOOK_RESOLVE),
 * which re-enqueues TRINET_WEBHOOK bound to the resolved integration.
 * Consumers override TRINET_WEBHOOK via binding.handlers.
 *
 * Signing secret comes from TRINET_WEBHOOK_SHARED_SECRET (issued when the
 * TriNet application is configured — distinct from the OAuth client secret).
 * Webhook destination URLs are configured in the TriNet developer dashboard;
 * there is no public REST subscription CRUD.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'trinet-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'TRINET_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        TRINET_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onTriNetWebhookReceived,
        },
        TRINET_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onTriNetWebhookResolve,
        },
        TRINET_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onTriNetWebhook,
        },
    },
};
