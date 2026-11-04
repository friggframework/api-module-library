const { verifyAttentiveSignature } = require('./signature-verifier');
const { findIntegrationByCompanyId } = require('./lookup');

/**
 * Pull companyId out of an Attentive webhook body.
 *
 * Attentive's documented webhook objects include `companyId` (see
 * GetWebhookResponseDto in the official OpenAPI). Delivery payloads vary by
 * event type; we accept the common locations and skip when none are present.
 */
function extractCompanyId(body) {
    if (!body || typeof body !== 'object') return null;
    const candidates = [
        body.companyId,
        body.company_id,
        body.company?.id,
        body.company?.companyId,
        body.data?.companyId,
    ];
    for (const c of candidates) {
        if (c !== undefined && c !== null && c !== '') return String(c);
    }
    return null;
}

/**
 * Normalize a webhook body into one or more { companyId, event } rows.
 * Accepts a single object or an array of events.
 */
function extractEvents(body) {
    if (!body) return [];
    const items = Array.isArray(body) ? body : [body];
    return items.map((evt, index) => ({
        companyId: extractCompanyId(evt),
        event: evt,
        index,
    }));
}

/**
 * Receiver for POST /webhooks — DB-free. Verifies x-attentive-hmac-sha256, then
 * enqueues one ATTENTIVE_WEBHOOK_RESOLVE per event (carrying companyId).
 */
async function onAttentiveWebhookReceived({ req, res }) {
    const verification = verifyAttentiveSignature({
        req,
        signingKey: process.env.ATTENTIVE_WEBHOOK_SIGNING_KEY,
    });
    if (!verification.valid) {
        console.warn(
            `[attentive-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const rows = extractEvents(req.body);
    const outcomes = await Promise.all(
        rows.map(async (row) => {
            if (!row.companyId) {
                console.warn(
                    `[attentive-webhooks] event[${row.index}] missing companyId; skipping`
                );
                return 'skipped';
            }
            await this.queueWebhook({
                event: 'ATTENTIVE_WEBHOOK_RESOLVE',
                body: { companyId: row.companyId, event: row.event },
            });
            return 'queued';
        })
    );

    const queued = outcomes.filter((o) => o === 'queued').length;
    res.status(200).json({
        received: rows.length,
        queued,
        skipped: rows.length - queued,
    });
}

/**
 * ATTENTIVE_WEBHOOK_RESOLVE — worker hop with DB. Looks up companyId →
 * integration, then re-enqueues ATTENTIVE_WEBHOOK bound to that id.
 */
async function onAttentiveWebhookResolve({ data }) {
    const body = data && data.body;
    const companyId = body && body.companyId;
    if (companyId === undefined || companyId === null) {
        console.warn(
            '[attentive-webhooks] resolve: event missing companyId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByCompanyId(this, companyId);
    if (!integrationId) {
        console.warn(
            `[attentive-webhooks] resolve: no integration for companyId=${companyId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'ATTENTIVE_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * ATTENTIVE_WEBHOOK — default no-op; override via binding.handlers.
 */
async function onAttentiveWebhook({ data }) {
    // no-op — override via binding.handlers.ATTENTIVE_WEBHOOK
}

module.exports = {
    onAttentiveWebhookReceived,
    onAttentiveWebhookResolve,
    onAttentiveWebhook,
    extractEvents,
    extractCompanyId,
};
