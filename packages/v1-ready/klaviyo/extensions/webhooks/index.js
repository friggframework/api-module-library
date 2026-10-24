const {
    onKlaviyoWebhookReceived,
    onKlaviyoWebhookResolve,
    onKlaviyoWebhook,
} = require('./handlers');

/**
 * Klaviyo system webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): KLAVIYO_WEBHOOK_RECEIVED verifies
 * the HMAC signature and enqueues a resolve job. Account→integration lookup
 * needs the DB, so it runs in the worker (KLAVIYO_WEBHOOK_RESOLVE), which
 * re-enqueues KLAVIYO_WEBHOOK bound to the resolved integration. Consumers
 * override KLAVIYO_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Vendor docs: https://developers.klaviyo.com/en/docs/working_with_system_webhooks
 */
module.exports = {
    name: 'klaviyo-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'KLAVIYO_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        KLAVIYO_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onKlaviyoWebhookReceived,
        },
        KLAVIYO_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onKlaviyoWebhookResolve,
        },
        KLAVIYO_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onKlaviyoWebhook,
        },
    },
};
