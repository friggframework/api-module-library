const {
    onPagerDutyWebhookReceived,
    onPagerDutyWebhookResolve,
    onPagerDutyWebhook,
} = require('./handlers');

/**
 * PagerDuty Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): PAGERDUTY_WEBHOOK_RECEIVED verifies
 * the V3 HMAC signature and enqueues a resolve job. The subdomain→integration
 * lookup needs the DB, so it runs in the worker (PAGERDUTY_WEBHOOK_RESOLVE),
 * which re-enqueues PAGERDUTY_WEBHOOK bound to the resolved integration.
 * Consumers override PAGERDUTY_WEBHOOK via binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'pagerduty-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'PAGERDUTY_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        PAGERDUTY_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPagerDutyWebhookReceived,
        },
        PAGERDUTY_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPagerDutyWebhookResolve,
        },
        PAGERDUTY_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onPagerDutyWebhook,
        },
    },
};
