const {
    onSharePointWebhookReceived,
    onSharePointWebhookResolve,
    onSharePointWebhook,
} = require('./handlers');

/**
 * Microsoft Graph change notifications for SharePoint — Tier 3 Integration
 * Extension bundle (HubSpot-shaped).
 *
 * DB-free receiver (`useDatabase: false`):
 *   1. Responds to Graph's subscription validationToken handshake.
 *   2. Verifies clientState on notification payloads.
 *   3. Enqueues SHAREPOINT_WEBHOOK_RESOLVE; tenant→integration lookup runs in
 *      the worker, which re-enqueues SHAREPOINT_WEBHOOK bound to the integration.
 *
 * Docs:
 *   https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
 * Contract:
 *   https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'microsoft-sharepoint-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'SHAREPOINT_WEBHOOK_RECEIVED',
        },
        {
            // Graph may deliver the validation handshake as GET with ?validationToken=
            path: '/webhooks',
            method: 'GET',
            event: 'SHAREPOINT_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        SHAREPOINT_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSharePointWebhookReceived,
        },
        SHAREPOINT_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSharePointWebhookResolve,
        },
        SHAREPOINT_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSharePointWebhook,
        },
    },
};
