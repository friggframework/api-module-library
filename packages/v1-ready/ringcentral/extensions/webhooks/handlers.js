const { verifyRingCentralWebhook } = require('./signature-verifier');
const { findIntegrationByAccountId } = require('./lookup');

/**
 * Extract a routing account id from a RingCentral notification payload.
 * Event bodies typically carry body.accountId; ownerId is the extension.
 */
function extractAccountId(body) {
    if (!body || typeof body !== 'object') return null;
    const nested = body.body && body.body.accountId;
    if (nested !== undefined && nested !== null) return String(nested);
    if (body.accountId !== undefined && body.accountId !== null) {
        return String(body.accountId);
    }
    // Fall back to ownerId (extension) when accountId is absent — better than
    // dropping the event, though entity.externalId is preferably account id.
    if (body.ownerId !== undefined && body.ownerId !== null) {
        return String(body.ownerId);
    }
    return null;
}

/**
 * Receiver for POST /webhooks — DB-free.
 * 1. Validation-Token handshake: echo header, 200, stop.
 * 2. Otherwise verify Verification-Token, enqueue RINGCENTRAL_WEBHOOK_RESOLVE.
 */
async function onRingCentralWebhookReceived({ req, res }) {
    const verification = verifyRingCentralWebhook({
        req,
        verificationToken: process.env.RINGCENTRAL_WEBHOOK_VERIFICATION_TOKEN,
    });

    if (verification.isValidation && verification.validationToken) {
        res.set('Validation-Token', verification.validationToken);
        res.set('Content-Type', 'application/json');
        res.status(200).send('');
        return;
    }

    if (!verification.valid) {
        console.warn(
            `[ringcentral-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid verification token' });
        return;
    }

    const accountId = extractAccountId(req.body);
    if (!accountId) {
        console.warn(
            '[ringcentral-webhooks] event missing accountId/ownerId; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'RINGCENTRAL_WEBHOOK_RESOLVE',
        body: {
            accountId,
            notification: req.body,
        },
    });

    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * RINGCENTRAL_WEBHOOK_RESOLVE — worker hop with DB. Looks up accountId →
 * integration, then re-enqueues RINGCENTRAL_WEBHOOK.
 */
async function onRingCentralWebhookResolve({ data }) {
    const body = data && data.body;
    const accountId = body && body.accountId;
    if (accountId === undefined || accountId === null) {
        console.warn(
            '[ringcentral-webhooks] resolve: event missing accountId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByAccountId(this, accountId);
    if (!integrationId) {
        console.warn(
            `[ringcentral-webhooks] resolve: no integration for accountId=${accountId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'RINGCENTRAL_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * RINGCENTRAL_WEBHOOK — default no-op; override via binding.handlers.
 */
async function onRingCentralWebhook({ data }) {
    // no-op — override via binding.handlers.RINGCENTRAL_WEBHOOK
}

module.exports = {
    onRingCentralWebhookReceived,
    onRingCentralWebhookResolve,
    onRingCentralWebhook,
    extractAccountId,
};
