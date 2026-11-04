const {
    onNeonWebhookReceived,
    onNeonWebhookResolve,
    onNeonWebhook,
} = require('./handlers');

/**
 * Neon CRM Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): NEON_WEBHOOK_RECEIVED optionally
 * verifies inbound Basic auth (when NEON_WEBHOOK_USERNAME/PASSWORD are set —
 * Neon documents optional HTTP Basic on the notify URL, not an HMAC signature),
 * then enqueues NEON_WEBHOOK_RESOLVE. Organization → integration lookup needs
 * the DB, so it runs in the worker, which re-enqueues NEON_WEBHOOK bound to the
 * resolved integration. Consumers override NEON_WEBHOOK via binding.handlers.
 *
 * Pattern mirrors packages/v1-ready/hubspot/extensions/webhooks/.
 *
 * Docs: https://developer.neoncrm.com/webhooks/
 */
module.exports = {
    name: 'neon-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'NEON_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        NEON_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onNeonWebhookReceived,
        },
        NEON_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onNeonWebhookResolve,
        },
        NEON_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onNeonWebhook,
        },
    },
};
