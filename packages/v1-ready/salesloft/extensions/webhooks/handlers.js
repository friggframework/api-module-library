const { verifySalesloftSignature, EVENT_HEADER, getHeader } = require('./signature-verifier');
const { findIntegrationByTeamId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the HMAC-SHA1 signature
 * using SALESLOFT_WEBHOOK_CALLBACK_TOKEN (must match the subscription's
 * callback_token), then enqueues SALESLOFT_WEBHOOK_RESOLVE.
 *
 * Docs: https://developers.salesloft.com/docs/platform/webhooks/delivery-headers/
 */
async function onSalesloftWebhookReceived({ req, res }) {
    const verification = verifySalesloftSignature({
        req,
        callbackToken: process.env.SALESLOFT_WEBHOOK_CALLBACK_TOKEN,
    });
    if (!verification.valid) {
        console.warn(
            `[salesloft-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const eventType =
        verification.eventType ||
        getHeader(req.headers || {}, EVENT_HEADER) ||
        null;

    await this.queueWebhook({
        event: 'SALESLOFT_WEBHOOK_RESOLVE',
        body: {
            eventType,
            payload: req.body,
        },
    });

    res.status(200).json({ received: true });
}

/**
 * SALESLOFT_WEBHOOK_RESOLVE — worker hop with DB. Looks up the owning
 * integration by team/tenant id when present on the payload, then re-enqueues
 * SALESLOFT_WEBHOOK bound to that integration.
 *
 * Open question: official delivery docs document x-salesloft-event and
 * x-salesloft-signature but do not document a guaranteed tenant_id / team id
 * field on every payload. When missing, the event is skipped rather than
 * mis-routed.
 */
async function onSalesloftWebhookResolve({ data }) {
    const body = data && data.body;
    const payload = (body && body.payload) || {};
    const teamId =
        payload.tenant_id ||
        payload.team_id ||
        (payload.data && (payload.data.tenant_id || payload.data.team_id)) ||
        null;

    if (teamId === undefined || teamId === null) {
        console.warn(
            '[salesloft-webhooks] resolve: payload missing tenant_id/team_id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByTeamId(this, teamId);
    if (!integrationId) {
        console.warn(
            `[salesloft-webhooks] resolve: no integration for teamId=${teamId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'SALESLOFT_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * SALESLOFT_WEBHOOK — default no-op; override via binding.handlers.
 */
async function onSalesloftWebhook({ data }) {
    // no-op — override via binding.handlers.SALESLOFT_WEBHOOK
}

module.exports = {
    onSalesloftWebhookReceived,
    onSalesloftWebhookResolve,
    onSalesloftWebhook,
};
