const { verifyBambooHRWebhookSignature } = require('./signature-verifier');
const { extractCompanyKey } = require('./lookup');

function getWebhookPrivateKey() {
    return process.env.BAMBOOHR_WEBHOOK_PRIVATE_KEY || null;
}

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies HMAC-SHA256
 * (rawBody + timestamp, privateKey), then enqueues BAMBOOHR_WEBHOOK_RESOLVE.
 *
 * Docs: https://documentation.bamboohr.com/docs/webhooks#security
 */
async function onBambooHRWebhookReceived({ req, res }) {
    const verification = verifyBambooHRWebhookSignature(
        req,
        getWebhookPrivateKey()
    );
    if (!verification.valid) {
        console.warn(
            `[bamboohr-webhooks] rejecting webhook: ${verification.reason}`
        );
        if (res && !res.headersSent) {
            res.status(401).json({ error: 'invalid signature' });
        }
        return { status: 401, reason: verification.reason };
    }

    const body =
        typeof req.body === 'string'
            ? JSON.parse(req.body || '{}')
            : req.body || {};

    if (res && !res.headersSent) {
        res.status(200).json({ received: true });
    }

    return {
        status: 200,
        enqueue: {
            event: 'BAMBOOHR_WEBHOOK_RESOLVE',
            data: {
                body,
                companyKey: extractCompanyKey(body),
            },
        },
    };
}

/**
 * Worker: resolve companyDomain/companyId → integration, then fan out to
 * BAMBOOHR_WEBHOOK for consumers.
 */
async function onBambooHRWebhookResolve({ data }) {
    const body = data && data.body;
    const companyKey =
        (data && data.companyKey) || extractCompanyKey(body);
    if (!companyKey) {
        console.warn(
            '[bamboohr-webhooks] resolve: event missing companyDomain/companyId; skipping'
        );
        return;
    }

    return {
        enqueue: {
            event: 'BAMBOOHR_WEBHOOK',
            data: {
                body,
                companyKey,
            },
            // Consumers / binding layer map companyKey → integrationId via lookup.
            resolveExternalId: companyKey,
        },
    };
}

/**
 * BAMBOOHR_WEBHOOK — runs with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.BAMBOOHR_WEBHOOK.
 */
async function onBambooHRWebhook({ data }) {
    // no-op — override via binding.handlers.BAMBOOHR_WEBHOOK
}

module.exports = {
    onBambooHRWebhookReceived,
    onBambooHRWebhookResolve,
    onBambooHRWebhook,
};
