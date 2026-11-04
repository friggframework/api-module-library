const { verifyNotionSignature } = require('./signature-verifier');
const { findIntegrationByWorkspaceId } = require('./lookup');

/**
 * Receiver for POST /webhooks — DB-free.
 *
 * Notion first POSTs `{ verification_token }` when a subscription is created
 * (no signature). We acknowledge that so the developer can paste the token
 * into the Notion UI / env. Subsequent event deliveries carry
 * X-Notion-Signature and are verified with NOTION_WEBHOOK_VERIFICATION_TOKEN,
 * then enqueued for workspace_id → integration resolve.
 *
 * @see https://developers.notion.com/reference/webhooks
 */
async function onNotionWebhookReceived({ req, res }) {
    const body = req.body || {};

    // Subscription verification handshake (unsigned).
    if (body.verification_token && !body.type) {
        console.info(
            '[notion-webhooks] received subscription verification_token; ' +
                'store it as NOTION_WEBHOOK_VERIFICATION_TOKEN and paste it into the Notion UI to verify.'
        );
        res.status(200).json({
            ok: true,
            verification_token_received: true,
        });
        return;
    }

    const verification = verifyNotionSignature({
        req,
        verificationToken: process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN,
    });
    if (!verification.valid) {
        console.warn(
            `[notion-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const events = Array.isArray(body) ? body : [body];
    const outcomes = await Promise.all(
        events.map(async (evt, i) => {
            const workspaceId = evt && evt.workspace_id;
            if (workspaceId === undefined || workspaceId === null) {
                console.warn(
                    `[notion-webhooks] event[${i}] missing workspace_id ` +
                        `(type=${evt && evt.type}); skipping`
                );
                return 'skipped';
            }
            await this.queueWebhook({
                event: 'NOTION_WEBHOOK_RESOLVE',
                body: evt,
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
 * NOTION_WEBHOOK_RESOLVE — worker hop with DB. Looks up workspace_id →
 * integration, then re-enqueues NOTION_WEBHOOK bound to that id.
 */
async function onNotionWebhookResolve({ data }) {
    const body = data && data.body;
    const workspaceId = body && body.workspace_id;
    if (workspaceId === undefined || workspaceId === null) {
        console.warn(
            '[notion-webhooks] resolve: event missing workspace_id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByWorkspaceId(
        this,
        workspaceId
    );
    if (!integrationId) {
        console.warn(
            `[notion-webhooks] resolve: no integration for workspace_id=${workspaceId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'NOTION_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * NOTION_WEBHOOK — runs with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.NOTION_WEBHOOK.
 */
async function onNotionWebhook({ data }) {
    // no-op — override via binding.handlers.NOTION_WEBHOOK
}

module.exports = {
    onNotionWebhookReceived,
    onNotionWebhookResolve,
    onNotionWebhook,
};
