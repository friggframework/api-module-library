const {
    onFreshdeskWebhookReceived,
    onFreshdeskWebhookResolve,
    onFreshdeskWebhook,
} = require('./handlers');

/**
 * Freshdesk automation webhooks — Tier 3 Integration Extension bundle.
 *
 * Freshdesk has no dedicated webhook subscription REST resource. Outbound
 * delivery is configured as Trigger Webhook / Trigger API actions under
 * Admin → Workflows → Automations. Point the automation URL at this route,
 * including `?domain={subdomain}` (and optionally an account_id in the JSON
 * body) so the receiver can resolve the tenant.
 *
 * Pattern copied from packages/v1-ready/hubspot/extensions/webhooks/ (and
 * the Gorgias automation-style variant).
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'freshdesk-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'FRESHDESK_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        FRESHDESK_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFreshdeskWebhookReceived,
        },
        FRESHDESK_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFreshdeskWebhookResolve,
        },
        FRESHDESK_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onFreshdeskWebhook,
        },
    },
};
