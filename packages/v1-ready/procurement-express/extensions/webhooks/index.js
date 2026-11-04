const {
    onProcurementExpressWebhookReceived,
    onProcurementExpressWebhookResolve,
    onProcurementExpressWebhook,
} = require('./handlers');

/**
 * ProcurementExpress Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): PROCUREMENT_EXPRESS_WEBHOOK_RECEIVED
 * optionally verifies HTTP Basic Auth (configured on the PE webhook
 * subscription), then enqueues PROCUREMENT_EXPRESS_WEBHOOK_RESOLVE. Company /
 * subscription → integration lookup needs the DB, so it runs in the worker,
 * which re-enqueues PROCUREMENT_EXPRESS_WEBHOOK bound to the resolved
 * integration. Consumers override PROCUREMENT_EXPRESS_WEBHOOK via
 * binding.handlers.
 *
 * Pattern mirrors packages/v1-ready/hubspot/extensions/webhooks/.
 *
 * Docs: https://docs.procurementexpress.com/ (Webhooks)
 */
module.exports = {
    name: 'procurement-express-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'PROCUREMENT_EXPRESS_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        PROCUREMENT_EXPRESS_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onProcurementExpressWebhookReceived,
        },
        PROCUREMENT_EXPRESS_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onProcurementExpressWebhookResolve,
        },
        PROCUREMENT_EXPRESS_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onProcurementExpressWebhook,
        },
    },
};
