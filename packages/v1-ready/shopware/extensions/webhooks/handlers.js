const { verifyShopWareSecret } = require('./signature-verifier');
const { findIntegrationByTenantId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * 1. Verify `X-Api-Secret` against SHOPWARE_API_SECRET.
 * 2. Enqueue SHOPWARE_WEBHOOK_RESOLVE with the parsed body
 *    (carries `payload.tenant_id`).
 *
 * @see https://shop-ware.stoplight.io/docs/public-api/dgrb4a8slxf6k-webhooks
 */
async function onShopWareWebhookReceived({ req, res }) {
    const secret = process.env.SHOPWARE_API_SECRET;
    const verification = verifyShopWareSecret({ req, secret });
    if (!verification.valid) {
        console.warn(
            `[shopware-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body || {};
    const tenantId =
        (body.payload && body.payload.tenant_id) ||
        body.tenant_id ||
        body.tenantId;

    if (tenantId == null) {
        console.warn(
            `[shopware-webhooks] event missing payload.tenant_id (event=${body.event}); skipping`
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'SHOPWARE_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * SHOPWARE_WEBHOOK_RESOLVE — worker hop with DB. Looks up tenant id →
 * integration, then re-enqueues SHOPWARE_WEBHOOK bound to that id.
 */
async function onShopWareWebhookResolve({ data }) {
    const body = data && data.body;
    const tenantId =
        (body && body.payload && body.payload.tenant_id) ||
        (body && body.tenant_id) ||
        (body && body.tenantId);
    if (tenantId == null) {
        console.warn(
            '[shopware-webhooks] resolve: event missing payload.tenant_id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByTenantId(this, tenantId);
    if (!integrationId) {
        console.warn(
            `[shopware-webhooks] resolve: no integration for tenantId=${tenantId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'SHOPWARE_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * SHOPWARE_WEBHOOK — hydrated integration. Default no-op; override via
 * binding.handlers.SHOPWARE_WEBHOOK.
 */
async function onShopWareWebhook({ data }) {
    // no-op — override via binding.handlers.SHOPWARE_WEBHOOK
}

module.exports = {
    onShopWareWebhookReceived,
    onShopWareWebhookResolve,
    onShopWareWebhook,
};
