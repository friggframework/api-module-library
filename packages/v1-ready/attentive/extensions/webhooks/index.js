const {
    onAttentiveWebhookReceived,
    onAttentiveWebhookResolve,
    onAttentiveWebhook,
} = require('./handlers');

/**
 * Attentive Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): ATTENTIVE_WEBHOOK_RECEIVED verifies
 * the HMAC signature and enqueues a resolve job. The company→integration lookup
 * needs the DB, so it runs in the worker (ATTENTIVE_WEBHOOK_RESOLVE), which
 * re-enqueues ATTENTIVE_WEBHOOK bound to the resolved integration. Consumers
 * override ATTENTIVE_WEBHOOK via binding.handlers.
 *
 * Pattern copied from packages/v1-ready/hubspot/extensions/webhooks/.
 * Signing: https://docs.attentive.com/docs/webhook-authentication
 * Payloads: https://docs.attentive.com/docs/webhook-payloads
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
