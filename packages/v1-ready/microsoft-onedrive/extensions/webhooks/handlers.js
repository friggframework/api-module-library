const {
    verifyGraphClientState,
    extractValidationToken,
} = require('./signature-verifier');
const { findIntegrationForNotification } = require('./lookup');

/**
 * Receiver for Graph change notifications — DB-free.
 *
 * On subscription create/renew Graph POSTs (or GETs) with `validationToken` in
 * the query string; the endpoint must echo it as plain text with 200.
 * https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
 *
 * Env: MICROSOFT_ONEDRIVE_WEBHOOK_CLIENT_STATE — must match subscription clientState.
 */
async function onOneDriveWebhookReceived({ req, res }) {
    const validationToken = extractValidationToken(req);
    if (validationToken) {
        res.status(200).type('text/plain').send(validationToken);
        return;
    }

    const verification = verifyGraphClientState({
        req,
        expectedClientState: process.env.MICROSOFT_ONEDRIVE_WEBHOOK_CLIENT_STATE,
    });
    if (!verification.valid) {
        console.warn(
            `[microsoft-onedrive-webhooks] rejecting notification: ${verification.reason}`
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
            if (!evt) {
                console.warn(
                    `[microsoft-onedrive-webhooks] notification[${i}] empty; skipping`
                );
                return 'skipped';
            }
            await this.queueWebhook({
                event: 'ONEDRIVE_WEBHOOK_RESOLVE',
                body: evt,
            });
            return 'queued';
        })
    );

    const queued = outcomes.filter((o) => o === 'queued').length;
    // 202 Accepted — Graph recommends queueing and returning within 3s.
    // After notification, call delta to discover changed items.
    res.status(202).json({
        received: notifications.length,
        queued,
        skipped: notifications.length - queued,
    });
}

/**
 * Resolve notification → owning integration, then re-enqueue ONEDRIVE_WEBHOOK.
 */
async function onOneDriveWebhookResolve({ data }) {
    const body = data && data.body;
    if (!body) {
        console.warn(
            '[microsoft-onedrive-webhooks] resolve: missing notification body; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationForNotification(this, body);
    if (!integrationId) {
        console.warn(
            `[microsoft-onedrive-webhooks] resolve: no integration for subscriptionId=${
                body.subscriptionId
            } resource=${body.resource} tenantId=${body.tenantId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'ONEDRIVE_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default consumer for a resolved OneDrive/Graph notification.
 * Override via binding.handlers.
 */
async function onOneDriveWebhook({ data }) {
    console.log(
        `[microsoft-onedrive-webhooks] ONEDRIVE_WEBHOOK changeType=${
            data && data.body && data.body.changeType
        } resource=${data && data.body && data.body.resource} subscriptionId=${
            data && data.body && data.body.subscriptionId
        }`
    );
}

module.exports = {
    onOneDriveWebhookReceived,
    onOneDriveWebhookResolve,
    onOneDriveWebhook,
};
