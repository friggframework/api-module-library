const {
    onBambooHRWebhookReceived,
    onBambooHRWebhookResolve,
    onBambooHRWebhook,
} = require('./handlers');

/**
 * BambooHR Permissioned Webhooks — Tier 3 Integration Extension bundle.
 *
 * Subscriptions are created via the BambooHR API (`createWebhook` /
 * `listWebhooks` / `updateWebhook` / `deleteWebhook`). This extension receives
 * deliveries: verifies `X-BambooHR-Signature` (HMAC-SHA256 of rawBody+timestamp
 * with the webhook privateKey), then fans events out by companyDomain /
 * companyId.
 *
 * DB-free receiver (`useDatabase: false`): BAMBOOHR_WEBHOOK_RECEIVED verifies
 * and enqueues BAMBOOHR_WEBHOOK_RESOLVE. Company→integration lookup needs the
 * DB, so it runs in the worker, which re-enqueues BAMBOOHR_WEBHOOK for
 * consumers.
 *
 * Docs: https://documentation.bamboohr.com/docs/webhooks
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'bamboohr-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'BAMBOOHR_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        BAMBOOHR_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onBambooHRWebhookReceived,
        },
        BAMBOOHR_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onBambooHRWebhookResolve,
        },
        BAMBOOHR_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onBambooHRWebhook,
        },
    },
};
