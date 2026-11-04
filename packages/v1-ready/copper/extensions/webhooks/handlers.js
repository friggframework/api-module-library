const { verifyCopperWebhook } = require('./signature-verifier');
const {
    findIntegrationBySubscriptionId,
    findIntegrationByAccountId,
} = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Optionally verifies the shared
 * secret / auth header configured on the Copper subscription, then enqueues
 * COPPER_WEBHOOK_RESOLVE with the raw notification body.
 *
 * Notification shape (official):
 *   { ids[], type, event, subscription_id, timestamp, updated_attributes?,
 *     ...flattened secret fields }
 * https://developer.copper.com/webhooks/notification-example.html
 */
async function onCopperWebhookReceived({ req, res }) {
    const verification = verifyCopperWebhook({
        req,
        secret: process.env.COPPER_WEBHOOK_SECRET,
        authHeader: process.env.COPPER_WEBHOOK_AUTH_HEADER,
    });
    if (!verification.valid) {
        console.warn(
            `[copper-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (!body.subscription_id && !Array.isArray(body.ids)) {
        console.warn(
            '[copper-webhooks] event missing subscription_id/ids; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'COPPER_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * COPPER_WEBHOOK_RESOLVE — runs in the queue worker (DB available). Looks up
 * subscription_id (preferred) or accountId hint → owning integration, then
 * re-enqueues COPPER_WEBHOOK bound to that id.
 */
async function onCopperWebhookResolve({ data }) {
    const body = data && data.body;
    if (!body) {
        console.warn('[copper-webhooks] resolve: missing body; skipping');
        return;
    }

    let integrationId = await findIntegrationBySubscriptionId(
        this,
        body.subscription_id
    );

    if (!integrationId && body.account_id !== undefined) {
        integrationId = await findIntegrationByAccountId(this, body.account_id);
    }

    if (!integrationId) {
        console.warn(
            `[copper-webhooks] resolve: no integration for subscription_id=${body.subscription_id}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'COPPER_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * COPPER_WEBHOOK — runs in the worker with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.COPPER_WEBHOOK.
 */
async function onCopperWebhook({ data }) {
    // no-op — override via binding.handlers.COPPER_WEBHOOK
}

module.exports = {
    onCopperWebhookReceived,
    onCopperWebhookResolve,
    onCopperWebhook,
};
