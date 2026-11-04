const { verifyCloseWebhook } = require('./signature-verifier');
const {
    findIntegrationBySubscriptionId,
    findIntegrationByOrganizationId,
} = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies close-sig-hash when a
 * signature_key is configured, then enqueues CLOSE_WEBHOOK_RESOLVE.
 *
 * Payload shape (official):
 *   { event: { organization_id, object_type, action, data, ... },
 *     subscription_id }
 * @see https://developer.close.com/api/resources/webhooks.md
 */
async function onCloseWebhookReceived({ req, res }) {
    const verification = verifyCloseWebhook({
        req,
        signatureKey: process.env.CLOSE_WEBHOOK_SIGNATURE_KEY,
    });
    if (!verification.valid) {
        console.warn(
            `[close-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const subscriptionId = body.subscription_id;
    const organizationId = body.event && body.event.organization_id;

    if (!subscriptionId && !organizationId) {
        console.warn(
            '[close-webhooks] event missing subscription_id/organization_id; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'CLOSE_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * CLOSE_WEBHOOK_RESOLVE — queue worker (DB available). Looks up
 * subscription_id (preferred) or organization_id → owning integration, then
 * re-enqueues CLOSE_WEBHOOK bound to that id.
 */
async function onCloseWebhookResolve({ data }) {
    const body = data && data.body;
    if (!body) {
        console.warn('[close-webhooks] resolve: missing body; skipping');
        return;
    }

    let integrationId = await findIntegrationBySubscriptionId(
        this,
        body.subscription_id
    );

    const organizationId = body.event && body.event.organization_id;
    if (!integrationId && organizationId) {
        integrationId = await findIntegrationByOrganizationId(
            this,
            organizationId
        );
    }

    if (!integrationId) {
        console.warn(
            `[close-webhooks] resolve: no integration for subscription_id=${body.subscription_id} organization_id=${organizationId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'CLOSE_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * CLOSE_WEBHOOK — worker with owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.CLOSE_WEBHOOK.
 */
async function onCloseWebhook({ data }) {
    // no-op — override via binding.handlers.CLOSE_WEBHOOK
}

module.exports = {
    onCloseWebhookReceived,
    onCloseWebhookResolve,
    onCloseWebhook,
};
