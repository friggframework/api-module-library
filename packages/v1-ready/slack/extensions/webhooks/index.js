const {
    onSlackWebhookReceived,
    onSlackWebhookResolve,
    onSlackWebhook,
} = require('./handlers');

/**
 * Slack Events API — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): SLACK_WEBHOOK_RECEIVED verifies the
 * signing secret (and answers url_verification), then enqueues a resolve job.
 * team_id → integration lookup needs the DB, so it runs in the worker
 * (SLACK_WEBHOOK_RESOLVE), which re-enqueues SLACK_WEBHOOK bound to the
 * resolved integration. Consumers override SLACK_WEBHOOK via binding.handlers.
 *
 * Event subscriptions themselves are configured on the Slack app (Request URL
 * + subscribed events / app manifest) — Slack does not offer a Web API
 * create-subscription CRUD comparable to HubSpot Webhooks v3.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'slack-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'SLACK_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        SLACK_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSlackWebhookReceived,
        },
        SLACK_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSlackWebhookResolve,
        },
        SLACK_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSlackWebhook,
        },
    },
};
