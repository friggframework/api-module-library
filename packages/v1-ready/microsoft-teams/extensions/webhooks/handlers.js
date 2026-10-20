const {
    extractValidationToken,
    verifyGraphClientState,
    extractTenantId,
} = require('./signature-verifier');
const { findIntegrationByTenantId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * 1. Graph subscription validation: if `validationToken` is present, echo it
 *    as text/plain 200 (no auth check — Graph is probing the URL).
 * 2. Otherwise verify every notification item's `clientState`, then enqueue
 *    one MICROSOFT_TEAMS_WEBHOOK_RESOLVE per item (tenantId → integration in
 *    the worker).
 */
async function onMicrosoftTeamsWebhookReceived({ req, res }) {
    const validationToken = extractValidationToken(req);
    if (validationToken) {
        res.status(200).type('text/plain').send(validationToken);
        return;
    }

    const expected =
        process.env.TEAMS_WEBHOOK_CLIENT_STATE ||
        process.env.MICROSOFT_TEAMS_WEBHOOK_CLIENT_STATE;
    const body = req.body;
    const verification = verifyGraphClientState({
        notification: body,
        expectedClientState: expected,
    });
    if (!verification.valid) {
        console.warn(
            `[microsoft-teams-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid clientState' });
        return;
    }

    const items = Array.isArray(body?.value)
        ? body.value
        : Array.isArray(body)
          ? body
          : body
            ? [body]
            : [];

    const outcomes = await Promise.all(
        items.map(async (evt, i) => {
            const tenantId = extractTenantId(evt);
            if (tenantId === undefined || tenantId === null) {
                console.warn(
                    `[microsoft-teams-webhooks] event[${i}] missing tenantId; skipping`
                );
                return 'skipped';
            }
            await this.queueWebhook({
                event: 'MICROSOFT_TEAMS_WEBHOOK_RESOLVE',
                body: evt,
            });
            return 'queued';
        })
    );

    const queued = outcomes.filter((o) => o === 'queued').length;
    res.status(200).json({
        received: items.length,
        queued,
        skipped: items.length - queued,
    });
}

/**
 * MICROSOFT_TEAMS_WEBHOOK_RESOLVE — worker hop with DB available.
 * Resolves tenantId → integration, then re-enqueues MICROSOFT_TEAMS_WEBHOOK.
 */
async function onMicrosoftTeamsWebhookResolve({ data }) {
    const body = data && data.body;
    const tenantId = extractTenantId(body);
    if (tenantId === undefined || tenantId === null) {
        console.warn(
            '[microsoft-teams-webhooks] resolve: event missing tenantId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByTenantId(this, tenantId);
    if (!integrationId) {
        console.warn(
            `[microsoft-teams-webhooks] resolve: no integration for tenantId=${tenantId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'MICROSOFT_TEAMS_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default consumer handler — override via binding.handlers.
 */
async function onMicrosoftTeamsWebhook({ data }) {
    console.log(
        '[microsoft-teams-webhooks] MICROSOFT_TEAMS_WEBHOOK received',
        data && data.body && data.body.subscriptionId
    );
}

module.exports = {
    onMicrosoftTeamsWebhookReceived,
    onMicrosoftTeamsWebhookResolve,
    onMicrosoftTeamsWebhook,
};
