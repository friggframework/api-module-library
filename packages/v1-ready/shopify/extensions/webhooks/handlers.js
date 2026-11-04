const { verifyShopifySignature, getHeader } = require('./signature-verifier');
const { findIntegrationByShopDomain } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies HMAC, then enqueues
 * SHOPIFY_WEBHOOK_RESOLVE with the shop domain and payload.
 */
async function onShopifyWebhookReceived({ req, res }) {
    const verification = verifyShopifySignature({
        req,
        clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[shopify-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const shopDomain = getHeader(req.headers, 'x-shopify-shop-domain');
    const topic = getHeader(req.headers, 'x-shopify-topic');
    const webhookId = getHeader(req.headers, 'x-shopify-webhook-id');

    if (!shopDomain) {
        console.warn('[shopify-webhooks] missing X-Shopify-Shop-Domain; skipping');
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'SHOPIFY_WEBHOOK_RESOLVE',
        body: {
            shopDomain,
            topic,
            webhookId,
            payload: req.body,
            headers: {
                'x-shopify-topic': topic,
                'x-shopify-shop-domain': shopDomain,
                'x-shopify-webhook-id': webhookId,
            },
        },
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * Worker hop: shop domain → owning integration, then re-enqueue SHOPIFY_WEBHOOK.
 */
async function onShopifyWebhookResolve({ data }) {
    const body = data && data.body;
    const shopDomain = body && body.shopDomain;
    if (!shopDomain) {
        console.warn('[shopify-webhooks] resolve: missing shopDomain; skipping');
        return;
    }

    const integrationId = await findIntegrationByShopDomain(this, shopDomain);
    if (!integrationId) {
        console.warn(
            `[shopify-webhooks] resolve: no integration for shop=${shopDomain}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'SHOPIFY_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default no-op; consumers override via binding.handlers.SHOPIFY_WEBHOOK.
 */
async function onShopifyWebhook({ data }) {
    void data;
}

module.exports = {
    onShopifyWebhookReceived,
    onShopifyWebhookResolve,
    onShopifyWebhook,
};
