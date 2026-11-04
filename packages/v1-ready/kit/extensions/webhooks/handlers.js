const { verifyKitSignature } = require('./signature-verifier');
const { findIntegrationByAccountId } = require('./lookup');

/**
 * Receiver for `POST /webhooks/:accountId` (and `POST /webhooks`) — DB-free.
 *
 * 1. Verify HMAC (`X-Kit-Signature` over `{t}.{raw_body}`).
 * 2. Enqueue KIT_WEBHOOK_RESOLVE with the parsed body + accountId from the path.
 *
 * Kit deliveries have no account id in the envelope — register webhook URLs
 * that include the account id path segment for multi-tenant routing.
 *
 * @see https://developers.kit.com/webhooks/verifying-signatures
 * @see https://developers.kit.com/webhooks/delivery-format
 */
async function onKitWebhookReceived({ req, res }) {
    const secret = process.env.KIT_WEBHOOK_SECRET;
    const verification = verifyKitSignature({ req, secret });
    if (!verification.valid) {
        console.warn(
            `[kit-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body || {};
    const accountId =
        (req.params && req.params.accountId) ||
        body.account_id ||
        body.accountId ||
        null;

    if (!accountId) {
        console.warn(
            '[kit-webhooks] event missing accountId (path param or body); skipping resolve'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'KIT_WEBHOOK_RESOLVE',
        body: { ...body, accountId: String(accountId) },
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * KIT_WEBHOOK_RESOLVE — worker hop with DB. Looks up account id → integration,
 * then re-enqueues KIT_WEBHOOK bound to that id.
 */
async function onKitWebhookResolve({ data }) {
    const body = data && data.body;
    const accountId =
        (body && body.accountId) ||
        (body && body.account_id);
    if (!accountId) {
        console.warn(
            '[kit-webhooks] resolve: event missing accountId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByAccountId(this, accountId);
    if (!integrationId) {
        console.warn(
            `[kit-webhooks] resolve: no integration for accountId=${accountId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'KIT_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * KIT_WEBHOOK — hydrated integration. Default no-op; override via
 * binding.handlers.KIT_WEBHOOK.
 */
async function onKitWebhook({ data }) {
    // no-op — override via binding.handlers.KIT_WEBHOOK
}

module.exports = {
    onKitWebhookReceived,
    onKitWebhookResolve,
    onKitWebhook,
};
