const { verifyBoxSignature } = require('./signature-verifier');
const { findIntegrationByBoxUserId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the Box HMAC signature,
 * then enqueues BOX_WEBHOOK_RESOLVE. User→integration lookup needs the DB,
 * so it runs in the worker.
 *
 * Env:
 *   BOX_WEBHOOK_PRIMARY_KEY — Developer Console primary signature key
 *   BOX_WEBHOOK_SECONDARY_KEY — optional secondary key during rotation
 */
async function onBoxWebhookReceived({ req, res }) {
    const verification = verifyBoxSignature({ req });
    if (!verification.valid) {
        console.warn(
            `[box-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const userId = body.created_by && body.created_by.id;
    if (!userId) {
        console.warn(
            '[box-webhooks] event missing created_by.id; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'BOX_WEBHOOK_RESOLVE',
        body,
    });
    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * Resolve created_by.id → owning integration, then re-enqueue BOX_WEBHOOK.
 */
async function onBoxWebhookResolve({ data }) {
    const body = data && data.body;
    const userId = body && body.created_by && body.created_by.id;
    if (!userId) {
        console.warn(
            '[box-webhooks] resolve: event missing created_by.id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByBoxUserId(this, userId);
    if (!integrationId) {
        console.warn(
            `[box-webhooks] resolve: no integration for user id=${userId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'BOX_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default consumer for a resolved Box webhook. Override via binding.handlers.
 */
async function onBoxWebhook({ data }) {
    console.log(
        `[box-webhooks] BOX_WEBHOOK trigger=${
            data && data.body && data.body.trigger
        } user=${
            data &&
            data.body &&
            data.body.created_by &&
            data.body.created_by.id
        }`
    );
}

module.exports = {
    onBoxWebhookReceived,
    onBoxWebhookResolve,
    onBoxWebhook,
};
