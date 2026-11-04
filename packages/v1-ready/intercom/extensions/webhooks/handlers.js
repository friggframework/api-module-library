const { verifyIntercomSignature } = require('./signature-verifier');
const { findIntegrationByWorkspaceId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * 1. Verify HMAC (`X-Hub-Signature` = sha1=hex(HMAC-SHA1(client_secret, body))).
 * 2. Enqueue INTERCOM_WEBHOOK_RESOLVE with the parsed body (carries `app_id`).
 *
 * Developer Hub may also send a HEAD to validate the URL — that is handled by
 * the HTTP stack outside this POST handler.
 *
 * @see https://developers.intercom.com/docs/webhooks/webhook-signatures
 */
async function onIntercomWebhookReceived({ req, res }) {
    const secret =
        process.env.INTERCOM_WEBHOOK_SECRET ||
        process.env.INTERCOM_CLIENT_SECRET;
    const verification = verifyIntercomSignature({ req, secret });
    if (!verification.valid) {
        console.warn(
            `[intercom-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body || {};
    const workspaceId = body.app_id || body.appId;
    if (!workspaceId) {
        console.warn(
            `[intercom-webhooks] event missing app_id (topic=${body.topic}); skipping`
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'INTERCOM_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * INTERCOM_WEBHOOK_RESOLVE — worker hop with DB. Looks up workspace id →
 * integration, then re-enqueues INTERCOM_WEBHOOK bound to that id.
 */
async function onIntercomWebhookResolve({ data }) {
    const body = data && data.body;
    const workspaceId = body && (body.app_id || body.appId);
    if (!workspaceId) {
        console.warn(
            '[intercom-webhooks] resolve: event missing app_id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByWorkspaceId(
        this,
        workspaceId
    );
    if (!integrationId) {
        console.warn(
            `[intercom-webhooks] resolve: no integration for workspaceId=${workspaceId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'INTERCOM_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * INTERCOM_WEBHOOK — hydrated integration. Default no-op; override via
 * binding.handlers.INTERCOM_WEBHOOK.
 */
async function onIntercomWebhook({ data }) {
    // no-op — override via binding.handlers.INTERCOM_WEBHOOK
}

module.exports = {
    onIntercomWebhookReceived,
    onIntercomWebhookResolve,
    onIntercomWebhook,
};
