const {
    onSegmentWebhookReceived,
    onSegmentWebhookResolve,
    onSegmentWebhook,
} = require('./handlers');

/**
 * Segment Webhooks — Tier 3 Integration Extension bundle.
 *
 * DB-free receiver (`useDatabase: false`): SEGMENT_WEBHOOK_RECEIVED verifies the
 * X-Signature HMAC-SHA1 (Webhooks Actions shared secret) and enqueues a resolve
 * job. Workspace/writeKey → integration lookup needs the DB, so it runs in the
 * worker (SEGMENT_WEBHOOK_RESOLVE), which re-enqueues SEGMENT_WEBHOOK bound to
 * the resolved integration. Consumers override SEGMENT_WEBHOOK via
 * binding.handlers.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 * Signature docs: https://www.twilio.com/docs/segment/connections/destinations/catalog/actions-webhook
 */
module.exports = {
    name: 'segment-webhooks',
    useDatabase: false,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'SEGMENT_WEBHOOK_RECEIVED',
        },
    ],
    events: {
        SEGMENT_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSegmentWebhookReceived,
        },
        SEGMENT_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSegmentWebhookResolve,
        },
        SEGMENT_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onSegmentWebhook,
        },
    },
};
