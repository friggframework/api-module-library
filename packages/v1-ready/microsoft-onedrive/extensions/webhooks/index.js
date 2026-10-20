const {
    onOneDriveWebhookReceived,
    onOneDriveWebhookResolve,
    onOneDriveWebhook,
} = require('./handlers');

/**
 * Microsoft Graph change notifications for OneDrive — Tier 3 Integration
 * Extension bundle (HubSpot-shaped).
 *
 * DB-free receiver (`useDatabase: false`):
 *   1. Responds to Graph's subscription validationToken handshake.
 *   2. Verifies clientState on notification payloads.
 *   3. Enqueues ONEDRIVE_WEBHOOK_RESOLVE; entity→integration lookup runs in
 *      the worker, which re-enqueues ONEDRIVE_WEBHOOK bound to the integration.
 *
 * Docs:
 *   https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
 *   https://learn.microsoft.com/en-us/onedrive/developer/rest-api/concepts/using-webhooks
 * Contract:
 *   https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'microsoft-onedrive-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'ONEDRIVE_WEBHOOK_RECEIVED',
        },
        {
            // Graph may deliver the validation handshake as GET with ?validationToken=
            path: '/webhooks',
            method: 'GET',
            event: 'ONEDRIVE_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        ONEDRIVE_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onOneDriveWebhookReceived,
        },
        ONEDRIVE_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onOneDriveWebhookResolve,
        },
        ONEDRIVE_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onOneDriveWebhook,
        },
    },
};
