const { verifyClockworkWebhook } = require('./signature-verifier');
const { findIntegrationByFirmSubdomain } = require('./lookup');

function extractFirmSubdomain(body, headers = {}) {
    if (body && typeof body === 'object') {
        const direct =
            body.firm_subdomain ||
            body.firm ||
            body.firm_hostname ||
            (body.meta &&
                (body.meta.firm_subdomain ||
                    body.meta.firm ||
                    body.meta.firm_hostname));
        if (direct) return String(direct);
    }
    const headerFirm =
        headers['x-clockwork-firm'] ||
        headers['X-Clockwork-Firm'] ||
        headers['x-firm-subdomain'];
    return headerFirm ? String(headerFirm) : null;
}

/**
 * Receiver for `POST /webhooks` — DB-free. Optional shared-secret check, then
 * enqueue CLOCKWORK_WEBHOOK_RESOLVE with the raw body.
 */
async function onClockworkWebhookReceived({ req, res }) {
    const verification = verifyClockworkWebhook({
        req,
        sharedSecret: process.env.CLOCKWORK_WEBHOOK_SHARED_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[clockwork-recruiting-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const firmSubdomain = extractFirmSubdomain(body, req.headers || {});

    if (!firmSubdomain) {
        console.warn(
            '[clockwork-recruiting-webhooks] event missing firm_subdomain; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'CLOCKWORK_WEBHOOK_RESOLVE',
        body: { ...body, firm_subdomain: firmSubdomain },
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * CLOCKWORK_WEBHOOK_RESOLVE — queue worker (DB available). Looks up
 * firm_subdomain → owning integration, then re-enqueues CLOCKWORK_WEBHOOK.
 */
async function onClockworkWebhookResolve({ data }) {
    const body = data && data.body;
    if (!body) {
        console.warn(
            '[clockwork-recruiting-webhooks] resolve: missing body; skipping'
        );
        return;
    }

    const firmSubdomain = body.firm_subdomain || body.firm;
    if (!firmSubdomain) {
        console.warn(
            '[clockwork-recruiting-webhooks] resolve: missing firm_subdomain; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByFirmSubdomain(
        this,
        firmSubdomain
    );
    if (!integrationId) {
        console.warn(
            `[clockwork-recruiting-webhooks] resolve: no integration for firm=${firmSubdomain}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'CLOCKWORK_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * CLOCKWORK_WEBHOOK — default no-op. Consumers override via binding.handlers.
 */
async function onClockworkWebhook({ data }) {
    console.log(
        '[clockwork-recruiting-webhooks] CLOCKWORK_WEBHOOK received (default handler; override via binding.handlers)',
        {
            firm:
                data &&
                data.body &&
                (data.body.firm_subdomain || data.body.firm),
        }
    );
}

module.exports = {
    onClockworkWebhookReceived,
    onClockworkWebhookResolve,
    onClockworkWebhook,
    extractFirmSubdomain,
};
