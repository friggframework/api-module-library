const { verifyMailchimpSignature } = require('./signature-verifier');
const { findIntegrationByAccountId } = require('./lookup');

/**
 * Extract account_id for reverse lookup. Prefer the query param recommended
 * when creating the webhook URL; fall back to body fields if present.
 *
 * @param {import('express').Request|Object} req
 * @param {Object} body
 * @returns {string|null}
 */
function extractAccountId(req, body) {
    const q = (req && req.query) || {};
    if (q.account_id) return String(q.account_id);
    if (body && body.account_id) return String(body.account_id);
    if (body && body.data && body.data.account_id) {
        return String(body.data.account_id);
    }
    return null;
}

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies X-Mailchimp-Signature
 * when MAILCHIMP_WEBHOOK_SECRET is set, then enqueues MAILCHIMP_WEBHOOK_RESOLVE.
 *
 * Docs: https://mailchimp.com/developer/marketing/guides/sync-audience-data-webhooks/
 */
async function onMailchimpWebhookReceived({ req, res }) {
    const secret = process.env.MAILCHIMP_WEBHOOK_SECRET;
    if (secret) {
        const verification = verifyMailchimpSignature({ req, secret });
        if (!verification.valid) {
            console.warn(
                `[mailchimp-webhooks] rejecting webhook: ${verification.reason}`
            );
            res.status(401).json({ error: 'invalid signature' });
            return;
        }
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const accountId = extractAccountId(req, body);
    const listId =
        (body.data && body.data.list_id) ||
        body.list_id ||
        (req.query && req.query.list_id) ||
        null;

    if (!accountId) {
        console.warn(
            '[mailchimp-webhooks] payload/query missing account_id; ' +
                'create webhooks with ?account_id={account_id} on the callback URL. ' +
                `list_id=${listId || 'n/a'}; skipping resolve`
        );
        res.status(200).json({
            received: true,
            queued: false,
            skipped: true,
            reason: 'missing account_id',
        });
        return;
    }

    await this.queueWebhook({
        event: 'MAILCHIMP_WEBHOOK_RESOLVE',
        body: {
            ...body,
            account_id: accountId,
            list_id: listId,
        },
    });

    res.status(200).json({
        received: true,
        queued: true,
        type: body.type || null,
    });
}

/**
 * MAILCHIMP_WEBHOOK_RESOLVE — worker (DB available). Looks up the owning
 * integration by account_id, then re-enqueues MAILCHIMP_WEBHOOK bound to it.
 */
async function onMailchimpWebhookResolve({ data }) {
    const body = data && data.body;
    const accountId = body && body.account_id;
    if (!accountId) {
        console.warn(
            '[mailchimp-webhooks] resolve: missing account_id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByAccountId(this, accountId);
    if (!integrationId) {
        console.warn(
            `[mailchimp-webhooks] resolve: no integration for account_id=${accountId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'MAILCHIMP_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * MAILCHIMP_WEBHOOK — hydrated integration. Default no-op; override via
 * binding.handlers.MAILCHIMP_WEBHOOK.
 */
async function onMailchimpWebhook({ data }) {
    // no-op — override via binding.handlers.MAILCHIMP_WEBHOOK
}

module.exports = {
    extractAccountId,
    onMailchimpWebhookReceived,
    onMailchimpWebhookResolve,
    onMailchimpWebhook,
};
