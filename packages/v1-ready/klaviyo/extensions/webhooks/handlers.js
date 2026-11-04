const { verifyKlaviyoSignature } = require('./signature-verifier');
const { findIntegrationByAccountId } = require('./lookup');
const { getHeader, WEBHOOK_ID_HEADER } = require('./signature-verifier');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the HMAC signature using
 * `KLAVIYO_WEBHOOK_SECRET` (the `secret_key` used when creating the webhook),
 * checks header/body webhook id consistency, then enqueues
 * KLAVIYO_WEBHOOK_RESOLVE with the full payload so the worker can reverse-look
 * up `meta.klaviyo_account_id` → owning integration.
 *
 * Docs: https://developers.klaviyo.com/en/docs/working_with_system_webhooks
 */
async function onKlaviyoWebhookReceived({ req, res }) {
    const verification = verifyKlaviyoSignature({
        req,
        secret: process.env.KLAVIYO_WEBHOOK_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[klaviyo-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const meta = body.meta || {};
    const headerWebhookId = getHeader(req.headers || {}, WEBHOOK_ID_HEADER);
    if (
        headerWebhookId &&
        meta.klaviyo_webhook_id &&
        headerWebhookId !== meta.klaviyo_webhook_id
    ) {
        console.warn(
            '[klaviyo-webhooks] rejecting webhook: header/body webhook id mismatch'
        );
        res.status(401).json({ error: 'webhook id mismatch' });
        return;
    }

    const accountId = meta.klaviyo_account_id;
    if (!accountId) {
        console.warn(
            '[klaviyo-webhooks] payload missing meta.klaviyo_account_id; skipping resolve'
        );
        res.status(200).json({ received: true, queued: false, skipped: true });
        return;
    }

    await this.queueWebhook({
        event: 'KLAVIYO_WEBHOOK_RESOLVE',
        body,
    });

    const events = Array.isArray(body.data) ? body.data : [];
    res.status(200).json({
        received: true,
        queued: true,
        events: events.length,
    });
}

/**
 * KLAVIYO_WEBHOOK_RESOLVE — worker (DB available). Looks up the owning
 * integration by account id, then re-enqueues KLAVIYO_WEBHOOK bound to it.
 */
async function onKlaviyoWebhookResolve({ data }) {
    const body = data && data.body;
    const accountId = body && body.meta && body.meta.klaviyo_account_id;
    if (!accountId) {
        console.warn(
            '[klaviyo-webhooks] resolve: missing meta.klaviyo_account_id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByAccountId(this, accountId);
    if (!integrationId) {
        console.warn(
            `[klaviyo-webhooks] resolve: no integration for accountId=${accountId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'KLAVIYO_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * KLAVIYO_WEBHOOK — hydrated integration. Default no-op; override via
 * binding.handlers.KLAVIYO_WEBHOOK.
 */
async function onKlaviyoWebhook({ data }) {
    // no-op — override via binding.handlers.KLAVIYO_WEBHOOK
}

module.exports = {
    onKlaviyoWebhookReceived,
    onKlaviyoWebhookResolve,
    onKlaviyoWebhook,
};
