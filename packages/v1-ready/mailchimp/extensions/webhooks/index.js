const {
    onMailchimpWebhookReceived,
    onMailchimpWebhookResolve,
    onMailchimpWebhook,
} = require('./handlers');

/**
 * Mailchimp list webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): MAILCHIMP_WEBHOOK_RECEIVED verifies
 * the X-Mailchimp-Signature (when MAILCHIMP_WEBHOOK_SECRET is set) and enqueues
 * a resolve job. Account→integration lookup needs the DB, so it runs in the
 * worker (MAILCHIMP_WEBHOOK_RESOLVE), which re-enqueues MAILCHIMP_WEBHOOK bound
 * to the resolved integration. Consumers override MAILCHIMP_WEBHOOK via
 * binding.handlers.
 *
 * Classic payloads carry `data.list_id` but not `account_id`. Create webhooks
 * with `?account_id={account_id}` on the callback URL (account_id from GET /)
 * so resolve can find the owning integration.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Vendor docs: https://mailchimp.com/developer/marketing/guides/sync-audience-data-webhooks/
 */
module.exports = {
    name: 'mailchimp-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'MAILCHIMP_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        MAILCHIMP_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMailchimpWebhookReceived,
        },
        MAILCHIMP_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMailchimpWebhookResolve,
        },
        MAILCHIMP_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onMailchimpWebhook,
        },
    },
};
