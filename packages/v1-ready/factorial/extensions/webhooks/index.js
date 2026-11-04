const {
    onFactorialWebhookReceived,
    onFactorialWebhookResolve,
    onFactorialWebhook,
} = require('./handlers');

/**
 * Factorial Webhooks — Tier 3 Integration Extension bundle.
 *
 * Patterned after HubSpot's DB-free receiver: FACTORIAL_WEBHOOK_RECEIVED
 * verifies x-factorial-wh-challenge and enqueues a resolve job. The
 * company_id → integration lookup needs the DB, so it runs in the worker
 * (FACTORIAL_WEBHOOK_RESOLVE), which re-enqueues FACTORIAL_WEBHOOK bound to
 * the resolved integration. Consumers override FACTORIAL_WEBHOOK via
 * binding.handlers.
 *
 * Verification: compare x-factorial-wh-challenge to the subscription's
 * challenge (no HMAC). See https://apidoc.factorialhr.com/docs/manage-webhooks
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'factorial-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'FACTORIAL_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        FACTORIAL_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFactorialWebhookReceived,
        },
        FACTORIAL_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFactorialWebhookResolve,
        },
        FACTORIAL_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFactorialWebhook,
        },
    },
};
