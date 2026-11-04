const { Api } = require('../../api');
const { verifyDropboxSignature } = require('./signature-verifier');
const { findIntegrationByDropboxAccountId } = require('./lookup');

/**
 * Receiver for `GET /webhooks?challenge=…` — echoes the challenge as text/plain.
 *
 * Docs: https://www.dropbox.com/developers/reference/webhooks
 */
async function onDropboxWebhookChallenge({ req, res }) {
    const challenge =
        (req.query && (req.query.challenge || req.query.Challenge)) ||
        (req.url &&
            new URL(req.url, 'http://localhost').searchParams.get('challenge'));

    try {
        const echoed = Api.handleWebhookChallenge(challenge);
        res.status(200).type(echoed.contentType).send(echoed.challenge);
    } catch (err) {
        console.warn(
            `[dropbox-webhooks] challenge rejected: ${err && err.message}`
        );
        res.status(400).json({ error: 'missing challenge' });
    }
}

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the Dropbox HMAC signature,
 * then enqueues DROPBOX_WEBHOOK_RESOLVE per account_id in the payload.
 *
 * Env:
 *   DROPBOX_CLIENT_SECRET — App Console app secret (signing key)
 */
async function onDropboxWebhookReceived({ req, res }) {
    const verification = verifyDropboxSignature({ req });
    if (!verification.valid) {
        console.warn(
            `[dropbox-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const accounts =
        (body.list_folder && Array.isArray(body.list_folder.accounts)
            ? body.list_folder.accounts
            : null) ||
        (body.delta && Array.isArray(body.delta.users)
            ? body.delta.users.map(String)
            : []);

    if (!accounts.length) {
        console.warn(
            '[dropbox-webhooks] notification missing list_folder.accounts; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    let queued = 0;
    for (const accountId of accounts) {
        await this.queueWebhook({
            event: 'DROPBOX_WEBHOOK_RESOLVE',
            body: { ...body, _accountId: accountId },
        });
        queued += 1;
    }
    res.status(200).json({
        received: 1,
        queued,
        skipped: accounts.length - queued,
    });
}

/**
 * Resolve account_id → owning integration, then re-enqueue DROPBOX_WEBHOOK.
 */
async function onDropboxWebhookResolve({ data }) {
    const body = data && data.body;
    const accountId = body && body._accountId;
    if (!accountId) {
        console.warn(
            '[dropbox-webhooks] resolve: event missing _accountId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByDropboxAccountId(
        this,
        accountId
    );
    if (!integrationId) {
        console.warn(
            `[dropbox-webhooks] resolve: no integration for account_id=${accountId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'DROPBOX_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * Default consumer for a resolved Dropbox webhook. Override via binding.handlers.
 * Payload only lists account ids — callers should use listFolderContinue.
 */
async function onDropboxWebhook({ data }) {
    console.log(
        `[dropbox-webhooks] DROPBOX_WEBHOOK account=${
            data && data.body && data.body._accountId
        }`
    );
}

module.exports = {
    onDropboxWebhookChallenge,
    onDropboxWebhookReceived,
    onDropboxWebhookResolve,
    onDropboxWebhook,
};
