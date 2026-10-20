const { verifyTrelloSignature } = require('./signature-verifier');
const {
    findIntegrationByMemberId,
    extractMemberId,
} = require('./lookup');

/**
 * HEAD /webhooks — Trello probes callbackURL with HTTP HEAD during
 * webhook creation and expects 200. No body, no signature.
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
 */
async function onTrelloWebhookHead({ res }) {
    res.status(200).end();
}

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * 1. Verify X-Trello-Webhook (HMAC-SHA1 of body + callbackURL).
 * 2. Enqueue TRELLO_WEBHOOK_RESOLVE with the parsed body.
 *
 * @see https://developer.atlassian.com/cloud/trello/guides/rest-api/webhooks/
 */
async function onTrelloWebhookReceived({ req, res }) {
    const secret = process.env.TRELLO_API_SECRET;
    const verification = verifyTrelloSignature({ req, secret });
    if (!verification.valid) {
        console.warn(
            `[trello-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body || {};
    const memberId = extractMemberId(body);
    if (!memberId) {
        console.warn(
            '[trello-webhooks] event missing memberId (add ?memberId= to callbackURL); skipping resolve'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'TRELLO_WEBHOOK_RESOLVE',
        body,
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * TRELLO_WEBHOOK_RESOLVE — worker hop with DB. Looks up member id →
 * integration, then re-enqueues TRELLO_WEBHOOK bound to that id.
 */
async function onTrelloWebhookResolve({ data }) {
    const body = data && data.body;
    const memberId = extractMemberId(body);
    if (!memberId) {
        console.warn(
            '[trello-webhooks] resolve: event missing memberId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByMemberId(this, memberId);
    if (!integrationId) {
        console.warn(
            `[trello-webhooks] resolve: no integration for memberId=${memberId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'TRELLO_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * TRELLO_WEBHOOK — hydrated integration. Default no-op; override via
 * binding.handlers.TRELLO_WEBHOOK.
 */
async function onTrelloWebhook({ data }) {
    // no-op — override via binding.handlers.TRELLO_WEBHOOK
}

module.exports = {
    onTrelloWebhookHead,
    onTrelloWebhookReceived,
    onTrelloWebhookResolve,
    onTrelloWebhook,
};
