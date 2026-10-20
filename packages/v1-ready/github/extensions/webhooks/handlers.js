const { verifyGitHubSignature } = require('./signature-verifier');
const { findIntegrationByOwnerId } = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies X-Hub-Signature-256, then
 * enqueues GITHUB_WEBHOOK_RESOLVE. GitHub sends one event object per delivery
 * (not a batch array).
 *
 * Docs: https://docs.github.com/en/webhooks/webhook-events-and-payloads
 */
async function onGitHubWebhookReceived({ req, res }) {
    const verification = verifyGitHubSignature({
        req,
        secret: process.env.GITHUB_WEBHOOK_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[github-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    // GitHub ping events should be acknowledged without further work.
    const eventName =
        (req.headers &&
            (req.headers['x-github-event'] || req.headers['X-GitHub-Event'])) ||
        '';
    if (String(eventName).toLowerCase() === 'ping') {
        res.status(200).json({ ok: true, ping: true });
        return;
    }

    const body = req.body || {};
    await this.queueWebhook({
        event: 'GITHUB_WEBHOOK_RESOLVE',
        body,
        meta: {
            event: eventName,
            delivery:
                req.headers &&
                (req.headers['x-github-delivery'] ||
                    req.headers['X-GitHub-Delivery']),
        },
    });

    res.status(200).json({ received: 1, queued: 1 });
}

/**
 * GITHUB_WEBHOOK_RESOLVE — worker hop with DB. Looks up repository.owner.id
 * (or installation.account.id when present) → owning integration, then
 * re-enqueues GITHUB_WEBHOOK bound to that id.
 */
async function onGitHubWebhookResolve({ data }) {
    const body = data && data.body;
    const ownerId =
        (body &&
            body.repository &&
            body.repository.owner &&
            body.repository.owner.id) ||
        (body &&
            body.installation &&
            body.installation.account &&
            body.installation.account.id) ||
        (body && body.organization && body.organization.id);

    if (ownerId === undefined || ownerId === null) {
        console.warn(
            '[github-webhooks] resolve: event missing repository.owner.id / installation.account.id / organization.id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByOwnerId(this, ownerId);
    if (!integrationId) {
        console.warn(
            `[github-webhooks] resolve: no integration for ownerId=${ownerId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'GITHUB_WEBHOOK',
        integrationId,
        body,
        meta: data && data.meta,
    });
}

/**
 * GITHUB_WEBHOOK — runs with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.GITHUB_WEBHOOK.
 */
async function onGitHubWebhook({ data }) {
    // no-op — override via binding.handlers.GITHUB_WEBHOOK
    void data;
}

module.exports = {
    onGitHubWebhookReceived,
    onGitHubWebhookResolve,
    onGitHubWebhook,
};
