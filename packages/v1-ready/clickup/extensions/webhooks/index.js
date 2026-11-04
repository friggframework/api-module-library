const {
    onClickUpWebhookReceived,
    onClickUpWebhookResolve,
    onClickUpWebhook,
} = require('./handlers');

/**
 * ClickUp Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): CLICKUP_WEBHOOK_RECEIVED optionally
 * verifies `X-Signature` when CLICKUP_WEBHOOK_SECRET is set, then enqueues
 * CLICKUP_WEBHOOK_RESOLVE. Workspace (team) → integration lookup needs the DB,
 * so it runs in the worker, which re-enqueues CLICKUP_WEBHOOK bound to the
 * resolved integration. Consumers override CLICKUP_WEBHOOK via binding.handlers.
 *
 * Note: ClickUp issues a unique secret per webhook (createWebhook response).
 * The env secret is for single-webhook / local testing; production adopters
 * should verify with the stored per-webhook secret (Api.verifyWebhookSignature).
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Pattern: packages/v1-ready/hubspot/extensions/webhooks/
 * Docs: https://developer.clickup.com/docs/webhooks
 */
module.exports = {
    name: 'clickup-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'CLICKUP_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        CLICKUP_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onClickUpWebhookReceived,
        },
        CLICKUP_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onClickUpWebhookResolve,
        },
        CLICKUP_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onClickUpWebhook,
        },
    },
};
