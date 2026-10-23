const {
    onPandaDocWebhookReceived,
    onPandaDocWebhookResolve,
    onPandaDocWebhook,
} = require('./handlers');

/**
 * PandaDoc Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): PANDADOC_WEBHOOK_RECEIVED verifies
 * the HMAC-SHA256 signature (?signature=) and enqueues a resolve job. The
 * workspace→integration lookup needs the DB, so it runs in the worker
 * (PANDADOC_WEBHOOK_RESOLVE), which re-enqueues PANDADOC_WEBHOOK bound to the
 * resolved integration. Consumers override PANDADOC_WEBHOOK via binding.handlers.
 *
 * Register subscription URLs with `?workspace_id=<workspace>` so reverse lookup
 * works — document event bodies do not include workspace_id per PandaDoc docs.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Signature: https://developers.pandadoc.com/docs/webhook-verification
 */
module.exports = {
    name: 'pandadoc-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'PANDADOC_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        PANDADOC_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPandaDocWebhookReceived,
        },
        PANDADOC_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPandaDocWebhookResolve,
        },
        PANDADOC_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPandaDocWebhook,
        },
    },
};
