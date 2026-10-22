const {
    onHubSpotWebhookReceived,
    onHubSpotWebhookResolve,
    onHubSpotWebhook,
} = require('./handlers');
const contract2 = require('./contract-2');

/**
 * HubSpot Webhooks — Integration Extension bundle, on extension contract 2 (ADR-054) with its contract-1 face kept.
 *
 * Contract 2 (`defineIntegration` in @friggframework/core): enable it on a module binding and handle the emitted
 * events. Core receives the route, verifies, resolves portalId to the installations and dispatches:
 *
 *     modules: { crm: use(hubspot, { webhooks: { subscribe: ['deal.propertyChange:dealstage'], hydrate: ['dealname'] } }) },
 *     on: { 'crm.deal.changed': async ({ deal, changes }, ctx) => { … } },
 *
 * Contract 1 (unchanged): bind it by hand on `static Definition.extensions` and override HUBSPOT_WEBHOOK through
 * `binding.handlers`. `routes[].event` and `events` below are that face; `defineIntegration` ignores them.
 *
 * App-level subscription management uses HubSpot's dated Webhooks API, authenticated with the developer API key:
 *   GET/POST   /app-webhooks/2026-09/{appId}/subscriptions
 *   DELETE     /app-webhooks/2026-09/{appId}/subscriptions/{subscriptionId}
 * Docs: https://developers.hubspot.com/docs/api-reference/latest/webhooks/guide
 * The receiver does not call them; the reconcile-subscriptions admin script does, through the Api.
 *
 * Contract: https://github.com/friggframework/frigg/blob/next/packages/core/integrations/EXTENSIONS.md
 */
module.exports = {
    name: 'hubspot-webhooks',
    contract: 2,
    requires: { core: '>=2.0.0-next.0 <3' },
    useDatabase: false,
    env: ['HUBSPOT_CLIENT_SECRET', 'HUBSPOT_APP_ID', 'HUBSPOT_DEVELOPER_API_KEY'],
    options: contract2.options,
    routes: [
        {
            path: '/webhooks',
            method: 'POST',
            event: 'HUBSPOT_WEBHOOK_RECEIVED', // contract 1 only
        },
    ],
    verify: contract2.verify,
    receive: contract2.receive,
    resolve: { module: 'hubspot' },
    emits: contract2.emits,
    normalize: contract2.normalize,
    subscriptions: contract2.subscriptions,
    // contract 1 only
    events: {
        HUBSPOT_WEBHOOK_RECEIVED: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHubSpotWebhookReceived,
        },
        HUBSPOT_WEBHOOK_RESOLVE: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHubSpotWebhookResolve,
        },
        HUBSPOT_WEBHOOK: {
            type: 'LIFE_CYCLE_EVENT',
            handler: onHubSpotWebhook,
        },
    },
};
