const {
    onCalendlyWebhookReceived,
    onCalendlyWebhookResolve,
    onCalendlyWebhook,
} = require('./handlers');

/**
 * Calendly Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): CALENDLY_WEBHOOK_RECEIVED verifies
 * the Calendly-Webhook-Signature header and enqueues a resolve job. The
 * created_by→integration lookup needs the DB, so it runs in the worker
 * (CALENDLY_WEBHOOK_RESOLVE), which re-enqueues CALENDLY_WEBHOOK bound to the
 * resolved integration. Consumers override CALENDLY_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 *
 * Signature docs:
 * https://developer.calendly.com/api-docs/overview/webhooks/webhook-signatures
 */
module.exports = {
    name: 'calendly-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'CALENDLY_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        CALENDLY_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onCalendlyWebhookReceived,
        },
        CALENDLY_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onCalendlyWebhookResolve,
        },
        CALENDLY_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onCalendlyWebhook,
        },
    },
};
