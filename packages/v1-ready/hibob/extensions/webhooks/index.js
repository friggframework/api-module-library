const {
    onHiBobWebhookReceived,
    onHiBobWebhookResolve,
    onHiBobWebhook,
} = require('./handlers');

/**
 * HiBob Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): HIBOB_WEBHOOK_RECEIVED verifies the
 * Bob-Signature (HMAC-SHA512) and enqueues a resolve job. The companyId →
 * integration lookup needs the DB, so it runs in the worker
 * (HIBOB_WEBHOOK_RESOLVE), which re-enqueues HIBOB_WEBHOOK bound to the
 * resolved integration. Consumers override HIBOB_WEBHOOK via binding.handlers.
 *
 * Customer webhook *subscriptions* are configured in the Bob UI — there is no
 * public REST create/list/delete for service-user integrations. Partner OAuth
 * apps use a different delivery model.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'hibob-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'HIBOB_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        HIBOB_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHiBobWebhookReceived,
        },
        HIBOB_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHiBobWebhookResolve,
        },
        HIBOB_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHiBobWebhook,
        },
    },
};
