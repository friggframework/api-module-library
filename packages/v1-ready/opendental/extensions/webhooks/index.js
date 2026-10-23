const {
    onOpenDentalWebhookReceived,
    onOpenDentalWebhookResolve,
    onOpenDentalWebhook,
} = require('./handlers');

/**
 * Open Dental API Events — Tier 3 Integration Extension bundle.
 *
 * Subscriptions are created via POST /subscriptions on the API Service
 * (see Api.createSubscription). Deliveries are reverse REST calls that include
 * the Customer API Key in Authorization (no HMAC). This extension receives
 * those POSTs, checks the CustomerKey, and routes by hashed customer key →
 * Frigg integration.
 *
 * DB-free receiver (`useDatabase: false`): OPENDENTAL_WEBHOOK_RECEIVED
 * verifies the Authorization header and enqueues resolve. Customer→integration
 * lookup needs the DB, so it runs in the worker (OPENDENTAL_WEBHOOK_RESOLVE),
 * which re-enqueues OPENDENTAL_WEBHOOK bound to the resolved integration.
 * Consumers override OPENDENTAL_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Docs: https://www.opendental.com/site/apievents.html
 *       https://www.opendental.com/site/apisubscriptions.html
 */
module.exports = {
    name: 'opendental-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'OPENDENTAL_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        OPENDENTAL_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onOpenDentalWebhookReceived,
        },
        OPENDENTAL_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onOpenDentalWebhookResolve,
        },
        OPENDENTAL_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onOpenDentalWebhook,
        },
    },
};
