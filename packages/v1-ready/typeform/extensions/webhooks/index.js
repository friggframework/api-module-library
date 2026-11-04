const {
    onTypeformWebhookReceived,
    onTypeformWebhookResolve,
    onTypeformWebhook,
} = require('./handlers');

/**
 * Typeform Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): TYPEFORM_WEBHOOK_RECEIVED verifies
 * the Typeform-Signature HMAC and enqueues a resolve job. The account→
 * integration lookup needs the DB, so it runs in the worker
 * (TYPEFORM_WEBHOOK_RESOLVE), which re-enqueues TYPEFORM_WEBHOOK bound to the
 * resolved integration. Consumers override TYPEFORM_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Signature: https://www.typeform.com/developers/webhooks/secure-your-webhooks/
 */
module.exports = {
    name: 'typeform-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'TYPEFORM_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        TYPEFORM_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onTypeformWebhookReceived,
        },
        TYPEFORM_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onTypeformWebhookResolve,
        },
        TYPEFORM_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onTypeformWebhook,
        },
    },
};
