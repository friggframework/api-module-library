const { verifyPandaDocSignature } = require('./signature-verifier');
const { findIntegrationByWorkspaceId } = require('./lookup');

/**
 * Resolve the PandaDoc workspace id for reverse lookup.
 * Prefer an explicit query/path value that the subscription URL was
 * registered with; document event bodies do not carry workspace_id.
 */
function resolveWorkspaceId(req, body) {
    if (req && req.query && req.query.workspace_id) {
        return String(req.query.workspace_id);
    }
    if (req && req.params && req.params.workspaceId) {
        return String(req.params.workspaceId);
    }
    if (Array.isArray(body) && body[0] && body[0].data) {
        const data = body[0].data;
        if (data.workspace_id) return String(data.workspace_id);
        if (data.workspace) return String(data.workspace);
    }
    return null;
}

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the HMAC-SHA256
 * signature (?signature=), then enqueues one PANDADOC_WEBHOOK_RESOLVE per
 * event in the JSON array payload.
 */
async function onPandaDocWebhookReceived({ req, res }) {
    const sharedKey =
        process.env.PANDADOC_WEBHOOK_SHARED_KEY ||
        process.env.PANDADOC_CLIENT_SECRET;
    const verification = verifyPandaDocSignature({ req, sharedKey });
    if (!verification.valid) {
        console.warn(
            `[pandadoc-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const events = Array.isArray(req.body) ? req.body : [];
    const workspaceId = resolveWorkspaceId(req, events);

    const outcomes = await Promise.all(
        events.map(async (evt, i) => {
            if (!evt || !evt.event) {
                console.warn(
                    `[pandadoc-webhooks] event[${i}] missing event type; skipping`
                );
                return 'skipped';
            }
            await this.queueWebhook({
                event: 'PANDADOC_WEBHOOK_RESOLVE',
                body: {
                    ...evt,
                    // Carry the workspace id resolved from the URL so the
                    // worker can reverse-look up without re-reading the request.
                    _workspace_id: workspaceId,
                },
            });
            return 'queued';
        })
    );

    const queued = outcomes.filter((o) => o === 'queued').length;
    res.status(200).json({
        received: events.length,
        queued,
        skipped: events.length - queued,
    });
}

/**
 * PANDADOC_WEBHOOK_RESOLVE — runs in the queue worker (DB available).
 * Reverse-looks up workspace id → owning integration, then re-enqueues
 * PANDADOC_WEBHOOK bound to that id.
 */
async function onPandaDocWebhookResolve({ data }) {
    const body = data && data.body;
    const workspaceId = body && body._workspace_id;
    if (!workspaceId) {
        console.warn(
            '[pandadoc-webhooks] resolve: missing workspace_id on payload; skipping. Register the subscription URL with ?workspace_id=<id>.'
        );
        return;
    }

    const integrationId = await findIntegrationByWorkspaceId(
        this,
        workspaceId
    );
    if (!integrationId) {
        console.warn(
            `[pandadoc-webhooks] resolve: no integration for workspace_id=${workspaceId}; skipping`
        );
        return;
    }

    const { _workspace_id, ...eventBody } = body;
    await this.queueWebhook({
        event: 'PANDADOC_WEBHOOK',
        integrationId,
        body: eventBody,
    });
}

/**
 * PANDADOC_WEBHOOK — runs in the worker with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.PANDADOC_WEBHOOK.
 */
async function onPandaDocWebhook({ data }) {
    // no-op — override via binding.handlers.PANDADOC_WEBHOOK
}

module.exports = {
    onPandaDocWebhookReceived,
    onPandaDocWebhookResolve,
    onPandaDocWebhook,
    resolveWorkspaceId,
};
