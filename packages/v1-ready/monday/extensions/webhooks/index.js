const {
    onMondayWebhookReceived,
    onMondayWebhookResolve,
    onMondayWebhook,
} = require('./handlers');

/**
 * monday.com board webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): MONDAY_WEBHOOK_RECEIVED handles the
 * URL-verification challenge, optionally verifies the JWT Authorization header
 * against MONDAY_SIGNING_SECRET, then enqueues MONDAY_WEBHOOK_RESOLVE. Board →
 * integration lookup needs the DB, so it runs in the worker, which re-enqueues
 * MONDAY_WEBHOOK bound to the resolved integration.
 *
 * Docs: https://developer.monday.com/api-reference/reference/webhooks
 * Pattern: packages/v1-ready/hubspot/extensions/webhooks/
 */
module.exports = {
    name: 'monday-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'MONDAY_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        MONDAY_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMondayWebhookReceived,
        },
        MONDAY_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMondayWebhookResolve,
        },
        MONDAY_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMondayWebhook,
        },
    },
};
