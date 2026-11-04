const {
    onDrChronoWebhookVerify,
    onDrChronoWebhookReceived,
    onDrChronoWebhookResolve,
    onDrChronoWebhook,
} = require('./handlers');

/**
 * DrChrono Webhooks — Tier 3 Integration Extension bundle.
 *
 * Subscriptions are configured in the DrChrono API application management UI
 * (Account → API → webhook section) — not via a documented public subscribe
 * REST surface. This extension:
 *   1. Answers the GET ownership challenge (HMAC-SHA256 of `msg`)
 *   2. Verifies POST deliveries via X-drchrono-signature == secret token
 *   3. Routes by practice_group / doctor → Frigg integration
 *
 * DB-free receiver (`useDatabase: false`): DRCHRONO_WEBHOOK_RECEIVED verifies
 * the signature and enqueues resolve. Lookup needs the DB, so it runs in the
 * worker (DRCHRONO_WEBHOOK_RESOLVE), which re-enqueues DRCHRONO_WEBHOOK bound
 * to the resolved integration. Consumers override DRCHRONO_WEBHOOK via
 * binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Docs: https://app.drchrono.com/api-docs/v2/documentation (Webhooks)
 */
module.exports = {
    name: 'drchrono-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'GET',
            event: 'DRCHRONO_WEBHOOK_VERIFY',
        },
        {
            path: '/webhooks',
            method: 'POST',
            event: 'DRCHRONO_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        DRCHRONO_WEBHOOK_VERIFY: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onDrChronoWebhookVerify,
        },
        DRCHRONO_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onDrChronoWebhookReceived,
        },
        DRCHRONO_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onDrChronoWebhookResolve,
        },
        DRCHRONO_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onDrChronoWebhook,
        },
    },
};
