const {
    onSalesloftWebhookReceived,
    onSalesloftWebhookResolve,
    onSalesloftWebhook,
} = require('./handlers');

/**
 * Salesloft Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): SALESLOFT_WEBHOOK_RECEIVED verifies
 * the HMAC-SHA1 signature (x-salesloft-signature + callback_token) and enqueues
 * a resolve job. Team→integration lookup needs the DB, so it runs in the worker
 * (SALESLOFT_WEBHOOK_RESOLVE), which re-enqueues SALESLOFT_WEBHOOK bound to the
 * resolved integration. Consumers override SALESLOFT_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Signature docs: https://developers.salesloft.com/docs/platform/webhooks/delivery-headers/
 */
module.exports = {
    name: 'salesloft-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'SALESLOFT_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        SALESLOFT_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSalesloftWebhookReceived,
        },
        SALESLOFT_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSalesloftWebhookResolve,
        },
        SALESLOFT_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSalesloftWebhook,
        },
    },
};
