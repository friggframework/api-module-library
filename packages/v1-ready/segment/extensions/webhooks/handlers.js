const { verifySegmentSignature } = require('./signature-verifier');
const { findIntegrationBySegmentTenant } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies X-Signature (HMAC-SHA1),
 * then enqueues SEGMENT_WEBHOOK_RESOLVE. Segment Webhooks (Actions) send one
 * event object per delivery (or a batch when batching is enabled).
 *
 * Docs: https://www.twilio.com/docs/segment/connections/destinations/catalog/actions-webhook
 */
async function onSegmentWebhookReceived({ req, res }) {
    const verification = verifySegmentSignature({
        req,
        secret: process.env.SEGMENT_WEBHOOK_SHARED_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[segment-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body;
    const events = Array.isArray(body) ? body : body ? [body] : [];

    const outcomes = await Promise.all(
        events.map(async (evt) => {
            await this.queueWebhook({
                event: 'SEGMENT_WEBHOOK_RESOLVE',
                body: evt,
                meta: {
                    type: evt && evt.type,
                    messageId: evt && evt.messageId,
                    workspaceId:
                        (req.headers &&
                            (req.headers['x-segment-workspace-id'] ||
                                req.headers['X-Segment-Workspace-Id'])) ||
                        (evt && evt.workspaceId) ||
                        (evt && evt.context && evt.context.workspaceId) ||
                        null,
                    writeKey: (evt && evt.writeKey) || null,
                },
            });
            return 'queued';
        })
    );

    res.status(200).json({
        received: events.length,
        queued: outcomes.length,
    });
}

/**
 * SEGMENT_WEBHOOK_RESOLVE — worker hop with DB. Looks up workspaceId / writeKey
 * → owning integration, then re-enqueues SEGMENT_WEBHOOK bound to that id.
 */
async function onSegmentWebhookResolve({ data }) {
    const body = data && data.body;
    const meta = (data && data.meta) || {};
    const workspaceId =
        meta.workspaceId ||
        (body && body.workspaceId) ||
        (body && body.context && body.context.workspaceId);
    const writeKey = meta.writeKey || (body && body.writeKey);

    if (!workspaceId && !writeKey) {
        console.warn(
            '[segment-webhooks] resolve: event missing workspaceId and writeKey; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationBySegmentTenant(this, {
        workspaceId,
        writeKey,
    });
    if (!integrationId) {
        console.warn(
            `[segment-webhooks] resolve: no integration for workspaceId=${workspaceId} writeKey=${writeKey ? '[set]' : '[missing]'}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'SEGMENT_WEBHOOK',
        integrationId,
        body,
        meta,
    });
}

/**
 * SEGMENT_WEBHOOK — runs with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.SEGMENT_WEBHOOK.
 */
async function onSegmentWebhook({ data }) {
    void data;
}

module.exports = {
    onSegmentWebhookReceived,
    onSegmentWebhookResolve,
    onSegmentWebhook,
};
