const { verifyPagerDutySignature } = require('./signature-verifier');
const {
    findIntegrationBySubdomain,
    subdomainFromWebhookBody,
} = require('./lookup');

/**
 * Receiver for `POST /webhooks` — DB-free. Verifies the PagerDuty HMAC
 * signature, then enqueues PAGERDUTY_WEBHOOK_RESOLVE. Subdomain→integration
 * lookup needs the DB, so it runs in the worker.
 *
 * Env:
 *   PAGERDUTY_WEBHOOK_SECRET — delivery_method.secret from createWebhookSubscription
 */
async function onPagerDutyWebhookReceived({ req, res }) {
    const verification = verifyPagerDutySignature({
        req,
        secret: process.env.PAGERDUTY_WEBHOOK_SECRET,
    });
    if (!verification.valid) {
        console.warn(
            `[pagerduty-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const subdomain = subdomainFromWebhookBody(body);
    if (!subdomain) {
        console.warn(
            '[pagerduty-webhooks] event missing subdomain html_url; skipping'
        );
        res.status(200).json({ received: 1, queued: 0, skipped: 1 });
        return;
    }

    await this.queueWebhook({
        event: 'PAGERDUTY_WEBHOOK_RESOLVE',
        body,
    });
    res.status(200).json({ received: 1, queued: 1, skipped: 0 });
}

/**
 * Resolve subdomain → owning integration, then re-enqueue PAGERDUTY_WEBHOOK.
 */
async function onPagerDutyWebhookResolve({ data }) {
    const body = data && data.body;
    const subdomain = subdomainFromWebhookBody(body);
    if (!subdomain) {
        console.warn(
            '[pagerduty-webhooks] resolve: event missing subdomain; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationBySubdomain(this, subdomain);
    if (!integrationId) {
        console.warn(
            `[pagerduty-webhooks] resolve: no integration for subdomain=${subdomain}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'PAGERDUTY_WEBHOOK',
        body,
        integrationId,
    });
}

/**
 * Default consumer stub — integrations override via binding.handlers.
 */
async function onPagerDutyWebhook({ data }) {
    console.log(
        '[pagerduty-webhooks] PAGERDUTY_WEBHOOK received',
        data && data.body && data.body.event && data.body.event.event_type
    );
}

module.exports = {
    onPagerDutyWebhookReceived,
    onPagerDutyWebhookResolve,
    onPagerDutyWebhook,
};
