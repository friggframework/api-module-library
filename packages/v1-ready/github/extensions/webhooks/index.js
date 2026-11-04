const {
    onGitHubWebhookReceived,
    onGitHubWebhookResolve,
    onGitHubWebhook,
} = require('./handlers');

/**
 * GitHub Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): GITHUB_WEBHOOK_RECEIVED verifies the
 * X-Hub-Signature-256 HMAC and enqueues a resolve job. Owner→integration
 * lookup needs the DB, so it runs in the worker (GITHUB_WEBHOOK_RESOLVE), which
 * re-enqueues GITHUB_WEBHOOK bound to the resolved integration. Consumers
 * override GITHUB_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Signature docs: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
module.exports = {
    name: 'github-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'GITHUB_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        GITHUB_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGitHubWebhookReceived,
        },
        GITHUB_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGitHubWebhookResolve,
        },
        GITHUB_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onGitHubWebhook,
        },
    },
};
