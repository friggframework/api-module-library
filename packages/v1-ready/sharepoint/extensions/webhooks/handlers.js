const { verifyGraphClientState, extractValidationToken } = require('./signature-verifier');
const { findIntegrationByTenantId } = require('./lookup');

/**
 * Receiver for Graph change notifications — DB-free.
 *
 * On subscription create/renew Graph POSTs (or GETs) with `validationToken` in
 * the query string; the endpoint must echo it as plain text with 200.
 * https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
 *
 * Env: SHAREPOINT_WEBHOOK_CLIENT_STATE — must match subscription clientState.
 */
async function onSharePointWebhookReceived({ req, res }) {
    const validationToken = extractValidationToken(req);
    if (validationToken) {
        res.status(200).type('text/plain').send(validationToken);
        return;
    }

    const verification = verifyGraphClientState({
        req,
        expectedClientState: process.env.SHAREPOINT_WEBHOOK_CLIENT_STATE,
    });
    if (!verification.valid) {
        console.warn(
            `[sharepoint-webhooks] rejecting notification: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid clientState' });
        return;
    }

    const notifications = Array.isArray(req.body?.value) ? req.body.value : [];
    if (notifications.length === 0) {
        res.status(202).json({ received: 0, queued: 0, skipped: 0 });
        return;
    }

    const outcomes = await Promise.all(
        notifications.map(async (evt, i) => {
            const tenantId = evt && evt.tenantId;
            if (!tenantId) {
                console.warn(
                    `[sharepoint-webhooks] notification[${i}] missing tenantId; skipping`
                );
                return 'skipped';
            }
            await this.queueWebhook({
                event: 'SHAREPOINT_WEBHOOK_RESOLVE',
                body: evt,
            });
            return 'queued';
        })
    );

    const queued = outcomes.filter((o) => o === 'queued').length;
    // 202 Accepted — Graph recommends queueing and returning within 3s.
    res.status(202).json({
        received: notifications.length,
        queued,
        skipped: notifications.length - queued,
    });
}

/**
 * Resolve tenantId → owning integration, then re-enqueue SHAREPOINT_WEBHOOK.
 * Entity externalId is the organization id when available (see definition.js).
 */
async function onSharePointWebhookResolve({ data }) {
    const body = data && data.body;
    const tenantId = body && body.tenantId;
    if (!tenantId) {
        console.warn(
            '[sharepoint-webhooks] resolve: notification missing tenantId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByTenantId(this, tenantId);
    if (!integrationId) {
        console.warn(
            `[sharepoint-webhooks] resolve: no integration for tenantId=${tenantId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'SHAREPOINT_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default consumer for a resolved SharePoint/Graph notification.
 * Override via binding.handlers.
 */
async function onSharePointWebhook({ data }) {
    console.log(
        `[sharepoint-webhooks] SHAREPOINT_WEBHOOK changeType=${
            data && data.body && data.body.changeType
        } resource=${data && data.body && data.body.resource} tenantId=${
            data && data.body && data.body.tenantId
        }`
    );
}

module.exports = {
    onSharePointWebhookReceived,
    onSharePointWebhookResolve,
    onSharePointWebhook,
};
