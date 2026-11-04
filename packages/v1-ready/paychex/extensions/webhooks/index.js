const {
    onPaychexWebhookReceived,
    onPaychexWebhookResolve,
    onPaychexWebhook,
} = require('./handlers');

/**
 * Paychex Webhooks — Tier 3 Integration Extension bundle.
 *
 * Patterned after HubSpot's DB-free receiver: PAYCHEX_WEBHOOK_RECEIVED optionally
 * verifies APIKEY delivery (PAYCHEX_WEBHOOK_API_KEY) and enqueues a resolve job.
 * The companyId → integration lookup needs the DB, so it runs in the worker
 * (PAYCHEX_WEBHOOK_RESOLVE), which re-enqueues PAYCHEX_WEBHOOK bound to the
 * resolved integration. Consumers override PAYCHEX_WEBHOOK via binding.handlers.
 *
 * Paychex authenticates to the subscriber URI using the authentication object
 * registered on the hook (NO_AUTH | BASIC_AUTH | APIKEY | OAUTH2 | OAUTH2_BASIC).
 * See https://developer.paychex.com/documentation
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'paychex-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'PAYCHEX_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        PAYCHEX_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPaychexWebhookReceived,
        },
        PAYCHEX_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPaychexWebhookResolve,
        },
        PAYCHEX_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPaychexWebhook,
        },
    },
};
