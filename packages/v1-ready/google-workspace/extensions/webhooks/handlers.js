const { verifyGoogleChannelToken } = require('./signature-verifier');
const { findIntegrationForNotification } = require('./lookup');

/**
 * Receiver for Google Drive / Calendar push notifications — DB-free.
 *
 * Notifications are POST requests with an empty body and X-Goog-* headers.
 * Respond quickly (200–204 / 202) then resolve ownership in a worker.
 *
 * Env: GOOGLE_WORKSPACE_WEBHOOK_CHANNEL_TOKEN — optional; when set must match
 * the channel token used on watch requests.
 *
 * Docs:
 *   https://developers.google.com/workspace/drive/api/guides/push
 *   https://developers.google.com/workspace/calendar/api/guides/push
 */
async function onGoogleWorkspaceWebhookReceived({ req, res }) {
    const verification = verifyGoogleChannelToken({
        req,
        expectedChannelToken:
            process.env.GOOGLE_WORKSPACE_WEBHOOK_CHANNEL_TOKEN,
    });

    if (!verification.valid) {
        console.warn(
            `[google-workspace-webhooks] rejecting notification: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid google push notification' });
        return;
    }

    const headers = verification.headers;
    // sync is the channel-created handshake; still enqueue so consumers can
    // initialize, but always ACK quickly.
    await this.queueWebhook({
        event: 'GOOGLE_WORKSPACE_WEBHOOK_RESOLVE',
        body: headers,
    });

    res.status(202).json({
        received: 1,
        queued: 1,
        resourceState: headers.resourceState,
    });
}

/**
 * Resolve notification → owning integration, then re-enqueue GOOGLE_WORKSPACE_WEBHOOK.
 */
async function onGoogleWorkspaceWebhookResolve({ data }) {
    const body = data && data.body;
    if (!body) {
        console.warn(
            '[google-workspace-webhooks] resolve: missing notification body; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationForNotification(this, body);
    if (!integrationId) {
        console.warn(
            `[google-workspace-webhooks] resolve: no integration for channelId=${
                body.channelId
            } resourceId=${body.resourceId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'GOOGLE_WORKSPACE_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default consumer for a resolved Google Workspace push notification.
 * Override via binding.handlers.
 *
 * Push notifications do not include resource metadata — call files.get /
 * changes.list / events.list after receiving.
 */
async function onGoogleWorkspaceWebhook({ data }) {
    console.log(
        `[google-workspace-webhooks] GOOGLE_WORKSPACE_WEBHOOK resourceState=${
            data && data.body && data.body.resourceState
        } channelId=${data && data.body && data.body.channelId} resourceId=${
            data && data.body && data.body.resourceId
        }`
    );
}

module.exports = {
    onGoogleWorkspaceWebhookReceived,
    onGoogleWorkspaceWebhookResolve,
    onGoogleWorkspaceWebhook,
};
