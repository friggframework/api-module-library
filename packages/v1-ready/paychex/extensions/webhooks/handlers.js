const { verifyPaychexApiKeyDelivery } = require('./signature-verifier');
const { findIntegrationByCompanyId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free when verification uses env
 * PAYCHEX_WEBHOOK_API_KEY (APIKEY subscription auth). When that env is unset,
 * deliveries are accepted (NO_AUTH mode per Paychex docs) and queued.
 *
 * Notification payload (example from official docs):
 *   { companyId, workerId?, asOfDate, domains[], action, notificationId }
 */
async function onPaychexWebhookReceived({ req, res }) {
    const expectedApiKey = process.env.PAYCHEX_WEBHOOK_API_KEY;
    if (expectedApiKey) {
        const verification = verifyPaychexApiKeyDelivery({
            headers: req.headers || {},
            expectedApiKey,
        });
        if (!verification.valid) {
            console.warn(
                `[paychex-webhooks] rejecting webhook: ${verification.reason}`
            );
            res.status(401).json({ error: 'invalid webhook authentication' });
            return;
        }
    }

    const body = req.body || {};
    const events = Array.isArray(body) ? body : [body];
    const outcomes = await Promise.all(
        events.map(async (evt, i) => {
            const companyId = evt && evt.companyId;
            if (!companyId) {
                console.warn(
                    `[paychex-webhooks] event[${i}] missing companyId ` +
                        `(domains=${JSON.stringify(evt && evt.domains)}); skipping`
                );
                return 'skipped';
            }
            await this.queueWebhook({
                event: 'PAYCHEX_WEBHOOK_RESOLVE',
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
 * PAYCHEX_WEBHOOK_RESOLVE — worker hop (DB available). Looks up companyId →
 * integration, then re-enqueues PAYCHEX_WEBHOOK bound to that id.
 */
async function onPaychexWebhookResolve({ data }) {
    const body = data && data.body;
    const companyId = body && body.companyId;
    if (!companyId) {
        console.warn(
            '[paychex-webhooks] resolve: event missing companyId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByCompanyId(this, companyId);
    if (!integrationId) {
        console.warn(
            `[paychex-webhooks] resolve: no integration for company=${companyId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'PAYCHEX_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * PAYCHEX_WEBHOOK — default no-op; consumers override via binding.handlers.
 */
async function onPaychexWebhook({ data }) {
    // no-op — override via binding.handlers.PAYCHEX_WEBHOOK
}

module.exports = {
    onPaychexWebhookReceived,
    onPaychexWebhookResolve,
    onPaychexWebhook,
};
