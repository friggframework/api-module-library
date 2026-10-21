const { verifyProcurementExpressWebhook } = require('./signature-verifier');
const {
    findIntegrationByCompanyId,
    findIntegrationByWebhookId,
} = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies optional Basic Auth,
 * then enqueues PROCUREMENT_EXPRESS_WEBHOOK_RESOLVE.
 *
 * Payload shape (official docs example):
 *   { event: 'new_po'|'po_approved'|..., object: 'PurchaseOrder',
 *     payload: { id, company_id, ... } }
 *
 * @see https://docs.procurementexpress.com/
 */
async function onProcurementExpressWebhookReceived({ req, res }) {
    const verification = verifyProcurementExpressWebhook({ req });
    if (!verification.valid) {
        console.warn(
            `[procurement-express-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid authorization' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const companyId =
        (body.payload && body.payload.company_id) || body.company_id;
    const webhookId = body.webhook_id || body.id;

    if (
        (companyId === undefined || companyId === null) &&
        (webhookId === undefined || webhookId === null)
    ) {
        console.warn(
            '[procurement-express-webhooks] event missing company_id/webhook_id; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'PROCUREMENT_EXPRESS_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * PROCUREMENT_EXPRESS_WEBHOOK_RESOLVE — queue worker (DB available).
 * Looks up company_id (preferred) or webhook id → owning integration, then
 * re-enqueues PROCUREMENT_EXPRESS_WEBHOOK bound to that id.
 */
async function onProcurementExpressWebhookResolve({ data }) {
    const body = data && data.body;
    if (!body) {
        console.warn(
            '[procurement-express-webhooks] resolve: missing body; skipping'
        );
        return;
    }

    const companyId =
        (body.payload && body.payload.company_id) || body.company_id;
    let integrationId = await findIntegrationByCompanyId(this, companyId);

    const webhookId = body.webhook_id || body.id;
    if (!integrationId && webhookId !== undefined && webhookId !== null) {
        integrationId = await findIntegrationByWebhookId(this, webhookId);
    }

    if (!integrationId) {
        console.warn(
            `[procurement-express-webhooks] resolve: no integration for company_id=${companyId} webhook_id=${webhookId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'PROCUREMENT_EXPRESS_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * PROCUREMENT_EXPRESS_WEBHOOK — worker with owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.
 */
async function onProcurementExpressWebhook({ data }) {
    // no-op — override via binding.handlers.PROCUREMENT_EXPRESS_WEBHOOK
}

module.exports = {
    onProcurementExpressWebhookReceived,
    onProcurementExpressWebhookResolve,
    onProcurementExpressWebhook,
};
