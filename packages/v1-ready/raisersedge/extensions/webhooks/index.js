const {
    onRaisersEdgeWebhookOptions,
    onRaisersEdgeWebhookReceived,
    onRaisersEdgeWebhookResolve,
    onRaisersEdgeWebhook,
} = require('./handlers');

/**
 * Raiser's Edge NXT (Blackbaud SKY) Webhooks — Tier 3 Integration Extension.
 *
 * DB-free receiver (`useDatabase: false`):
 *   - OPTIONS /webhooks completes the CloudEvents Abuse Protection handshake
 *     (WebHook-Allowed-Origin: eventgrid.azure.net).
 *   - POST /webhooks optionally checks ?webhookKey=, then enqueues
 *     RAISERSEDGE_WEBHOOK_RESOLVE. Environment → integration lookup needs the
 *     DB, so it runs in the worker, which re-enqueues RAISERSEDGE_WEBHOOK.
 *
 * Pattern mirrors packages/v1-ready/hubspot/extensions/webhooks/.
 *
 * Docs:
 *   https://developer.blackbaud.com/skyapi/docs/webhooks
 *   https://developer.blackbaud.com/skyapi/docs/webhooks/subscriptions
 *   https://developer.blackbaud.com/skyapi/docs/webhooks/tutorial
 */
module.exports = {
    name: 'raisersedge-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'OPTIONS',
            event: 'RAISERSEDGE_WEBHOOK_OPTIONS',
        },
        {
            path: '/webhooks',
            method: 'POST',
            event: 'RAISERSEDGE_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        RAISERSEDGE_WEBHOOK_OPTIONS: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onRaisersEdgeWebhookOptions,
        },
        RAISERSEDGE_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onRaisersEdgeWebhookReceived,
        },
        RAISERSEDGE_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onRaisersEdgeWebhookResolve,
        },
        RAISERSEDGE_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onRaisersEdgeWebhook,
        },
    },
};
