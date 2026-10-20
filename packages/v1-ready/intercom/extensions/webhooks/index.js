const {
    onIntercomWebhookReceived,
    onIntercomWebhookResolve,
    onIntercomWebhook,
} = require('./handlers');

/**
 * Intercom Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): INTERCOM_WEBHOOK_RECEIVED verifies
 * the X-Hub-Signature HMAC, then enqueues INTERCOM_WEBHOOK_RESOLVE. Workspace
 * (app_id) → integration lookup needs the DB, so it runs in the worker, which
 * re-enqueues INTERCOM_WEBHOOK bound to the resolved integration. Consumers
 * override INTERCOM_WEBHOOK via binding.handlers.
 *
 * Topic subscriptions themselves are configured in the Intercom Developer Hub
 * — there is no REST CRUD for webhook subscriptions in OpenAPI 2.15.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Vendor: https://developers.intercom.com/docs/webhooks/setting-up-webhooks
 */
module.exports = {
    name: 'intercom-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'INTERCOM_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        INTERCOM_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onIntercomWebhookReceived,
        },
        INTERCOM_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onIntercomWebhookResolve,
        },
        INTERCOM_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onIntercomWebhook,
        },
    },
};
