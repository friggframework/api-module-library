const {
    onAirtableWebhookReceived,
    onAirtableWebhookResolve,
    onAirtableWebhook,
} = require('./handlers');

/**
 * Airtable Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): AIRTABLE_WEBHOOK_RECEIVED validates
 * the notification shape (and optionally X-Airtable-Content-MAC when a MAC
 * secret is configured), then enqueues a resolve job. base.id → integration
 * lookup needs the DB, so it runs in the worker (AIRTABLE_WEBHOOK_RESOLVE),
 * which re-enqueues AIRTABLE_WEBHOOK bound to the resolved integration.
 * Consumers override AIRTABLE_WEBHOOK via binding.handlers — typically to call
 * listWebhookPayloads for the ping's webhook id.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Docs: https://airtable.com/developers/web/api/webhooks-overview
 */
module.exports = {
    name: 'airtable-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'AIRTABLE_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        AIRTABLE_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onAirtableWebhookReceived,
        },
        AIRTABLE_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onAirtableWebhookResolve,
        },
        AIRTABLE_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onAirtableWebhook,
        },
    },
};
