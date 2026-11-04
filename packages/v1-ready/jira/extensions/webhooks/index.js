const {
    onJiraWebhookReceived,
    onJiraWebhookResolve,
    onJiraWebhook,
} = require('./handlers');

/**
 * Jira Cloud OAuth dynamic webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): JIRA_WEBHOOK_RECEIVED verifies the
 * Authorization bearer JWT (signed with the app client secret), then enqueues
 * JIRA_WEBHOOK_RESOLVE. Site/cloudId → integration lookup needs the DB, so it
 * runs in the worker, which re-enqueues JIRA_WEBHOOK bound to the resolved
 * integration. Consumers override JIRA_WEBHOOK via binding.handlers.
 *
 * Docs: https://developer.atlassian.com/cloud/jira/platform/webhooks/
 * Pattern: packages/v1-ready/hubspot/extensions/webhooks/
 */
module.exports = {
    name: 'jira-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'JIRA_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        JIRA_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onJiraWebhookReceived,
        },
        JIRA_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onJiraWebhookResolve,
        },
        JIRA_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onJiraWebhook,
        },
    },
};
