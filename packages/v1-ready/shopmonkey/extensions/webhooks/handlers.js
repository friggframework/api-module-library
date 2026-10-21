const {
    verifyShopmonkeyWebhookSignature,
} = require('./signature-verifier');
const { findIntegrationByShopmonkeyExternalId } = require('./lookup');

/**
 * Best-effort extraction of a stable Shopmonkey external id from an inbound
 * webhook body. Delivery shape (apiVersion, operation, table, data, diff) is
 * documented at https://shopmonkey.dev/webhooks. Entity.externalId is the
 * authenticated user id; payloads more commonly carry companyId on `data`.
 * Confirm the preferred bind key on a live sandbox delivery.
 */
function extractExternalId(body) {
    if (!body || typeof body !== 'object') return null;
    const data = body.data && typeof body.data === 'object' ? body.data : body;
    if (data.companyId) return String(data.companyId);
    if (data.company_id) return String(data.company_id);
    if (data.userId) return String(data.userId);
    if (data.createdById) return String(data.createdById);
    if (data.id && body.table === 'user') return String(data.id);
    return null;
}

/**
 * Receiver for `POST /webhooks` — DB-free.
 * Verifies Webhook Standard HMAC when SHOPMONKEY_WEBHOOK_SECRET is set.
 */
async function onShopmonkeyWebhookReceived({ req, res }) {
    const secret = process.env.SHOPMONKEY_WEBHOOK_SECRET;
    if (secret) {
        const result = verifyShopmonkeyWebhookSignature(req, secret);
        if (!result.ok) {
            res.status(401).json({
                received: false,
                error: 'invalid_signature',
                reason: result.reason,
            });
            return;
        }
    }

    const body = req && req.body;
    await this.queueWebhook({
        event: 'SHOPMONKEY_WEBHOOK_RESOLVE',
        body: body === undefined ? null : body,
    });

    res.status(200).json({ received: true, queued: true });
}

/**
 * SHOPMONKEY_WEBHOOK_RESOLVE — worker (DB available).
 */
async function onShopmonkeyWebhookResolve({ data }) {
    const body = data && data.body;
    const externalId = extractExternalId(body);
    if (!externalId) {
        console.warn(
            '[shopmonkey-webhooks] resolve: payload missing company/user id; ' +
                'skipping integration bind (confirm delivery shape on sandbox)'
        );
        return;
    }

    const integrationId = await findIntegrationByShopmonkeyExternalId(
        this,
        externalId
    );
    if (!integrationId) {
        console.warn(
            `[shopmonkey-webhooks] resolve: no integration for externalId=${externalId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'SHOPMONKEY_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * SHOPMONKEY_WEBHOOK — worker with owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.SHOPMONKEY_WEBHOOK.
 */
async function onShopmonkeyWebhook() {
    // no-op — override via binding.handlers.SHOPMONKEY_WEBHOOK
}

module.exports = {
    onShopmonkeyWebhookReceived,
    onShopmonkeyWebhookResolve,
    onShopmonkeyWebhook,
    extractExternalId,
};
