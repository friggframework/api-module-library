const {
    onGitLabWebhookReceived,
    onGitLabWebhookResolve,
    onGitLabWebhook,
} = require('./handlers');

/**
 * GitLab project webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): GITLAB_WEBHOOK_RECEIVED verifies the
 * signing token (webhook-signature) or legacy X-Gitlab-Token, then enqueues
 * GITLAB_WEBHOOK_RESOLVE. Project → integration lookup needs the DB, so it runs
 * in the worker, which re-enqueues GITLAB_WEBHOOK bound to the resolved
 * integration. Consumers override GITLAB_WEBHOOK via binding.handlers.
 *
 * Docs: https://docs.gitlab.com/user/project/integrations/webhooks/
 * Pattern: packages/v1-ready/hubspot/extensions/webhooks/
 */
module.exports = {
    name: 'gitlab-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'GITLAB_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        GITLAB_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGitLabWebhookReceived,
        },
        GITLAB_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGitLabWebhookResolve,
        },
        GITLAB_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGitLabWebhook,
        },
    },
};
