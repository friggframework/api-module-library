const {
    onClockworkWebhookReceived,
    onClockworkWebhookResolve,
    onClockworkWebhook,
} = require('./handlers');

/**
 * Clockwork Recruiting Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): CLOCKWORK_WEBHOOK_RECEIVED accepts
 * the delivery (optional shared-secret header check when configured), then
 * enqueues CLOCKWORK_WEBHOOK_RESOLVE. Firm subdomain → integration lookup needs
 * the DB, so it runs in the worker, which re-enqueues CLOCKWORK_WEBHOOK bound
 * to the resolved integration. Consumers override CLOCKWORK_WEBHOOK via
 * binding.handlers.
 *
 * Pattern mirrors packages/v1-ready/hubspot/extensions/webhooks/.
 *
 * Official webhook payload / signature docs are distributed by Clockwork
 * support (not public). This receiver treats the body as opaque JSON and
 * resolves the firm via `firm_subdomain` / `firm` fields or the
 * `x-clockwork-firm` header when present.
 */
module.exports = {
    name: 'clockwork-recruiting-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'CLOCKWORK_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        CLOCKWORK_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onClockworkWebhookReceived,
        },
        CLOCKWORK_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onClockworkWebhookResolve,
        },
        CLOCKWORK_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onClockworkWebhook,
        },
    },
};
