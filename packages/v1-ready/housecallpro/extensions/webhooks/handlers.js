const { verifyHousecallProSignature } = require('./signature-verifier');
const { findIntegrationByCompanyId } = require('./lookup');

/**
 * Extract the Housecall Pro public-API webhook envelope.
 * Shape (docs):
 *   { company_id, event, event_occurred_at, customer|job|invoice|… }
 */
function extractWebhookEnvelope(body) {
    if (!body || typeof body !== 'object') return null;
    if (!body.event || !body.company_id) return null;
    return body;
}

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies Api-Signature /
 * Api-Timestamp, then enqueues HOUSECALLPRO_WEBHOOK_RESOLVE.
 */
async function onHousecallProWebhookReceived({ req, res }) {
    const verification = verifyHousecallProSignature({
        req,
        signingSecret:
            process.env.HOUSECALLPRO_WEBHOOK_SECRET ||
            process.env.HOUSECALLPRO_CLIENT_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[housecallpro-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const envelope = extractWebhookEnvelope(req.body);
    if (!envelope || !envelope.company_id) {
        console.warn(
            '[housecallpro-webhooks] payload missing company_id/event; skipping'
        );
        res.status(200).json({ received: true, queued: false, skipped: true });
        return;
    }

    await this.queueWebhook({
        event: 'HOUSECALLPRO_WEBHOOK_RESOLVE',
        body: envelope,
    });

    res.status(200).json({ received: true, queued: true });
}

/**
 * HOUSECALLPRO_WEBHOOK_RESOLVE — worker (DB available). Maps company_id →
 * integration, then re-enqueues HOUSECALLPRO_WEBHOOK bound to that integration.
 */
async function onHousecallProWebhookResolve({ data }) {
    const body = data && data.body;
    const companyId = body && body.company_id;
    if (!companyId) {
        console.warn(
            '[housecallpro-webhooks] resolve: event missing company_id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByCompanyId(this, companyId);
    if (!integrationId) {
        console.warn(
            `[housecallpro-webhooks] resolve: no integration for company_id=${companyId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'HOUSECALLPRO_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * HOUSECALLPRO_WEBHOOK — worker with owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.HOUSECALLPRO_WEBHOOK.
 *
 * Payload fields: company_id, event, event_occurred_at, plus object payload
 * (customer, job, invoice, estimate, lead, appointment, …).
 */
async function onHousecallProWebhook({ data }) {
    // no-op — override via binding.handlers.HOUSECALLPRO_WEBHOOK
}

module.exports = {
    onHousecallProWebhookReceived,
    onHousecallProWebhookResolve,
    onHousecallProWebhook,
    extractWebhookEnvelope,
};
