const { verifySquareSignature } = require('./signature-verifier');
const { findIntegrationByMerchantId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the Square HMAC signature,
 * then enqueues SQUARE_WEBHOOK_RESOLVE. Merchant→integration lookup needs the
 * DB, so it runs in the worker.
 *
 * Env:
 *   SQUARE_WEBHOOK_SIGNATURE_KEY — subscription signature key
 *   SQUARE_WEBHOOK_NOTIFICATION_URL — exact URL Square signed
 */
async function onSquareWebhookReceived({ req, res }) {
    const verification = verifySquareSignature({
        req,
        signatureKey: process.env.SQUARE_WEBHOOK_SIGNATURE_KEY,
        notificationUrl: process.env.SQUARE_WEBHOOK_NOTIFICATION_URL,
    });
    if (!verification.valid) {
        console.warn(
            `[square-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const merchantId = body.merchant_id;
    if (!merchantId) {
        console.warn('[square-webhooks] event missing merchant_id; skipping');
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'SQUARE_WEBHOOK_RESOLVE',
        body,
    });
    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * Resolve merchant_id → owning integration, then re-enqueue SQUARE_WEBHOOK.
 */
async function onSquareWebhookResolve({ data }) {
    const body = data && data.body;
    const merchantId = body && body.merchant_id;
    if (!merchantId) {
        console.warn(
            '[square-webhooks] resolve: event missing merchant_id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByMerchantId(this, merchantId);
    if (!integrationId) {
        console.warn(
            `[square-webhooks] resolve: no integration for merchant_id=${merchantId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'SQUARE_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default consumer for a resolved Square webhook. Override via binding.handlers.
 */
async function onSquareWebhook({ data }) {
    console.log(
        `[square-webhooks] SQUARE_WEBHOOK type=${
            data && data.body && data.body.type
        } merchant_id=${data && data.body && data.body.merchant_id}`
    );
}

module.exports = {
    onSquareWebhookReceived,
    onSquareWebhookResolve,
    onSquareWebhook,
};
