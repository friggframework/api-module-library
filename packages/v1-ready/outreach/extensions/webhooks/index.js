const {
    onOutreachWebhookReceived,
    onOutreachWebhookResolve,
    onOutreachWebhook,
} = require('./handlers');

/**
 * Outreach Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): OUTREACH_WEBHOOK_RECEIVED verifies
 * the Outreach-Webhook-Signature HMAC and enqueues a resolve job. Org →
 * integration lookup needs the DB (and typically a per-install URL
 * `:externalId`), so it runs in the worker (OUTREACH_WEBHOOK_RESOLVE), which
 * re-enqueues OUTREACH_WEBHOOK bound to the resolved integration. Consumers
 * override OUTREACH_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Docs: https://developers.outreach.io/api/webhooks
 */
module.exports = {
    name: 'outreach-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'OUTREACH_WEBHOOK_RECEIVED',
        },
        {
            path: '/webhooks/:externalId',
            method: 'POST',
            event: 'OUTREACH_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        OUTREACH_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onOutreachWebhookReceived,
        },
        OUTREACH_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onOutreachWebhookResolve,
        },
        OUTREACH_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onOutreachWebhook,
        },
    },
};
