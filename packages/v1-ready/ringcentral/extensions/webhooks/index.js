const {
    onRingCentralWebhookReceived,
    onRingCentralWebhookResolve,
    onRingCentralWebhook,
} = require('./handlers');

/**
 * RingCentral Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): RINGCENTRAL_WEBHOOK_RECEIVED echoes
 * Validation-Token (subscription setup), verifies optional Verification-Token,
 * then enqueues a resolve job. accountId → integration lookup needs the DB, so
 * it runs in the worker (RINGCENTRAL_WEBHOOK_RESOLVE), which re-enqueues
 * RINGCENTRAL_WEBHOOK bound to the resolved integration. Consumers override
 * RINGCENTRAL_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 *
 * Vendor docs:
 *   https://developers.ringcentral.com/guide/notifications/webhooks/creating-webhooks
 *   https://developers.ringcentral.com/guide/notifications/webhooks/receiving
 */
module.exports = {
    name: 'ringcentral-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'RINGCENTRAL_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        RINGCENTRAL_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onRingCentralWebhookReceived,
        },
        RINGCENTRAL_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onRingCentralWebhookResolve,
        },
        RINGCENTRAL_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onRingCentralWebhook,
        },
    },
};
