const { verifyGustoSignature } = require('./signature-verifier');
const { findIntegrationByCompanyUuid } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free when verification_token is provided
 * via env (GUSTO_WEBHOOK_VERIFICATION_TOKEN). Verifies X-Gusto-Signature, then
 * enqueues GUSTO_WEBHOOK_RESOLVE. Company→integration lookup needs the DB and
 * runs in the worker.
 *
 * Subscription verification POSTs (body with verification_token, no event_type)
 * are acknowledged with 200 so Gusto can complete the verify handshake; the
 * token must be persisted out-of-band and passed to verifyWebhookSubscription.
 */
async function onGustoWebhookReceived({ req, res }) {
    const body = req.body || {};

    // Subscription verification handshake — Gusto POSTs { verification_token }.
    if (body.verification_token && !body.event_type) {
        res.status(200).json({
            received: true,
            verification_token: body.verification_token,
        });
        return;
    }

    const verificationToken =
        process.env.GUSTO_WEBHOOK_VERIFICATION_TOKEN ||
        process.env.GUSTO_VERIFICATION_TOKEN;
    const verification = verifyGustoSignature({
        req,
        verificationToken,
    });
    if (!verification.valid) {
        console.warn(
            `[gusto-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const events = Array.isArray(body) ? body : [body];
    const outcomes = await Promise.all(
        events.map(async (evt, i) => {
            const companyUuid = evt && evt.resource_uuid;
            if (!companyUuid) {
                console.warn(
                    `[gusto-webhooks] event[${i}] missing resource_uuid ` +
                        `(event_type=${evt && evt.event_type}); skipping`
                );
                return 'skipped';
            }
            await this.queueWebhook({
                event: 'GUSTO_WEBHOOK_RESOLVE',
                body: evt,
            });
            return 'queued';
        })
    );

    const queued = outcomes.filter((o) => o === 'queued').length;
    res.status(200).json({
        received: events.length,
        queued,
        skipped: events.length - queued,
    });
}

/**
 * GUSTO_WEBHOOK_RESOLVE — worker hop (DB available). Looks up company UUID →
 * integration, then re-enqueues GUSTO_WEBHOOK bound to that id.
 */
async function onGustoWebhookResolve({ data }) {
    const body = data && data.body;
    const companyUuid = body && body.resource_uuid;
    if (!companyUuid) {
        console.warn(
            '[gusto-webhooks] resolve: event missing resource_uuid; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByCompanyUuid(this, companyUuid);
    if (!integrationId) {
        console.warn(
            `[gusto-webhooks] resolve: no integration for company=${companyUuid}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'GUSTO_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * GUSTO_WEBHOOK — default no-op; consumers override via binding.handlers.
 */
async function onGustoWebhook({ data }) {
    // no-op — override via binding.handlers.GUSTO_WEBHOOK
}

module.exports = {
    onGustoWebhookReceived,
    onGustoWebhookResolve,
    onGustoWebhook,
};
