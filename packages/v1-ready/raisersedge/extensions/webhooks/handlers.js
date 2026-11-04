const {
    verifyOptionsHandshake,
    verifyWebhookKey,
    EXPECTED_ORIGIN,
} = require('./signature-verifier');
const {
    findIntegrationByEnvironmentId,
    findIntegrationBySubscriptionId,
} = require('./lookup');

/**
 * Extract environment_id / subscription id hints from a Blackbaud CloudEvents
 * delivery. Official event payloads vary by type; common fields live on
 * `data` and top-level Event Grid envelope properties.
 *
 * @see https://developer.blackbaud.com/skyapi/docs/webhooks
 */
function extractRoutingHints(body) {
    const events = Array.isArray(body) ? body : body ? [body] : [];
    for (const event of events) {
        if (!event || typeof event !== 'object') continue;
        const data =
            typeof event.data === 'string'
                ? safeJsonParse(event.data)
                : event.data || {};
        const environmentId =
            data.environment_id ||
            event.environment_id ||
            data.environmentId ||
            null;
        const subscriptionId =
            data.id ||
            event.subscription_id ||
            extractSubscriptionIdFromPath(data.eventSubscriptionId) ||
            null;
        if (environmentId || subscriptionId) {
            return { environmentId, subscriptionId, event };
        }
    }
    return { environmentId: null, subscriptionId: null, event: events[0] };
}

function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}

function extractSubscriptionIdFromPath(path) {
    if (!path || typeof path !== 'string') return null;
    const parts = path.split('/');
    const idx = parts.lastIndexOf('eventSubscriptions');
    if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    return null;
}

/**
 * OPTIONS /webhooks — CloudEvents Abuse Protection handshake required before
 * a subscription reaches Provisioned state.
 */
async function onRaisersEdgeWebhookOptions({ req, res }) {
    const verification = verifyOptionsHandshake({ req });
    if (!verification.valid) {
        console.warn(
            `[raisersedge-webhooks] rejecting OPTIONS: ${verification.reason}`
        );
        res.status(400).json({ error: verification.reason });
        return;
    }
    res.set('WebHook-Allowed-Origin', EXPECTED_ORIGIN);
    res.status(200).end();
}

/**
 * Receiver for `POST /webhooks` — DB-free. Optionally checks webhookKey, then
 * enqueues RAISERSEDGE_WEBHOOK_RESOLVE.
 */
async function onRaisersEdgeWebhookReceived({ req, res }) {
    const keyCheck = verifyWebhookKey({ req });
    if (!keyCheck.valid) {
        console.warn(
            `[raisersedge-webhooks] rejecting webhook: ${keyCheck.reason}`
        );
        res.status(401).json({ error: 'invalid webhook key' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const hints = extractRoutingHints(body);

    if (!hints.environmentId && !hints.subscriptionId) {
        console.warn(
            '[raisersedge-webhooks] event missing environment_id/subscription id; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'RAISERSEDGE_WEBHOOK_RESOLVE',
        body,
        hints,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * RAISERSEDGE_WEBHOOK_RESOLVE — queue worker (DB available). Looks up
 * environment_id (preferred) or subscription id → owning integration, then
 * re-enqueues RAISERSEDGE_WEBHOOK bound to that id.
 */
async function onRaisersEdgeWebhookResolve({ data }) {
    const body = data && data.body;
    if (!body) {
        console.warn('[raisersedge-webhooks] resolve: missing body; skipping');
        return;
    }

    const hints = data.hints || extractRoutingHints(body);

    let integrationId = null;
    if (hints.environmentId) {
        integrationId = await findIntegrationByEnvironmentId(
            this,
            hints.environmentId
        );
    }
    if (!integrationId && hints.subscriptionId) {
        integrationId = await findIntegrationBySubscriptionId(
            this,
            hints.subscriptionId
        );
    }

    if (!integrationId) {
        console.warn(
            `[raisersedge-webhooks] resolve: no integration for environment_id=${hints.environmentId} subscription_id=${hints.subscriptionId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'RAISERSEDGE_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * RAISERSEDGE_WEBHOOK — worker with owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.RAISERSEDGE_WEBHOOK.
 */
async function onRaisersEdgeWebhook({ data }) {
    // no-op — override via binding.handlers.RAISERSEDGE_WEBHOOK
}

module.exports = {
    onRaisersEdgeWebhookOptions,
    onRaisersEdgeWebhookReceived,
    onRaisersEdgeWebhookResolve,
    onRaisersEdgeWebhook,
    extractRoutingHints,
};
