const {
    onMicrosoftOutlookWebhookReceived,
    onMicrosoftOutlookWebhookResolve,
    onMicrosoftOutlookWebhook,
} = require('./handlers');

/**
 * Microsoft Outlook Graph change notifications — Tier 3 Integration Extension.
 *
 * DB-free receiver (`useDatabase: false`): MICROSOFT_OUTLOOK_WEBHOOK_RECEIVED
 * handles Graph's validationToken handshake and verifies clientState, then
 * enqueues a resolve job. tenantId → integration lookup needs the DB, so it
 * runs in the worker (MICROSOFT_OUTLOOK_WEBHOOK_RESOLVE), which re-enqueues
 * MICROSOFT_OUTLOOK_WEBHOOK bound to the resolved integration. Consumers override
 * MICROSOFT_OUTLOOK_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Graph: https://learn.microsoft.com/en-us/graph/change-notifications-overview
 * Pattern: packages/v1-ready/hubspot/extensions/webhooks/
 */
module.exports = {
    name: 'microsoft-outlook-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'MICROSOFT_OUTLOOK_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        MICROSOFT_OUTLOOK_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMicrosoftOutlookWebhookReceived,
        },
        MICROSOFT_OUTLOOK_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMicrosoftOutlookWebhookResolve,
        },
        MICROSOFT_OUTLOOK_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMicrosoftOutlookWebhook,
        },
    },
};
