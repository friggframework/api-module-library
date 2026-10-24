const {
    onAttentiveWebhookReceived,
    onAttentiveWebhookResolve,
    onAttentiveWebhook,
} = require('./handlers');

/**
 * Attentive Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): ATTENTIVE_WEBHOOK_RECEIVED verifies
 * the x-attentive-hmac-sha256 HMAC and enqueues a resolve job. companyId →
 * integration lookup needs the DB, so it runs in the worker
 * (ATTENTIVE_WEBHOOK_RESOLVE), which re-enqueues ATTENTIVE_WEBHOOK bound to the
 * resolved integration. Consumers override ATTENTIVE_WEBHOOK via binding.handlers.
 *
 * Signing key: ATTENTIVE_WEBHOOK_SIGNING_KEY (from the Attentive app Webhooks
 * tab — not returned by POST /webhooks).
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'attentive-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'ATTENTIVE_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        ATTENTIVE_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onAttentiveWebhookReceived,
        },
        ATTENTIVE_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onAttentiveWebhookResolve,
        },
        ATTENTIVE_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onAttentiveWebhook,
        },
    },
};
