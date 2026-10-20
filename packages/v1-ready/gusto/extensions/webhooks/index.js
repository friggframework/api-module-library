const {
    onGustoWebhookReceived,
    onGustoWebhookResolve,
    onGustoWebhook,
} = require('./handlers');

/**
 * Gusto Webhooks — Tier 3 Integration Extension bundle.
 *
 * Patterned after HubSpot's DB-free receiver: GUSTO_WEBHOOK_RECEIVED verifies
 * X-Gusto-Signature and enqueues a resolve job. The company UUID → integration
 * lookup needs the DB, so it runs in the worker (GUSTO_WEBHOOK_RESOLVE), which
 * re-enqueues GUSTO_WEBHOOK bound to the resolved integration. Consumers
 * override GUSTO_WEBHOOK via binding.handlers.
 *
 * Signature: HMAC-SHA256(payload, verification_token) compared to
 * X-Gusto-Signature. See https://docs.gusto.com/app-integrations/docs/webhooks
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'gusto-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'GUSTO_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        GUSTO_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGustoWebhookReceived,
        },
        GUSTO_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGustoWebhookResolve,
        },
        GUSTO_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGustoWebhook,
        },
    },
};
