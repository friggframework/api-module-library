const { findIntegrationByAccountId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * Freshdesk outbound webhooks are configured as Trigger Webhook / Trigger API
 * actions inside Admin → Workflows → Automations (not a REST subscription
 * resource). Point the automation URL at this route and include a tenant hint:
 *
 *   ?domain={subdomain}
 *   and/or a JSON body field `freshdesk_webhook.account_id` / `account_id`
 *
 * Official docs do not document a request-signature header for automation
 * webhooks; verification is therefore not applied here (open question —
 * adopters may add a shared secret query/header in the automation action).
 *
 * Docs: https://support.freshdesk.com/support/solutions/articles/132589-using-webhooks-in-automation-rules
 */
async function onFreshdeskWebhookReceived({ req, res }) {
    const body = req.body;
    const domain =
        (req.query && (req.query.domain || req.query.account)) ||
        (body &&
            (body.domain ||
                body.account_domain ||
                (body.freshdesk_webhook && body.freshdesk_webhook.domain))) ||
        null;
    const accountId =
        (body &&
            (body.account_id ||
                (body.freshdesk_webhook &&
                    body.freshdesk_webhook.account_id))) ||
        (req.query && req.query.account_id) ||
        null;

    if (!domain && (accountId === undefined || accountId === null)) {
        console.warn(
            '[freshdesk-webhooks] rejecting webhook: missing domain/account_id'
        );
        res.status(400).json({ error: 'missing domain or account_id' });
        return;
    }

    await this.queueWebhook({
        event: 'FRESHDESK_WEBHOOK_RESOLVE',
        body: {
            domain: domain ? String(domain) : null,
            accountId: accountId != null ? String(accountId) : null,
            payload: body,
            headers: req.headers,
        },
    });

    res.status(200).json({ received: true, queued: 1 });
}

/**
 * FRESHDESK_WEBHOOK_RESOLVE — worker hop with DB. Prefers account_id
 * (matches entity.externalId from GET /account). Falls back to looking up
 * by domain string when that is what the automation URL provided — the
 * domain is also persisted on the entity details / credential.
 */
async function onFreshdeskWebhookResolve({ data }) {
    const envelope = data && data.body;
    const accountId = envelope && envelope.accountId;
    const domain = envelope && envelope.domain;

    const lookupKey = accountId || domain;
    if (!lookupKey) {
        console.warn(
            '[freshdesk-webhooks] resolve: missing accountId/domain; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByAccountId(this, lookupKey);
    if (!integrationId) {
        console.warn(
            `[freshdesk-webhooks] resolve: no integration for key=${lookupKey}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'FRESHDESK_WEBHOOK',
        integrationId,
        body: envelope,
    });
}

/**
 * FRESHDESK_WEBHOOK — hydrated integration. Default no-op; consumers override
 * via binding.handlers.FRESHDESK_WEBHOOK.
 */
async function onFreshdeskWebhook({ data }) {
    // no-op — override via binding.handlers.FRESHDESK_WEBHOOK
}

module.exports = {
    onFreshdeskWebhookReceived,
    onFreshdeskWebhookResolve,
    onFreshdeskWebhook,
};
