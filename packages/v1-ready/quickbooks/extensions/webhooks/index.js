const {
    onQuickBooksWebhookReceived,
    onQuickBooksWebhookResolve,
    onQuickBooksWebhook,
} = require('./handlers');

/**
 * QuickBooks Online Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): QUICKBOOKS_WEBHOOK_RECEIVED verifies
 * the intuit-signature HMAC and enqueues a resolve job. realmId → integration
 * lookup needs the DB, so it runs in the worker (QUICKBOOKS_WEBHOOK_RESOLVE),
 * which re-enqueues QUICKBOOKS_WEBHOOK bound to the resolved integration.
 * Consumers override QUICKBOOKS_WEBHOOK via binding.handlers.
 *
 * Supports legacy eventNotifications payloads and CloudEvents batches; both are
 * routed by company id (realmId / intuitaccountid).
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'quickbooks-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'QUICKBOOKS_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        QUICKBOOKS_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onQuickBooksWebhookReceived,
        },
        QUICKBOOKS_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onQuickBooksWebhookResolve,
        },
        QUICKBOOKS_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onQuickBooksWebhook,
        },
    },
};
