const {
    onZendeskWebhookReceived,
    onZendeskWebhookResolve,
    onZendeskWebhook,
} = require('./handlers');

/**
 * Zendesk Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): ZENDESK_WEBHOOK_RECEIVED verifies
 * the HMAC signature (X-Zendesk-Webhook-Signature) and enqueues a resolve job.
 * Subdomain → integration lookup needs the DB, so it runs in the worker
 * (ZENDESK_WEBHOOK_RESOLVE), which re-enqueues ZENDESK_WEBHOOK bound to the
 * resolved integration. Consumers override ZENDESK_WEBHOOK via binding.handlers.
 *
 * Pattern mirrored from packages/v1-ready/hubspot/extensions/webhooks/.
 * Signature algorithm:
 * https://developer.zendesk.com/documentation/webhooks/verifying/
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'zendesk-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'ZENDESK_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        ZENDESK_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onZendeskWebhookReceived,
        },
        ZENDESK_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onZendeskWebhookResolve,
        },
        ZENDESK_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onZendeskWebhook,
        },
    },
};
