const {
    verifyDrChronoSignature,
    buildWebhookChallengeResponse,
    getHeader,
    EVENT_HEADER,
} = require('./signature-verifier');
const { findIntegrationByExternalId } = require('./lookup');

/**
 * Extract routing identifiers from a DrChrono webhook envelope.
 * Shape (docs): { receiver, object } plus headers X-drchrono-event / signature.
 *
 * @param {Object} body
 * @param {Object} headers
 * @returns {{ event: string|null, object: Object|null, practiceGroup?: string, doctorId?: string }}
 */
function extractWebhookEnvelope(body, headers = {}) {
    if (!body || typeof body !== 'object') {
        return { event: null, object: null };
    }
    const event =
        getHeader(headers, EVENT_HEADER) ||
        body.event ||
        null;
    const object = body.object && typeof body.object === 'object'
        ? body.object
        : null;
    const practiceGroup =
        object?.practice_group !== undefined && object?.practice_group !== null
            ? String(object.practice_group)
            : body.receiver?.practice_group !== undefined &&
                body.receiver?.practice_group !== null
              ? String(body.receiver.practice_group)
              : undefined;
    const doctorId =
        object?.doctor !== undefined && object?.doctor !== null
            ? String(object.doctor)
            : undefined;
    return { event, object, practiceGroup, doctorId, receiver: body.receiver };
}

/**
 * GET /webhooks — DrChrono callback ownership challenge.
 * Respond with HMAC-SHA256(secret, msg) as secret_token.
 */
async function onDrChronoWebhookVerify({ req, res }) {
    const secret =
        process.env.DRCHRONO_WEBHOOK_SECRET ||
        process.env.DRCHRONO_CLIENT_SECRET;
    const msg = req?.query?.msg;
    if (!secret) {
        res.status(500).json({ error: 'webhook secret not configured' });
        return;
    }
    if (msg === undefined || msg === null) {
        res.status(400).json({ error: 'missing msg query parameter' });
        return;
    }
    res.status(200).json(buildWebhookChallengeResponse(msg, secret));
}

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies X-drchrono-signature,
 * then enqueues DRCHRONO_WEBHOOK_RESOLVE.
 */
async function onDrChronoWebhookReceived({ req, res }) {
    const verification = verifyDrChronoSignature({
        req,
        signingSecret:
            process.env.DRCHRONO_WEBHOOK_SECRET ||
            process.env.DRCHRONO_CLIENT_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[drchrono-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const envelope = extractWebhookEnvelope(req.body, req.headers || {});
    if (!envelope.event) {
        console.warn(
            '[drchrono-webhooks] payload missing X-drchrono-event; skipping'
        );
        res.status(200).json({ received: true, queued: false, skipped: true });
        return;
    }

    // PING is a connectivity check — acknowledge without resolving.
    if (String(envelope.event).toUpperCase() === 'PING') {
        res.status(200).json({ received: true, queued: false, ping: true });
        return;
    }

    await this.queueWebhook({
        event: 'DRCHRONO_WEBHOOK_RESOLVE',
        body: {
            ...envelope,
            raw: req.body,
        },
    });

    res.status(200).json({ received: true, queued: true });
}

/**
 * DRCHRONO_WEBHOOK_RESOLVE — worker (DB available). Maps practice_group or
 * doctor → integration, then re-enqueues DRCHRONO_WEBHOOK.
 */
async function onDrChronoWebhookResolve({ data }) {
    const body = data && data.body;
    const candidates = [body?.practiceGroup, body?.doctorId].filter(Boolean);
    if (candidates.length === 0) {
        console.warn(
            '[drchrono-webhooks] resolve: event missing practice_group/doctor; skipping'
        );
        return;
    }

    let integrationId = null;
    for (const candidate of candidates) {
        integrationId = await findIntegrationByExternalId(this, candidate);
        if (integrationId) break;
    }
    if (!integrationId) {
        console.warn(
            `[drchrono-webhooks] resolve: no integration for candidates=${candidates.join(',')}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'DRCHRONO_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * DRCHRONO_WEBHOOK — worker with owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.DRCHRONO_WEBHOOK.
 */
async function onDrChronoWebhook({ data }) {
    // no-op — override via binding.handlers.DRCHRONO_WEBHOOK
}

module.exports = {
    onDrChronoWebhookVerify,
    onDrChronoWebhookReceived,
    onDrChronoWebhookResolve,
    onDrChronoWebhook,
    extractWebhookEnvelope,
};
