const { verifyPayJunctionWebhook } = require('./signature-verifier');
const {
    findIntegrationByMerchantId,
    findIntegrationByWebhookId,
} = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies X-Pj-Signature when a
 * secret is configured, then enqueues PAYJUNCTION_WEBHOOK_RESOLVE.
 *
 * Payload shape (official):
 *   { id, created, type, data: { transactionId | customerId | ... } }
 * Headers: Pj-Merchant, Pj-Account, X-Pj-Signature
 *
 * @see https://developer.payjunction.com/hc/en-us/articles/115000770787-Receiving-Webhooks
 * @see https://developer.payjunction.com/hc/en-us/articles/360007196134-Webhook-HTTP-Headers
 */
async function onPayJunctionWebhookReceived({ req, res }) {
    const verification = verifyPayJunctionWebhook({
        req,
        secret: process.env.PAYJUNCTION_WEBHOOK_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[payjunction-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const headers = req.headers || {};
    const merchantId =
        headers['pj-merchant'] ||
        headers['Pj-Merchant'] ||
        headers['PJ-MERCHANT'];

    if (!merchantId && !body.id) {
        console.warn(
            '[payjunction-webhooks] event missing Pj-Merchant / body.id; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'PAYJUNCTION_WEBHOOK_RESOLVE',
        body,
        headers: {
            'pj-merchant': merchantId || null,
            'pj-account':
                headers['pj-account'] ||
                headers['Pj-Account'] ||
                headers['PJ-ACCOUNT'] ||
                null,
        },
    });

    // Respond quickly — PayJunction retries if the listener is slow.
    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * PAYJUNCTION_WEBHOOK_RESOLVE — queue worker (DB available). Looks up
 * Pj-Merchant → owning integration, then re-enqueues PAYJUNCTION_WEBHOOK.
 */
async function onPayJunctionWebhookResolve({ data }) {
    const body = data && data.body;
    if (!body) {
        console.warn('[payjunction-webhooks] resolve: missing body; skipping');
        return;
    }

    const merchantId =
        (data.headers && data.headers['pj-merchant']) || null;

    let integrationId = await findIntegrationByMerchantId(this, merchantId);

    if (!integrationId && body.id) {
        // Some hosts may key off the delivery/subscription id.
        integrationId = await findIntegrationByWebhookId(this, body.id);
    }

    if (!integrationId) {
        console.warn(
            `[payjunction-webhooks] resolve: no integration for Pj-Merchant=${merchantId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'PAYJUNCTION_WEBHOOK',
        integrationId,
        body,
        headers: data.headers || {},
    });
}

/**
 * PAYJUNCTION_WEBHOOK — worker with owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.PAYJUNCTION_WEBHOOK.
 */
async function onPayJunctionWebhook({ data }) {
    // no-op — override via binding.handlers.PAYJUNCTION_WEBHOOK
}

module.exports = {
    onPayJunctionWebhookReceived,
    onPayJunctionWebhookResolve,
    onPayJunctionWebhook,
};
