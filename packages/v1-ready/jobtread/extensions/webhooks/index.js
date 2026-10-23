const {
    onJobTreadWebhookReceived,
    onJobTreadWebhookResolve,
    onJobTreadWebhook,
} = require('./handlers');

/**
 * JobTread Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): JOBTREAD_WEBHOOK_RECEIVED acknowledges
 * the delivery and enqueues a resolve job. Organization→integration lookup needs
 * the DB, so it runs in the worker (JOBTREAD_WEBHOOK_RESOLVE), which re-enqueues
 * JOBTREAD_WEBHOOK bound to the resolved integration. Consumers override
 * JOBTREAD_WEBHOOK via binding.handlers.
 *
 * Subscriptions are managed via the Pave API (`createWebhook` / `deleteWebhook`).
 * Inbound payload shape and signature verification are NOT published on the
 * introspectable JobTread schema — see handlers.js / open questions in the PR.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'jobtread-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'JOBTREAD_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        JOBTREAD_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onJobTreadWebhookReceived,
        },
        JOBTREAD_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onJobTreadWebhookResolve,
        },
        JOBTREAD_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onJobTreadWebhook,
        },
    },
};
