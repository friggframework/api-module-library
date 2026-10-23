const { verifyHiBobSignature, isPingTest } = require('./signature-verifier');
const { findIntegrationByCompanyId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Handles Bob's ping check, verifies
 * the Bob-Signature HMAC, then enqueues HIBOB_WEBHOOK_RESOLVE carrying the
 * event (incl. companyId). Tenant lookup needs the DB and runs in the worker.
 */
async function onHiBobWebhookReceived({ req, res }) {
    if (isPingTest(req)) {
        res.status(200).json({ ok: true, ping: true });
        return;
    }

    const secretEnv = process.env.HIBOB_WEBHOOK_SIGNING_SECRET || '';
    const verification = verifyHiBobSignature({
        req,
        secret: secretEnv,
    });
    if (!verification.valid) {
        console.warn(
            `[hibob-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : null;
    const companyId = body && (body.companyId ?? body.company_id);
    if (companyId === undefined || companyId === null || companyId === '') {
        console.warn('[hibob-webhooks] event missing companyId; skipping');
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'HIBOB_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * HIBOB_WEBHOOK_RESOLVE — worker hop with DB. Maps companyId → integration,
 * then re-enqueues HIBOB_WEBHOOK bound to that id.
 */
async function onHiBobWebhookResolve({ data }) {
    const body = data && data.body;
    const companyId = body && (body.companyId ?? body.company_id);
    if (companyId === undefined || companyId === null || companyId === '') {
        console.warn(
            '[hibob-webhooks] resolve: event missing companyId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByCompanyId(this, companyId);
    if (!integrationId) {
        console.warn(
            `[hibob-webhooks] resolve: no integration for companyId=${companyId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'HIBOB_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * HIBOB_WEBHOOK — runs with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.HIBOB_WEBHOOK.
 */
async function onHiBobWebhook({ data }) {
    // no-op — override via binding.handlers.HIBOB_WEBHOOK
}

module.exports = {
    onHiBobWebhookReceived,
    onHiBobWebhookResolve,
    onHiBobWebhook,
};
