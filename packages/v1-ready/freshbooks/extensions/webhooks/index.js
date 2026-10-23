const {
    onFreshBooksWebhookReceived,
    onFreshBooksWebhook,
} = require('./handlers');

/**
 * FreshBooks Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): verifies X-FreshBooks-Hmac-SHA256
 * then enqueues FRESHBOOKS_WEBHOOK. Consumers override FRESHBOOKS_WEBHOOK via
 * binding.handlers.
 *
 * FreshBooks requires an initial verifier round-trip after createCallback
 * (Api.verifyCallback) before deliveries begin; store that verifier as
 * FRESHBOOKS_WEBHOOK_VERIFIER (or per-entity) for signature checks.
 *
 * Shaped after packages/v1-ready/hubspot/extensions/webhooks/.
 */
module.exports = {
    name: 'freshbooks-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'FRESHBOOKS_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        FRESHBOOKS_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFreshBooksWebhookReceived,
        },
        FRESHBOOKS_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFreshBooksWebhook,
        },
    },
};
