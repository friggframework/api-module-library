const {
    onBoxWebhookReceived,
    onBoxWebhookResolve,
    onBoxWebhook,
} = require('./handlers');

/**
 * Box Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): BOX_WEBHOOK_RECEIVED verifies the
 * V2 HMAC signature and enqueues a resolve job. The user→integration lookup
 * needs the DB, so it runs in the worker (BOX_WEBHOOK_RESOLVE), which
 * re-enqueues BOX_WEBHOOK bound to the resolved integration. Consumers
 * override BOX_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Signature: https://developer.box.com/guides/webhooks/v2/signatures-v2/
 */
module.exports = {
    name: 'box-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'BOX_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        BOX_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onBoxWebhookReceived,
        },
        BOX_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onBoxWebhookResolve,
        },
        BOX_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onBoxWebhook,
        },
    },
};
