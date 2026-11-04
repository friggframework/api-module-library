const { verifyJobberSignature } = require('./signature-verifier');
const { findIntegrationByAccountId } = require('./lookup');

/**
 * Extract the Jobber webHookEvent from a parsed body.
 * Shape (apps created after 2023-12-08):
 *   { data: { webHookEvent: { topic, appId, accountId, itemId, occurredAt } } }
 */
function extractWebHookEvent(body) {
    if (!body || typeof body !== 'object') return null;
    if (body.data && body.data.webHookEvent) return body.data.webHookEvent;
    if (body.webHookEvent) return body.webHookEvent;
    return null;
}

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies X-Jobber-Hmac-SHA256, then
 * enqueues JOBBER_WEBHOOK_RESOLVE. Respond quickly: Jobber requires a response
 * within 1 second (process asynchronously).
 */
async function onJobberWebhookReceived({ req, res }) {
    const verification = verifyJobberSignature({
        req,
        clientSecret: process.env.JOBBER_CLIENT_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[jobber-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const event = extractWebHookEvent(req.body);
    if (!event || !event.accountId) {
        console.warn(
            '[jobber-webhooks] payload missing data.webHookEvent.accountId; skipping'
        );
        res.status(200).json({ received: true, queued: false, skipped: true });
        return;
    }

    await this.queueWebhook({
        event: 'JOBBER_WEBHOOK_RESOLVE',
        body: event,
    });

    res.status(200).json({ received: true, queued: true });
}

/**
 * JOBBER_WEBHOOK_RESOLVE — worker (DB available). Maps accountId → integration,
 * then re-enqueues JOBBER_WEBHOOK bound to that integration.
 */
async function onJobberWebhookResolve({ data }) {
    const body = data && data.body;
    const accountId = body && body.accountId;
    if (!accountId) {
        console.warn(
            '[jobber-webhooks] resolve: event missing accountId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByAccountId(this, accountId);
    if (!integrationId) {
        console.warn(
            `[jobber-webhooks] resolve: no integration for accountId=${accountId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'JOBBER_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * JOBBER_WEBHOOK — worker with owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.JOBBER_WEBHOOK.
 *
 * Payload fields: topic, appId, accountId, itemId, occurredAt.
 * Fetch the object with the matching get* method using itemId.
 */
async function onJobberWebhook({ data }) {
    // no-op — override via binding.handlers.JOBBER_WEBHOOK
}

module.exports = {
    onJobberWebhookReceived,
    onJobberWebhookResolve,
    onJobberWebhook,
    extractWebHookEvent,
};
