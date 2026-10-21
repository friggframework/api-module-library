const { findIntegrationBySubdomain } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * Gorgias delivers ticket lifecycle events through HTTP Integrations
 * (type: "http") configured via POST /api/integrations. The integration can
 * POST to this route; we expect an `account` / `subdomain` query param (or
 * body field) so the worker can resolve the owning Frigg integration.
 *
 * Official docs do not document a request-signature header for HTTP
 * integrations; verification is therefore not applied here (open question).
 */
async function onGorgiasWebhookReceived({ req, res }) {
    const body = req.body;
    const subdomain =
        (req.query && (req.query.account || req.query.subdomain)) ||
        (body && (body.account || body.subdomain || body.domain)) ||
        null;

    if (!subdomain) {
        console.warn(
            '[gorgias-webhooks] rejecting webhook: missing account/subdomain'
        );
        res.status(400).json({ error: 'missing account/subdomain' });
        return;
    }

    await this.queueWebhook({
        event: 'GORGIAS_WEBHOOK_RESOLVE',
        body: {
            subdomain: String(subdomain),
            payload: body,
            headers: req.headers,
        },
    });

    res.status(200).json({ received: true, queued: 1 });
}

/**
 * GORGIAS_WEBHOOK_RESOLVE — worker hop with DB. Looks up subdomain →
 * integration, then re-enqueues GORGIAS_WEBHOOK bound to that id.
 */
async function onGorgiasWebhookResolve({ data }) {
    const body = data && data.body;
    const subdomain = body && body.subdomain;
    if (!subdomain) {
        console.warn(
            '[gorgias-webhooks] resolve: event missing subdomain; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationBySubdomain(this, subdomain);
    if (!integrationId) {
        console.warn(
            `[gorgias-webhooks] resolve: no integration for subdomain=${subdomain}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'GORGIAS_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * GORGIAS_WEBHOOK — hydrated integration. Default no-op; consumers override
 * via binding.handlers.GORGIAS_WEBHOOK.
 */
async function onGorgiasWebhook({ data }) {
    // no-op — override via binding.handlers.GORGIAS_WEBHOOK
}

module.exports = {
    onGorgiasWebhookReceived,
    onGorgiasWebhookResolve,
    onGorgiasWebhook,
};
