const {
    onGorgiasWebhookReceived,
    onGorgiasWebhookResolve,
    onGorgiasWebhook,
} = require('./handlers');

/**
 * Gorgias HTTP Integration webhooks — Tier 3 Integration Extension bundle.
 *
 * Gorgias has no dedicated "webhooks" resource. Outbound event delivery is
 * configured as HTTP Integrations (POST /api/integrations, type: "http") with
 * ticket triggers. Point the integration URL at this route, including
 * `?account={subdomain}` so the receiver can resolve the tenant.
 *
 * Pattern copied from packages/v1-ready/hubspot/extensions/webhooks/.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'gorgias-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'GORGIAS_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        GORGIAS_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGorgiasWebhookReceived,
        },
        GORGIAS_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGorgiasWebhookResolve,
        },
        GORGIAS_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGorgiasWebhook,
        },
    },
};
