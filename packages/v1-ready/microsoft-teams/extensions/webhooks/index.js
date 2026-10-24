const {
    onMicrosoftTeamsWebhookReceived,
    onMicrosoftTeamsWebhookResolve,
    onMicrosoftTeamsWebhook,
} = require('./handlers');

/**
 * Microsoft Teams Graph change notifications — Tier 3 Integration Extension.
 *
 * DB-free receiver (`useDatabase: false`): MICROSOFT_TEAMS_WEBHOOK_RECEIVED
 * handles Graph's validationToken handshake and verifies clientState, then
 * enqueues a resolve job. tenantId → integration lookup needs the DB, so it
 * runs in the worker (MICROSOFT_TEAMS_WEBHOOK_RESOLVE), which re-enqueues
 * MICROSOFT_TEAMS_WEBHOOK bound to the resolved integration. Consumers override
 * MICROSOFT_TEAMS_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Graph: https://learn.microsoft.com/en-us/graph/change-notifications-overview
 */
module.exports = {
    name: 'microsoft-teams-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'MICROSOFT_TEAMS_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        MICROSOFT_TEAMS_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMicrosoftTeamsWebhookReceived,
        },
        MICROSOFT_TEAMS_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMicrosoftTeamsWebhookResolve,
        },
        MICROSOFT_TEAMS_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMicrosoftTeamsWebhook,
        },
    },
};
