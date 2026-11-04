const { verifyTriNetSignature } = require('./signature-verifier');
const { findIntegrationByCompanyId } = require('./lookup');

/**
 * Extract company id from a TriNet webhook payload.
 * Event bodies nest the company under `data.company.id`.
 */
function companyIdFromBody(body) {
    if (!body || typeof body !== 'object') return null;
    const nested = body.data && body.data.company && body.data.company.id;
    if (nested !== undefined && nested !== null && nested !== '') {
        return nested;
    }
    if (body.company && body.company.id) return body.company.id;
    return null;
}

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the TriNet Signature HMAC,
 * then enqueues TRINET_WEBHOOK_RESOLVE carrying the event (incl. company id).
 * Tenant lookup needs the DB and runs in the worker.
 */
async function onTriNetWebhookReceived({ req, res }) {
    const secretEnv = process.env.TRINET_WEBHOOK_SHARED_SECRET || '';
    const verification = verifyTriNetSignature({
        req,
        secret: secretEnv,
    });
    if (!verification.valid) {
        console.warn(
            `[trinet-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : null;
    const companyId = companyIdFromBody(body);
    if (companyId === undefined || companyId === null || companyId === '') {
        console.warn(
            '[trinet-webhooks] event missing data.company.id; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'TRINET_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * TRINET_WEBHOOK_RESOLVE — worker hop with DB. Maps company id → integration,
 * then re-enqueues TRINET_WEBHOOK bound to that id.
 */
async function onTriNetWebhookResolve({ data }) {
    const body = data && data.body;
    const companyId = companyIdFromBody(body);
    if (companyId === undefined || companyId === null || companyId === '') {
        console.warn(
            '[trinet-webhooks] resolve: event missing data.company.id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByCompanyId(this, companyId);
    if (!integrationId) {
        console.warn(
            `[trinet-webhooks] resolve: no integration for company_id=${companyId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'TRINET_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * TRINET_WEBHOOK — runs with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.TRINET_WEBHOOK.
 */
async function onTriNetWebhook({ data }) {
    // no-op — override via binding.handlers.TRINET_WEBHOOK
}

module.exports = {
    onTriNetWebhookReceived,
    onTriNetWebhookResolve,
    onTriNetWebhook,
    companyIdFromBody,
};
