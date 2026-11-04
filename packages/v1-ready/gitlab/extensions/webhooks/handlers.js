const { verifyGitLabWebhookSignature } = require('./signature-verifier');
const { findIntegrationByProjectId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * Verifies signing token / X-Gitlab-Token, then enqueues GITLAB_WEBHOOK_RESOLVE
 * with the payload. Project → integration lookup runs in the worker.
 */
async function onGitLabWebhookReceived({ req, res }) {
    const verification = verifyGitLabWebhookSignature({
        req,
        secret: process.env.GITLAB_WEBHOOK_SECRET,
        signingToken: process.env.GITLAB_WEBHOOK_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[gitlab-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body || {};
    const projectId =
        (body.project && body.project.id) ||
        body.project_id ||
        (body.object_attributes && body.object_attributes.project_id);

    await this.queueWebhook({
        event: 'GITLAB_WEBHOOK_RESOLVE',
        body: {
            projectId,
            objectKind: body.object_kind || body.event_type,
            event: getHeader(req.headers, 'X-Gitlab-Event'),
            raw: body,
        },
    });

    res.status(200).json({ received: true });
}

function getHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    const want = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === want) {
            const v = headers[key];
            return Array.isArray(v) ? v[0] : v;
        }
    }
    return undefined;
}

/**
 * GITLAB_WEBHOOK_RESOLVE — worker hop with DB. Looks up projectId → integration,
 * then re-enqueues GITLAB_WEBHOOK bound to that id.
 */
async function onGitLabWebhookResolve({ data }) {
    const body = data && data.body;
    const projectId = body && body.projectId;
    if (projectId === undefined || projectId === null) {
        console.warn(
            '[gitlab-webhooks] resolve: event missing projectId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByProjectId(this, projectId);
    if (!integrationId) {
        console.warn(
            `[gitlab-webhooks] resolve: no integration for projectId=${projectId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'GITLAB_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default GITLAB_WEBHOOK handler — no-op. Consumers override via
 * binding.handlers to process issue / MR / push events.
 */
async function onGitLabWebhook() {
    // intentionally empty — override in the integration binding
}

module.exports = {
    onGitLabWebhookReceived,
    onGitLabWebhookResolve,
    onGitLabWebhook,
};
