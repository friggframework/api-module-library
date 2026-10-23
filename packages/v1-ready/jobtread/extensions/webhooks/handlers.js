const { findIntegrationByOrganizationId } = require('./lookup');

/**
 * Best-effort extraction of an organization id from an inbound JobTread
 * webhook body. The public Pave schema documents `createWebhook` inputs and
 * the `webhook` object fields, but does NOT document the delivery payload.
 * These paths are heuristics for when the body includes an organization id;
 * confirm against a live sandbox delivery before treating them as stable.
 */
function extractOrganizationId(body) {
    if (!body || typeof body !== 'object') return null;
    if (body.organizationId) return body.organizationId;
    if (body.organization_id) return body.organization_id;
    if (body.organization && body.organization.id) return body.organization.id;
    if (body.data && body.data.organizationId) return body.data.organizationId;
    if (body.data && body.data.organization && body.data.organization.id) {
        return body.data.organization.id;
    }
    return null;
}

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * JobTread's introspectable schema does not expose a webhook signing secret or
 * signature header, so this receiver does not invent HMAC verification. It
 * acknowledges quickly and queues resolve work. Tighten once official delivery
 * auth is confirmed on a sandbox grant.
 */
async function onJobTreadWebhookReceived({ req, res }) {
    const body = req && req.body;

    await this.queueWebhook({
        event: 'JOBTREAD_WEBHOOK_RESOLVE',
        body: body === undefined ? null : body,
    });

    res.status(200).json({ received: true, queued: true });
}

/**
 * JOBTREAD_WEBHOOK_RESOLVE — worker (DB available). Maps organizationId →
 * integration when the payload includes one; otherwise skips binding.
 */
async function onJobTreadWebhookResolve({ data }) {
    const body = data && data.body;
    const organizationId = extractOrganizationId(body);
    if (!organizationId) {
        console.warn(
            '[jobtread-webhooks] resolve: payload missing organization id; ' +
                'skipping integration bind (confirm delivery shape on sandbox)'
        );
        return;
    }

    const integrationId = await findIntegrationByOrganizationId(
        this,
        organizationId
    );
    if (!integrationId) {
        console.warn(
            `[jobtread-webhooks] resolve: no integration for organizationId=${organizationId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'JOBTREAD_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * JOBTREAD_WEBHOOK — worker with owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.JOBTREAD_WEBHOOK.
 */
async function onJobTreadWebhook({ data }) {
    // no-op — override via binding.handlers.JOBTREAD_WEBHOOK
}

module.exports = {
    onJobTreadWebhookReceived,
    onJobTreadWebhookResolve,
    onJobTreadWebhook,
    extractOrganizationId,
};
