const {
    onGoogleWorkspaceWebhookReceived,
    onGoogleWorkspaceWebhookResolve,
    onGoogleWorkspaceWebhook,
} = require('./handlers');

/**
 * Google Drive / Calendar push notifications — Tier 3 Integration Extension
 * bundle (HubSpot-shaped).
 *
 * DB-free receiver (`useDatabase: false`):
 *   1. Verifies optional X-Goog-Channel-Token against env.
 *   2. Enqueues GOOGLE_WORKSPACE_WEBHOOK_RESOLVE; entity→integration lookup
 *      runs in the worker, which re-enqueues GOOGLE_WORKSPACE_WEBHOOK bound
 *      to the resolved integration.
 *
 * Docs:
 *   https://developers.google.com/workspace/drive/api/guides/push
 *   https://developers.google.com/workspace/calendar/api/guides/push
 * Contract:
 *   https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'google-workspace-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'GOOGLE_WORKSPACE_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        GOOGLE_WORKSPACE_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGoogleWorkspaceWebhookReceived,
        },
        GOOGLE_WORKSPACE_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGoogleWorkspaceWebhookResolve,
        },
        GOOGLE_WORKSPACE_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGoogleWorkspaceWebhook,
        },
    },
};
