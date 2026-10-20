const { verifyPersonioSignature } = require('./signature-verifier');
const { findIntegrationByCompanyId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the Personio HMAC, then
 * enqueues PERSONIO_WEBHOOK_RESOLVE carrying the event (incl. company_id).
 * Tenant lookup needs the DB and runs in the worker.
 */
async function onPersonioWebhookReceived({ req, res }) {
    const secretEnv = process.env.PERSONIO_WEBHOOK_SIGNING_SECRET || '';
    const verification = verifyPersonioSignature({
        req,
        secret: secretEnv,
    });
    if (!verification.valid) {
        console.warn(
            `[personio-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : null;
    const companyId = body && body.company_id;
    if (companyId === undefined || companyId === null || companyId === '') {
        console.warn(
            '[personio-webhooks] event missing company_id; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'PERSONIO_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * PERSONIO_WEBHOOK_RESOLVE — worker hop with DB. Maps company_id → integration,
 * then re-enqueues PERSONIO_WEBHOOK bound to that id.
 */
async function onPersonioWebhookResolve({ data }) {
    const body = data && data.body;
    const companyId = body && body.company_id;
    if (companyId === undefined || companyId === null || companyId === '') {
        console.warn(
            '[personio-webhooks] resolve: event missing company_id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByCompanyId(this, companyId);
    if (!integrationId) {
        console.warn(
            `[personio-webhooks] resolve: no integration for company_id=${companyId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'PERSONIO_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * PERSONIO_WEBHOOK — runs with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.PERSONIO_WEBHOOK.
 */
async function onPersonioWebhook({ data }) {
    // no-op — override via binding.handlers.PERSONIO_WEBHOOK
}

module.exports = {
    onPersonioWebhookReceived,
    onPersonioWebhookResolve,
    onPersonioWebhook,
};
