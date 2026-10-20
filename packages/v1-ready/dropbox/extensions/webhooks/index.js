const {
    onDropboxWebhookChallenge,
    onDropboxWebhookReceived,
    onDropboxWebhookResolve,
    onDropboxWebhook,
} = require('./handlers');

/**
 * Dropbox Webhooks — Tier 3 Integration Extension bundle.
 *
 * Dropbox webhooks are registered in the App Console (no HTTP CRUD). The
 * verification request is a GET with `?challenge=…` that must be echoed
 * (text/plain). Notifications are POSTs signed with HMAC-SHA256 of the raw
 * body using the app secret (`X-Dropbox-Signature`).
 *
 * DB-free receiver (`useDatabase: false`): DROPBOX_WEBHOOK_RECEIVED verifies
 * the signature and enqueues DROPBOX_WEBHOOK_RESOLVE. Account→integration
 * lookup needs the DB, so it runs in the worker, which re-enqueues
 * DROPBOX_WEBHOOK bound to the resolved integration. Consumers override
 * DROPBOX_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Signature: https://www.dropbox.com/developers/reference/webhooks
 */
module.exports = {
    name: 'dropbox-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'GET',
            event: 'DROPBOX_WEBHOOK_CHALLENGE',
        },
        {
            path: '/webhooks',
            method: 'POST',
            event: 'DROPBOX_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        DROPBOX_WEBHOOK_CHALLENGE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onDropboxWebhookChallenge,
        },
        DROPBOX_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onDropboxWebhookReceived,
        },
        DROPBOX_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onDropboxWebhookResolve,
        },
        DROPBOX_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onDropboxWebhook,
        },
    },
};
