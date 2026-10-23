const { verifyAirtableSignature } = require('./signature-verifier');
const { findIntegrationByBaseId } = require('./lookup');

/**
 * Receiver for POST /webhooks — DB-free.
 *
 * Airtable notification pings are small JSON bodies:
 *   { base: { id }, webhook: { id }, timestamp }
 * Actual change payloads are fetched later via listWebhookPayloads.
 *
 * Per-webhook MAC secrets are returned only at createWebhook time, so the
 * DB-free receiver verifies when AIRTABLE_WEBHOOK_MAC_SECRET (or a map in
 * AIRTABLE_WEBHOOK_MAC_SECRETS keyed by webhook id) is present; otherwise it
 * acknowledges shape-valid pings and defers MAC checks to the consumer that
 * stores macSecretBase64 alongside the webhook subscription.
 *
 * @see https://airtable.com/developers/web/api/webhooks-overview
 */
async function onAirtableWebhookReceived({ req, res }) {
    const body = req.body || {};
    const baseId = body.base && body.base.id;
    const webhookId = body.webhook && body.webhook.id;

    if (!baseId || !webhookId) {
        console.warn(
            '[airtable-webhooks] rejecting ping: missing base.id or webhook.id'
        );
        res.status(400).json({ error: 'invalid notification shape' });
        return;
    }

    const macSecret = resolveMacSecret(webhookId);
    if (macSecret) {
        const verification = verifyAirtableSignature({
            req,
            macSecretBase64: macSecret,
        });
        if (!verification.valid) {
            console.warn(
                `[airtable-webhooks] rejecting webhook: ${verification.reason}`
            );
            res.status(401).json({ error: 'invalid signature' });
            return;
        }
    }

    await this.queueWebhook({
        event: 'AIRTABLE_WEBHOOK_RESOLVE',
        body,
    });

    // Airtable expects 200 or 204 with an empty body for successful delivery.
    res.status(204).end();
}

function resolveMacSecret(webhookId) {
    if (process.env.AIRTABLE_WEBHOOK_MAC_SECRET) {
        return process.env.AIRTABLE_WEBHOOK_MAC_SECRET;
    }
    const mapRaw = process.env.AIRTABLE_WEBHOOK_MAC_SECRETS;
    if (!mapRaw) return null;
    try {
        const map = JSON.parse(mapRaw);
        return map && (map[webhookId] || map[String(webhookId)]) || null;
    } catch (e) {
        console.warn(
            '[airtable-webhooks] AIRTABLE_WEBHOOK_MAC_SECRETS is not valid JSON'
        );
        return null;
    }
}

/**
 * AIRTABLE_WEBHOOK_RESOLVE — worker hop with DB. Looks up base.id →
 * integration, then re-enqueues AIRTABLE_WEBHOOK bound to that id.
 */
async function onAirtableWebhookResolve({ data }) {
    const body = data && data.body;
    const baseId = body && body.base && body.base.id;
    if (!baseId) {
        console.warn(
            '[airtable-webhooks] resolve: event missing base.id; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByBaseId(this, baseId);
    if (!integrationId) {
        console.warn(
            `[airtable-webhooks] resolve: no integration for base.id=${baseId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'AIRTABLE_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * AIRTABLE_WEBHOOK — runs with the owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.AIRTABLE_WEBHOOK
 * (typically call listWebhookPayloads for the ping's webhook id).
 */
async function onAirtableWebhook({ data }) {
    // no-op — override via binding.handlers.AIRTABLE_WEBHOOK
}

module.exports = {
    onAirtableWebhookReceived,
    onAirtableWebhookResolve,
    onAirtableWebhook,
};
