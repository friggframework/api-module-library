const {
    onTrelloWebhookHead,
    onTrelloWebhookReceived,
    onTrelloWebhookResolve,
    onTrelloWebhook,
} = require('./handlers');

/**
 * Trello Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): TRELLO_WEBHOOK_RECEIVED verifies
 * the X-Trello-Webhook HMAC and enqueues TRELLO_WEBHOOK_RESOLVE. Member →
 * integration lookup needs the DB, so it runs in the worker, which re-enqueues
 * TRELLO_WEBHOOK bound to the resolved integration. Consumers override
 * TRELLO_WEBHOOK via binding.handlers.
 *
 * HEAD /webhooks answers Trello's create-time probe (must return 200).
 *
 * Prefer creating webhooks with `callbackURL` containing `?memberId=<externalId>`
 * so resolve can map the delivery to the owning Frigg entity.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Vendor: https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
 */
module.exports = {
    name: 'trello-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'HEAD',
            event: 'TRELLO_WEBHOOK_HEAD',
        },
        {
            path: '/webhooks',
            method: 'POST',
            event: 'TRELLO_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        TRELLO_WEBHOOK_HEAD: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onTrelloWebhookHead,
        },
        TRELLO_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onTrelloWebhookReceived,
        },
        TRELLO_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onTrelloWebhookResolve,
        },
        TRELLO_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onTrelloWebhook,
        },
    },
};
