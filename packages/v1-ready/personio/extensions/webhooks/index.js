const {
    onPersonioWebhookReceived,
    onPersonioWebhookResolve,
    onPersonioWebhook,
} = require('./handlers');

/**
 * Personio Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): PERSONIO_WEBHOOK_RECEIVED verifies
 * the X-Personio-Webhook-Signature HMAC and enqueues a resolve job.
 * company_id → integration lookup needs the DB, so it runs in the worker
 * (PERSONIO_WEBHOOK_RESOLVE), which re-enqueues PERSONIO_WEBHOOK bound to the
 * resolved integration. Consumers override PERSONIO_WEBHOOK via binding.handlers.
 *
 * Signing secret(s) come from PERSONIO_WEBHOOK_SIGNING_SECRET (comma-separated
 * for active + retiring during rotation). Create/rotate secrets via
 * Api.rotateWebhookSigningSecret — values are returned only once.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'personio-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'PERSONIO_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        PERSONIO_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPersonioWebhookReceived,
        },
        PERSONIO_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPersonioWebhookResolve,
        },
        PERSONIO_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPersonioWebhook,
        },
    },
};
