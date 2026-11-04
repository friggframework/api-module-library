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
 *    one MICROSOFT_OUTLOOK_WEBHOOK_RESOLVE per item (tenantId → integration in
 *    the worker).
 */
async function onMicrosoftOutlookWebhookReceived({ req, res }) {
    const validationToken = extractValidationToken(req);
    if (validationToken) {
        res.status(200).type('text/plain').send(validationToken);
        return;
    }

    const expected =
        process.env.OUTLOOK_WEBHOOK_CLIENT_STATE ||
        process.env.MICROSOFT_OUTLOOK_WEBHOOK_CLIENT_STATE;
    const body = req.body;
    const verification = verifyGraphClientState({
        notification: body,
        expectedClientState: expected,
    });
    if (!verification.valid) {
        console.warn(
            `[microsoft-outlook-webhooks] rejecting webhook: ${verification.reason}`
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
                    `[microsoft-outlook-webhooks] event[${i}] missing tenantId; skipping`
                );
                return 'skipped';
            }
            await this.queueWebhook({
                event: 'MICROSOFT_OUTLOOK_WEBHOOK_RESOLVE',
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
 * MICROSOFT_OUTLOOK_WEBHOOK_RESOLVE — worker hop with DB available.
 * Resolves tenantId → integration, then re-enqueues MICROSOFT_OUTLOOK_WEBHOOK.
 */
async function onMicrosoftOutlookWebhookResolve({ data }) {
    const body = data && data.body;
    const tenantId = extractTenantId(body);
    if (tenantId === undefined || tenantId === null) {
        console.warn(
            '[microsoft-outlook-webhooks] resolve: event missing tenantId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByTenantId(this, tenantId);
    if (!integrationId) {
        console.warn(
            `[microsoft-outlook-webhooks] resolve: no integration for tenantId=${tenantId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'MICROSOFT_OUTLOOK_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default consumer handler — override via binding.handlers.
 */
async function onMicrosoftOutlookWebhook({ data }) {
    console.log(
        '[microsoft-outlook-webhooks] MICROSOFT_OUTLOOK_WEBHOOK received',
        data && data.body && data.body.subscriptionId
    );
}

module.exports = {
    onMicrosoftOutlookWebhookReceived,
    onMicrosoftOutlookWebhookResolve,
    onMicrosoftOutlookWebhook,
};
