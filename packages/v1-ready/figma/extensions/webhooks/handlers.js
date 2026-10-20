const { verifyFigmaPasscode } = require('./passcode-verifier');
const { findIntegrationByFigmaUserId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the Figma passcode in the
 * JSON body, then enqueues FIGMA_WEBHOOK_RESOLVE. Integration lookup needs the
 * DB and runs in the worker.
 *
 * Expected env: FIGMA_WEBHOOK_PASSCODE (must match the passcode used when
 * creating webhooks via postWebhook).
 */
async function onFigmaWebhookReceived({ req, res }) {
    const verification = verifyFigmaPasscode({
        body: req.body,
        expectedPasscode: process.env.FIGMA_WEBHOOK_PASSCODE,
    });
    if (!verification.valid) {
        console.warn(
            `[figma-webhooks] rejecting webhook: ${verification.reason}`
        );
        // Figma docs: respond 400 on wrong passcode to stop the webhook.
        res.status(400).json({ error: 'invalid passcode' });
        return;
    }

    const body = req.body || {};
    await this.queueWebhook({
        event: 'FIGMA_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1 });
}

/**
 * FIGMA_WEBHOOK_RESOLVE — worker hop. Resolves the owning integration when
 * `body.figma_user_id` (or `body.externalId`) is present. Figma's native
 * payloads do not include the authorizing user id; integrations that need
 * multi-tenant routing should stamp `figma_user_id` onto the stored webhook
 * mapping (or use a per-tenant endpoint / passcode). Without it we skip.
 */
async function onFigmaWebhookResolve({ data }) {
    const body = data && data.body;
    const externalId =
        (body && (body.figma_user_id || body.externalId)) || null;
    if (externalId === undefined || externalId === null) {
        console.warn(
            '[figma-webhooks] resolve: event missing figma_user_id/externalId; ' +
                'skipping tenant binding (override FIGMA_WEBHOOK via binding.handlers ' +
                'or stamp figma_user_id when registering webhooks)'
        );
        // Still deliver unbound for single-tenant adopters who override the handler.
        await this.queueWebhook({
            event: 'FIGMA_WEBHOOK',
            body,
        });
        return;
    }

    const integrationId = await findIntegrationByFigmaUserId(this, externalId);
    if (!integrationId) {
        console.warn(
            `[figma-webhooks] resolve: no integration for figma_user_id=${externalId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'FIGMA_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * FIGMA_WEBHOOK — default no-op; consumers override via binding.handlers.
 */
async function onFigmaWebhook({ data }) {
    // no-op — override via binding.handlers.FIGMA_WEBHOOK
}

module.exports = {
    onFigmaWebhookReceived,
    onFigmaWebhookResolve,
    onFigmaWebhook,
};
