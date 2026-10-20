const { verifyFreshBooksSignature } = require('./signature-verifier');

/**
 * Receiver for `POST /webhooks` — DB-free.
 * Verifies X-FreshBooks-Hmac-SHA256 using the per-callback verifier secret,
 * then enqueues FRESHBOOKS_WEBHOOK for consumers to bind.
 *
 * FreshBooks delivers form-urlencoded params: name, object_id, account_id,
 * business_id, identity_id (user_id deprecated).
 * See https://www.freshbooks.com/api/webhooks
 */
async function onFreshBooksWebhookReceived({ req, res }) {
    const verifier =
        process.env.FRESHBOOKS_WEBHOOK_VERIFIER ||
        (req && req.freshbooksVerifier);

    const verification = verifyFreshBooksSignature({ req, verifier });
    if (!verification.valid) {
        console.warn(
            `[freshbooks-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const params = verification.params || {};
    await this.queueWebhook({
        event: 'FRESHBOOKS_WEBHOOK',
        body: params,
    });

    res.status(200).json({ received: true });
}

/**
 * Default no-op consumer for FRESHBOOKS_WEBHOOK. Integrations override via
 * binding.handlers.
 */
async function onFreshBooksWebhook({ data }) {
    console.log(
        '[freshbooks-webhooks] FRESHBOOKS_WEBHOOK',
        data && data.body && data.body.name
    );
}

module.exports = {
    onFreshBooksWebhookReceived,
    onFreshBooksWebhook,
};
