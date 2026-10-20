const { verifyJiraWebhookSignature } = require('./signature-verifier');
const { findIntegrationByCloudId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the OAuth dynamic webhook
 * JWT, then enqueues JIRA_WEBHOOK_RESOLVE. It does NOT resolve the owning
 * integration — that needs the DB and happens in the worker.
 */
async function onJiraWebhookReceived({ req, res }) {
    const verification = verifyJiraWebhookSignature({
        req,
        clientSecret: process.env.JIRA_CLIENT_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[jira-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body || {};
    const cloudId =
        (req.query && (req.query.cloudId || req.query.cloud_id)) ||
        body.cloudId ||
        body.cloud_id ||
        (verification.payload &&
            (verification.payload.cloudId || verification.payload.cloud_id)) ||
        null;

    await this.queueWebhook({
        event: 'JIRA_WEBHOOK_RESOLVE',
        body: {
            event: body,
            cloudId,
            webhookEvent: body.webhookEvent || body.issue_event_type_name,
            raw: body,
        },
    });

    res.status(200).json({ received: true });
}

/**
 * JIRA_WEBHOOK_RESOLVE — worker hop with DB. Looks up cloudId → integration,
 * then re-enqueues JIRA_WEBHOOK bound to that id.
 */
async function onJiraWebhookResolve({ data }) {
    const body = data && data.body;
    const cloudId = body && body.cloudId;
    if (cloudId === undefined || cloudId === null) {
        console.warn(
            '[jira-webhooks] resolve: event missing cloudId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByCloudId(this, cloudId);
    if (!integrationId) {
        console.warn(
            `[jira-webhooks] resolve: no integration for cloudId=${cloudId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'JIRA_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default JIRA_WEBHOOK handler — no-op. Consumers override via
 * binding.handlers to process issue/comment events.
 */
async function onJiraWebhook() {
    // intentionally empty — override in the integration binding
}

module.exports = {
    onJiraWebhookReceived,
    onJiraWebhookResolve,
    onJiraWebhook,
};
