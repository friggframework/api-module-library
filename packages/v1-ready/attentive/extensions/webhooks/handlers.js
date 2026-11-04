const { verifyAttentiveSignature } = require('./signature-verifier');
const { findIntegrationByCompanyId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * 1. Verify HMAC (`x-attentive-hmac-sha256` over raw body).
 * 2. Enqueue ATTENTIVE_WEBHOOK_RESOLVE with the parsed body
 *    (carries `company.company_id`).
 *
 * @see https://docs.attentive.com/docs/webhook-authentication
 * @see https://docs.attentive.com/docs/webhook-payloads
 */
async function onAttentiveWebhookReceived({ req, res }) {
    const secret = process.env.ATTENTIVE_WEBHOOK_SECRET;
    const verification = verifyAttentiveSignature({ req, secret });
    if (!verification.valid) {
        console.warn(
            `[attentive-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body || {};
    const companyId =
        (body.company && body.company.company_id) ||
        body.companyId ||
        body.company_id;

    if (!companyId) {
        console.warn(
            `[attentive-webhooks] event missing company.company_id (type=${body.type}); skipping`
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'ATTENTIVE_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * ATTENTIVE_WEBHOOK_RESOLVE — worker hop with DB. Looks up company id →
 * integration, then re-enqueues ATTENTIVE_WEBHOOK bound to that id.
 */
async function onAttentiveWebhookResolve({ data }) {
    const body = data && data.body;
    const companyId =
        (body && body.company && body.company.company_id) ||
        (body && body.companyId) ||
        (body && body.company_id);
    if (!companyId) {
        console.warn(
            '[attentive-webhooks] resolve: event missing company.company_id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByCompanyId(this, companyId);
    if (!integrationId) {
        console.warn(
            `[attentive-webhooks] resolve: no integration for companyId=${companyId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'ATTENTIVE_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * ATTENTIVE_WEBHOOK — hydrated integration. Default no-op; override via
 * binding.handlers.ATTENTIVE_WEBHOOK.
 */
async function onAttentiveWebhook({ data }) {
    // no-op — override via binding.handlers.ATTENTIVE_WEBHOOK
}

module.exports = {
    onAttentiveWebhookReceived,
    onAttentiveWebhookResolve,
    onAttentiveWebhook,
};
