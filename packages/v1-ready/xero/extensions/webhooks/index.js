const {
    onXeroWebhookReceived,
    onXeroWebhookResolve,
    onXeroWebhook,
} = require('./handlers');

/**
 * Xero Webhooks — Tier 3 Integration Extension bundle.
 *
 * Subscriptions are created in the Xero Developer Portal (there is no
 * Accounting API to create/list webhook subscriptions). This extension only
 * receives deliveries: verifies `x-xero-signature`, answers Intent to Receive,
 * and fans events out by `tenantId`.
 *
 * DB-free receiver (`useDatabase: false`): XERO_WEBHOOK_RECEIVED verifies and
 * enqueues XERO_WEBHOOK_RESOLVE. Tenant→integration lookup needs the DB, so it
 * runs in the worker, which re-enqueues XERO_WEBHOOK for consumers.
 *
 * Docs: https://developer.xero.com/documentation/guides/webhooks/overview/
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'xero-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'XERO_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        XERO_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onXeroWebhookReceived,
        },
        XERO_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onXeroWebhookResolve,
        },
        XERO_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onXeroWebhook,
        },
    },
};
