const {
    onFrontWebhookReceived,
    onFrontWebhookResolve,
    onFrontWebhook,
} = require('./handlers');

/**
 * Front Application Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): FRONT_WEBHOOK_RECEIVED verifies the
 * HMAC signature (and answers the sync challenge), then enqueues
 * FRONT_WEBHOOK_RESOLVE. Company→integration lookup needs the DB, so it runs
 * in the worker, which re-enqueues FRONT_WEBHOOK bound to the resolved
 * integration. Consumers override FRONT_WEBHOOK via binding.handlers.
 *
 * Subscriptions themselves are configured as Front app features — there is no
 * Core API CRUD for application webhook subscriptions.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Vendor: https://dev.frontapp.com/docs/application-webhooks
 */
module.exports = {
    name: 'front-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'FRONT_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        FRONT_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFrontWebhookReceived,
        },
        FRONT_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFrontWebhookResolve,
        },
        FRONT_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFrontWebhook,
        },
    },
};
