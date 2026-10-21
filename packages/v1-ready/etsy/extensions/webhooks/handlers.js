const { verifyEtsyWebhook } = require('./signature-verifier');
const { findIntegrationByShopId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies webhook-signature when
 * ETSY_WEBHOOK_SIGNING_SECRET is configured, then enqueues ETSY_WEBHOOK_RESOLVE.
 *
 * Payload (official common fields):
 *   { event_type, resource_url, shop_id, listing_id?, product_id? }
 * @see https://developers.etsy.com/documentation/essentials/webhooks
 *
 * Subscriptions are created in the Etsy Developer Portal Webhook portal —
 * there is no REST CRUD for webhook subscriptions in the Open API OAS.
 */
async function onEtsyWebhookReceived({ req, res }) {
    const verification = verifyEtsyWebhook({
        req,
        signingSecret: process.env.ETSY_WEBHOOK_SIGNING_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[etsy-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const shopId = body.shop_id;

    if (shopId === undefined || shopId === null) {
        console.warn('[etsy-webhooks] event missing shop_id; skipping');
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'ETSY_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * ETSY_WEBHOOK_RESOLVE — queue worker (DB available). Looks up shop_id →
 * owning integration, then re-enqueues ETSY_WEBHOOK bound to that id.
 */
async function onEtsyWebhookResolve({ data }) {
    const body = data && data.body;
    if (!body) {
        console.warn('[etsy-webhooks] resolve: missing body; skipping');
        return;
    }

    const integrationId = await findIntegrationByShopId(this, body.shop_id);
    if (!integrationId) {
        console.warn(
            `[etsy-webhooks] resolve: no integration for shop_id=${body.shop_id}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'ETSY_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * ETSY_WEBHOOK — worker with owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.ETSY_WEBHOOK.
 */
async function onEtsyWebhook({ data }) {
    // no-op — override via binding.handlers.ETSY_WEBHOOK
}

module.exports = {
    onEtsyWebhookReceived,
    onEtsyWebhookResolve,
    onEtsyWebhook,
};
