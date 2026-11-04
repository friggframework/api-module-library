const {
    onFigmaWebhookReceived,
    onFigmaWebhookResolve,
    onFigmaWebhook,
} = require('./handlers');

/**
 * Figma Webhooks V2 — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): FIGMA_WEBHOOK_RECEIVED verifies the
 * passcode in the JSON body and enqueues FIGMA_WEBHOOK_RESOLVE. Tenant lookup
 * (when `figma_user_id` is available) runs in the worker, which re-enqueues
 * FIGMA_WEBHOOK bound to the resolved integration. Consumers override
 * FIGMA_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Security: https://developers.figma.com/docs/rest-api/webhooks-security/
 */
module.exports = {
    name: 'figma-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'FIGMA_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        FIGMA_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFigmaWebhookReceived,
        },
        FIGMA_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFigmaWebhookResolve,
        },
        FIGMA_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFigmaWebhook,
        },
    },
};
