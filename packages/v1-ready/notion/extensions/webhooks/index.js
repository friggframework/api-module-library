const {
    onNotionWebhookReceived,
    onNotionWebhookResolve,
    onNotionWebhook,
} = require('./handlers');

/**
 * Notion Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): NOTION_WEBHOOK_RECEIVED handles the
 * unsigned subscription verification_token handshake, verifies
 * X-Notion-Signature on event deliveries, and enqueues a resolve job.
 * workspace_id → integration lookup needs the DB, so it runs in the worker
 * (NOTION_WEBHOOK_RESOLVE), which re-enqueues NOTION_WEBHOOK bound to the
 * resolved integration. Consumers override NOTION_WEBHOOK via binding.handlers.
 *
 * Subscriptions are created in the Notion connection UI (no REST create API).
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Docs: https://developers.notion.com/reference/webhooks
 */
module.exports = {
    name: 'notion-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'NOTION_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        NOTION_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onNotionWebhookReceived,
        },
        NOTION_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onNotionWebhookResolve,
        },
        NOTION_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onNotionWebhook,
        },
    },
};
