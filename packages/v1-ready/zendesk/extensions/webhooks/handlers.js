const { verifyZendeskSignature } = require('./signature-verifier');
const { findIntegrationBySubdomain } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the Zendesk HMAC
 * signature, then enqueues ZENDESK_WEBHOOK_RESOLVE. Integration lookup needs
 * the DB and runs in the worker (same 2-hop pattern as HubSpot).
 *
 * Signing secret: prefer ZENDESK_WEBHOOK_SIGNING_SECRET env for a single
 * shared secret, or per-webhook secrets fetched via getWebhookSigningSecret.
 */
async function onZendeskWebhookReceived({ req, res }) {
    const verification = verifyZendeskSignature({
        req,
        signingSecret: process.env.ZENDESK_WEBHOOK_SIGNING_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[zendesk-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body;
    await this.queueWebhook({
        event: 'ZENDESK_WEBHOOK_RESOLVE',
        body: {
            payload: body,
            // Optional hint from query/header for multi-tenant routing.
            subdomain:
                (req.query && req.query.subdomain) ||
                (req.headers && req.headers['x-zendesk-subdomain']) ||
                null,
        },
    });

    res.status(200).json({ received: true, queued: 1 });
}

/**
 * ZENDESK_WEBHOOK_RESOLVE — worker hop with DB. Looks up subdomain →
 * integration, then re-enqueues ZENDESK_WEBHOOK bound to that id.
 */
async function onZendeskWebhookResolve({ data }) {
    const envelope = data && data.body;
    const subdomain = envelope && envelope.subdomain;
    if (!subdomain) {
        console.warn(
            '[zendesk-webhooks] resolve: missing subdomain hint; skipping. ' +
                'Pass ?subdomain= on the webhook URL or set X-Zendesk-Subdomain.'
        );
        return;
    }

    const integrationId = await findIntegrationBySubdomain(this, subdomain);
    if (!integrationId) {
        console.warn(
            `[zendesk-webhooks] resolve: no integration for subdomain=${subdomain}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'ZENDESK_WEBHOOK',
        integrationId,
        body: envelope.payload,
    });
}

/**
 * Default consumer stub. Apps override ZENDESK_WEBHOOK via binding.handlers.
 */
async function onZendeskWebhook({ data }) {
    console.log(
        '[zendesk-webhooks] ZENDESK_WEBHOOK received (no consumer bound)',
        data && data.body ? Object.keys(data.body) : null
    );
}

module.exports = {
    onZendeskWebhookReceived,
    onZendeskWebhookResolve,
    onZendeskWebhook,
};
