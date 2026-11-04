const { verifyFactorialChallenge } = require('./signature-verifier');
const { findIntegrationByCompanyId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free when the challenge is provided via
 * env (FACTORIAL_WEBHOOK_CHALLENGE). Verifies x-factorial-wh-challenge, then
 * enqueues FACTORIAL_WEBHOOK_RESOLVE. Company→integration lookup needs the DB
 * and runs in the worker.
 *
 * Factorial payloads are the resource itself (no envelope). company_id is on
 * employee and most other resource bodies.
 *
 * @see https://apidoc.factorialhr.com/docs/payloads-event-types
 */
async function onFactorialWebhookReceived({ req, res }) {
    const challenge =
        process.env.FACTORIAL_WEBHOOK_CHALLENGE ||
        process.env.FACTORIAL_WH_CHALLENGE;
    const verification = verifyFactorialChallenge({
        req,
        challenge,
    });
    if (!verification.valid) {
        console.warn(
            `[factorial-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid challenge' });
        return;
    }

    const body = req.body || {};
    const companyId = body.company_id;
    if (companyId == null) {
        console.warn(
            '[factorial-webhooks] payload missing company_id; skipping resolve'
        );
        res.status(200).json({ received: true, queued: false });
        return;
    }

    await this.queueWebhook({
        event: 'FACTORIAL_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: true, queued: true });
}

/**
 * FACTORIAL_WEBHOOK_RESOLVE — worker hop (DB available). Looks up company_id →
 * integration, then re-enqueues FACTORIAL_WEBHOOK bound to that id.
 */
async function onFactorialWebhookResolve({ data }) {
    const body = data && data.body;
    const companyId = body && body.company_id;
    if (companyId == null) {
        console.warn(
            '[factorial-webhooks] resolve: event missing company_id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByCompanyId(this, companyId);
    if (!integrationId) {
        console.warn(
            `[factorial-webhooks] resolve: no integration for company=${companyId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'FACTORIAL_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * FACTORIAL_WEBHOOK — default no-op; consumers override via binding.handlers.
 */
async function onFactorialWebhook({ data }) {
    // no-op — override via binding.handlers.FACTORIAL_WEBHOOK
}

module.exports = {
    onFactorialWebhookReceived,
    onFactorialWebhookResolve,
    onFactorialWebhook,
};
