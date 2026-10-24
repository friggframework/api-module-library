const {
    onHousecallProWebhookReceived,
    onHousecallProWebhookResolve,
    onHousecallProWebhook,
} = require('./handlers');

/**
 * Housecall Pro Webhooks — Tier 3 Integration Extension bundle.
 *
 * Subscriptions are configured in the Housecall Pro Webhooks app
 * (My Apps > Webhooks) or via partner arrangements — not via a documented
 * public subscribe REST surface on Stoplight. This extension receives those
 * POSTs, verifies Api-Signature / Api-Timestamp (HMAC-SHA256), and routes by
 * company_id → Frigg integration.
 *
 * DB-free receiver (`useDatabase: false`): HOUSECALLPRO_WEBHOOK_RECEIVED
 * verifies the HMAC and enqueues resolve. Company→integration lookup needs
 * the DB, so it runs in the worker (HOUSECALLPRO_WEBHOOK_RESOLVE), which
 * re-enqueues HOUSECALLPRO_WEBHOOK bound to the resolved integration.
 * Consumers override HOUSECALLPRO_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Docs: https://docs.housecallpro.com/docs/housecall-public-api/46e9e1be07621-webhooks
 * Help: https://help.housecallpro.com/en/articles/5683520-how-to-enable-webhooks
 */
module.exports = {
    name: 'housecallpro-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'HOUSECALLPRO_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        HOUSECALLPRO_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHousecallProWebhookReceived,
        },
        HOUSECALLPRO_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHousecallProWebhookResolve,
        },
        HOUSECALLPRO_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHousecallProWebhook,
        },
    },
};
