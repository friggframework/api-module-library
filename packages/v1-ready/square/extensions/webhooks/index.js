const {
    onSquareWebhookReceived,
    onSquareWebhookResolve,
    onSquareWebhook,
} = require('./handlers');

/**
 * Square Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): SQUARE_WEBHOOK_RECEIVED verifies the
 * HMAC-SHA256 signature and enqueues a resolve job. The merchant→integration
 * lookup needs the DB, so it runs in the worker (SQUARE_WEBHOOK_RESOLVE), which
 * re-enqueues SQUARE_WEBHOOK bound to the resolved integration. Consumers
 * override SQUARE_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Signature: https://developer.squareup.com/docs/webhooks/step3validate
 */
module.exports = {
    name: 'square-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'SQUARE_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        SQUARE_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSquareWebhookReceived,
        },
        SQUARE_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSquareWebhookResolve,
        },
        SQUARE_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSquareWebhook,
        },
    },
};
