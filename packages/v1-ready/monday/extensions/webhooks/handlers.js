const { verifyMondayWebhookSignature } = require('./signature-verifier');
const { findIntegrationByBoardId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * 1. URL verification: monday POSTs `{ challenge }` and expects the same JSON
 *    echoed back (https://developer.monday.com/api-reference/reference/webhooks).
 * 2. Optional JWT verification when MONDAY_SIGNING_SECRET is set.
 * 3. Enqueue MONDAY_WEBHOOK_RESOLVE with the event payload.
 */
async function onMondayWebhookReceived({ req, res }) {
    const body = req.body || {};

    if (body.challenge !== undefined && body.challenge !== null) {
        res.status(200).json({ challenge: body.challenge });
        return;
    }

    const verification = verifyMondayWebhookSignature({
        req,
        signingSecret: process.env.MONDAY_SIGNING_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[monday-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const event = body.event || body;
    const boardId =
        (event && (event.boardId || event.board_id)) ||
        body.boardId ||
        body.board_id;

    await this.queueWebhook({
        event: 'MONDAY_WEBHOOK_RESOLVE',
        body: { event, boardId, raw: body },
    });

    res.status(200).json({ received: true });
}

/**
 * MONDAY_WEBHOOK_RESOLVE — worker hop with DB. Looks up boardId → integration,
 * then re-enqueues MONDAY_WEBHOOK bound to that id.
 */
async function onMondayWebhookResolve({ data }) {
    const body = data && data.body;
    const boardId = body && body.boardId;
    if (boardId === undefined || boardId === null) {
        console.warn(
            '[monday-webhooks] resolve: event missing boardId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByBoardId(this, boardId);
    if (!integrationId) {
        console.warn(
            `[monday-webhooks] resolve: no integration for boardId=${boardId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'MONDAY_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default MONDAY_WEBHOOK handler — no-op. Consumers override via
 * binding.handlers to process board events.
 */
async function onMondayWebhook() {
    // intentionally empty — override in the integration binding
}

module.exports = {
    onMondayWebhookReceived,
    onMondayWebhookResolve,
    onMondayWebhook,
};
