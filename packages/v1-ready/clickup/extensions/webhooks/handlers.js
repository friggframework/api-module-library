const { verifyClickUpSignature } = require('./signature-verifier');
const { findIntegrationByTeamId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * When CLICKUP_WEBHOOK_SECRET is set, verifies X-Signature (HMAC-SHA256).
 * Per-webhook secrets from createWebhook should be verified by consumers that
 * store them; the env secret covers single-webhook / local setups.
 *
 * @see https://developer.clickup.com/docs/webhooksignature
 */
async function onClickUpWebhookReceived({ req, res }) {
    if (process.env.CLICKUP_WEBHOOK_SECRET) {
        const verification = verifyClickUpSignature({
            req,
            secret: process.env.CLICKUP_WEBHOOK_SECRET,
        });
        if (!verification.valid) {
            console.warn(
                `[clickup-webhooks] rejecting webhook: ${verification.reason}`
            );
            res.status(401).json({ error: 'invalid signature' });
            return;
        }
    }

    const body = (req && req.body) || {};
    const teamId =
        body.team_id ||
        body.teamId ||
        (body.webhook && (body.webhook.team_id || body.webhook.teamId)) ||
        null;

    await this.queueWebhook({
        event: 'CLICKUP_WEBHOOK_RESOLVE',
        body: {
            event: body.event,
            webhook_id: body.webhook_id,
            teamId,
            raw: body,
        },
    });

    res.status(200).json({ received: true });
}

/**
 * CLICKUP_WEBHOOK_RESOLVE — worker hop with DB. Looks up teamId → integration,
 * then re-enqueues CLICKUP_WEBHOOK bound to that id.
 */
async function onClickUpWebhookResolve({ data }) {
    const body = data && data.body;
    const teamId = body && body.teamId;
    if (teamId === undefined || teamId === null) {
        console.warn(
            '[clickup-webhooks] resolve: event missing teamId; skipping ' +
                `(webhook_id=${body && body.webhook_id})`
        );
        return;
    }

    const integrationId = await findIntegrationByTeamId(this, teamId);
    if (!integrationId) {
        console.warn(
            `[clickup-webhooks] resolve: no integration for teamId=${teamId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'CLICKUP_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * CLICKUP_WEBHOOK — runs in the worker with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.CLICKUP_WEBHOOK.
 */
async function onClickUpWebhook() {
    // intentionally empty — override in the integration binding
}

module.exports = {
    onClickUpWebhookReceived,
    onClickUpWebhookResolve,
    onClickUpWebhook,
};
