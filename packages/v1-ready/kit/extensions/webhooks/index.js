const {
    onKitWebhookReceived,
    onKitWebhookResolve,
    onKitWebhook,
} = require('./handlers');

/**
 * Kit Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): KIT_WEBHOOK_RECEIVED verifies the
 * X-Kit-Signature HMAC and enqueues a resolve job. The account→integration
 * lookup needs the DB, so it runs in the worker (KIT_WEBHOOK_RESOLVE), which
 * re-enqueues KIT_WEBHOOK bound to the resolved integration. Consumers
 * override KIT_WEBHOOK via binding.handlers.
 *
 * Kit deliveries do not include account id — register endpoint URLs with
 * `/webhooks/:accountId` so the path carries the routing key.
 *
 * Pattern copied from packages/v1-ready/hubspot/extensions/webhooks/.
 * Signing: https://developers.kit.com/webhooks/verifying-signatures
 * Endpoints: https://developers.kit.com/api-reference/webhooks/create-a-webhook-endpoint
 */
module.exports = {
    name: 'kit-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks/:accountId',
            method: 'POST',
            event: 'KIT_WEBHOOK_RECEIVED',
        },
        {
            path: '/webhooks',
            method: 'POST',
            event: 'KIT_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        KIT_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onKitWebhookReceived,
        },
        KIT_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onKitWebhookResolve,
        },
        KIT_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onKitWebhook,
        },
    },
};
