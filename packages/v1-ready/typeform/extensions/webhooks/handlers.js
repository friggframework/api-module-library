const { verifyTypeformSignature } = require('./signature-verifier');
const { findIntegrationByTypeformExternalId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the Typeform-Signature
 * HMAC, then enqueues TYPEFORM_WEBHOOK_RESOLVE. Account→integration lookup
 * needs the DB (and a stable id present on the payload), so it runs in the
 * worker.
 *
 * Env:
 *   TYPEFORM_WEBHOOK_SECRET — per-webhook `secret` from createOrUpdateWebhook
 *
 * Payload note: official deliveries include form_id / event_id but not the
 * account email used as entity externalId. Resolve attempts email from
 * optional `TYPEFORM_WEBHOOK_EXTERNAL_ID` (single-tenant) or skips.
 */
async function onTypeformWebhookReceived({ req, res }) {
    const verification = verifyTypeformSignature({
        req,
        secret: process.env.TYPEFORM_WEBHOOK_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[typeform-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    await this.queueWebhook({
        event: 'TYPEFORM_WEBHOOK_RESOLVE',
        body,
    });
    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * Resolve owning integration, then re-enqueue TYPEFORM_WEBHOOK.
 *
 * Prefer TYPEFORM_WEBHOOK_EXTERNAL_ID (email) for single-tenant installs.
 * Multi-tenant form_id→integration routing is an open question — payloads
 * do not carry the GET /me email.
 */
async function onTypeformWebhookResolve({ data }) {
    const body = data && data.body;
    const externalId = process.env.TYPEFORM_WEBHOOK_EXTERNAL_ID;
    if (!externalId) {
        console.warn(
            '[typeform-webhooks] resolve: TYPEFORM_WEBHOOK_EXTERNAL_ID unset; ' +
                `form_id=${
                    body && body.form_response && body.form_response.form_id
                } event_id=${body && body.event_id}; skipping lookup`
        );
        return;
    }

    const integrationId = await findIntegrationByTypeformExternalId(
        this,
        externalId
    );
    if (!integrationId) {
        console.warn(
            `[typeform-webhooks] resolve: no integration for externalId=${externalId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'TYPEFORM_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default consumer for a resolved Typeform webhook. Override via binding.handlers.
 */
async function onTypeformWebhook({ data }) {
    console.log(
        `[typeform-webhooks] TYPEFORM_WEBHOOK type=${
            data && data.body && data.body.event_type
        } form_id=${
            data &&
            data.body &&
            data.body.form_response &&
            data.body.form_response.form_id
        }`
    );
}

module.exports = {
    onTypeformWebhookReceived,
    onTypeformWebhookResolve,
    onTypeformWebhook,
};
