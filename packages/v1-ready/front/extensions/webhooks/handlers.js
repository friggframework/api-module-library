const { verifyFrontSignature, CHALLENGE_HEADER } = require('./signature-verifier');
const { findIntegrationByCompanyId } = require('./lookup');

function getHeader(headers, name) {
    if (!headers || typeof headers !== 'object') return undefined;
    const want = name.toLowerCase();
    for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === want) {
            const v = headers[key];
            return Array.isArray(v) ? v[0] : v;
        }
    }
    return undefined;
}

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * 1. Verify HMAC (`x-front-signature` over `${timestamp}:` + raw body).
 * 2. If `x-front-challenge` is present (sync validation), echo it as
 *    text/plain 200 — required to save the webhook feature in Front.
 * 3. Otherwise enqueue FRONT_WEBHOOK_RESOLVE with the parsed body
 *    (carries `authorization.id` = company id).
 *
 * @see https://dev.frontapp.com/docs/application-webhooks
 */
async function onFrontWebhookReceived({ req, res }) {
    const secret = process.env.FRONT_WEBHOOK_SECRET;
    const verification = verifyFrontSignature({ req, secret });
    if (!verification.valid) {
        console.warn(
            `[front-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const challenge =
        verification.challenge ||
        getHeader(req.headers || {}, CHALLENGE_HEADER);
    const body = req.body || {};
    if (challenge && (body.type === 'sync' || !body.type)) {
        res.status(200).type('text/plain').send(String(challenge));
        return;
    }

    const companyId = body?.authorization?.id;
    if (!companyId) {
        console.warn(
            `[front-webhooks] event missing authorization.id (type=${body.type}); skipping`
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'FRONT_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * FRONT_WEBHOOK_RESOLVE — worker hop with DB. Looks up company id →
 * integration, then re-enqueues FRONT_WEBHOOK bound to that id.
 */
async function onFrontWebhookResolve({ data }) {
    const body = data && data.body;
    const companyId = body && body.authorization && body.authorization.id;
    if (!companyId) {
        console.warn(
            '[front-webhooks] resolve: event missing authorization.id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByCompanyId(this, companyId);
    if (!integrationId) {
        console.warn(
            `[front-webhooks] resolve: no integration for companyId=${companyId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'FRONT_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * FRONT_WEBHOOK — hydrated integration. Default no-op; override via
 * binding.handlers.FRONT_WEBHOOK.
 */
async function onFrontWebhook({ data }) {
    // no-op — override via binding.handlers.FRONT_WEBHOOK
}

module.exports = {
    onFrontWebhookReceived,
    onFrontWebhookResolve,
    onFrontWebhook,
};
