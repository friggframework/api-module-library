const { verifyChargebeeBasicAuth } = require('./signature-verifier');
const { findIntegrationBySite } = require('./lookup');

function extractSite(req, body) {
    if (req && req.query && req.query.site) return String(req.query.site);
    if (body && body.site) return String(body.site);
    if (req && req.params && req.params.site) return String(req.params.site);
    return null;
}

/**
 * Receiver for `POST /webhooks` — DB-free.
 * Verifies Chargebee → endpoint Basic Auth, then enqueues
 * CHARGEBEE_WEBHOOK_RESOLVE. Site→integration lookup needs the DB, so it runs
 * in the worker (same Tier-3 split as HubSpot).
 */
async function onChargebeeWebhookReceived({ req, res }) {
    const verification = verifyChargebeeBasicAuth({
        req,
        username: process.env.CHARGEBEE_WEBHOOK_USERNAME,
        password: process.env.CHARGEBEE_WEBHOOK_PASSWORD,
    });
    if (!verification.valid) {
        console.warn(
            `[chargebee-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid credentials' });
        return;
    }

    const body = (req && req.body) || {};
    const site = extractSite(req, body);
    if (!site) {
        console.warn(
            '[chargebee-webhooks] event missing site (pass ?site=<subdomain> on the webhook URL); skipping'
        );
        res.status(400).json({
            error: 'missing site',
            hint: 'Register the webhook URL with ?site=<chargebee-subdomain>',
        });
        return;
    }

    await this.queueWebhook({
        event: 'CHARGEBEE_WEBHOOK_RESOLVE',
        body: { ...body, site },
    });

    res.status(200).json({ received: true });
}

/**
 * CHARGEBEE_WEBHOOK_RESOLVE — worker (DB available). Reverse-looks up
 * site → owning integration, then re-enqueues CHARGEBEE_WEBHOOK.
 */
async function onChargebeeWebhookResolve({ data }) {
    const body = data && data.body;
    const site = body && body.site;
    if (!site) {
        console.warn(
            '[chargebee-webhooks] resolve: event missing site; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationBySite(this, site);
    if (!integrationId) {
        console.warn(
            `[chargebee-webhooks] resolve: no integration for site=${site}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'CHARGEBEE_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * CHARGEBEE_WEBHOOK — default no-op; consumers override via binding.handlers.
 */
async function onChargebeeWebhook({ data }) {
    // no-op — override via binding.handlers.CHARGEBEE_WEBHOOK
}

module.exports = {
    onChargebeeWebhookReceived,
    onChargebeeWebhookResolve,
    onChargebeeWebhook,
    extractSite,
};
