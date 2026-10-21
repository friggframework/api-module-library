const {
    onMercuryWebhookReceived,
    onMercuryWebhookResolve,
    onMercuryWebhook,
} = require('./handlers');

/**
 * Mercury Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): verifies `Mercury-Signature`
 * (HMAC-SHA256 over `timestamp.rawBody`), then enqueues MERCURY_WEBHOOK_RESOLVE.
 * Entity→integration lookup needs the DB, so it runs in the worker, which
 * re-enqueues MERCURY_WEBHOOK bound to the resolved integration. Consumers
 * override MERCURY_WEBHOOK via binding.handlers.
 *
 * Mercury webhook subscription CRUD is on the REST API (`Api.createWebhook`
 * etc.). Inbound events do not carry an organization id — register URLs with
 * `?externalId=<entityExternalId>`. Store the `secret` returned by
 * createWebhook as MERCURY_WEBHOOK_SECRET (or per-install config).
 *
 * Shaped after packages/v1-ready/hubspot/extensions/webhooks/.
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 *
 * Docs: https://docs.mercury.com/reference/webhooks
 */
module.exports = {
    name: 'mercury-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'MERCURY_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        MERCURY_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMercuryWebhookReceived,
        },
        MERCURY_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMercuryWebhookResolve,
        },
        MERCURY_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMercuryWebhook,
        },
    },
};
