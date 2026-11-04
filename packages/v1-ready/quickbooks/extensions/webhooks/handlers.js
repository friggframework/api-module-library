const { verifyQuickBooksSignature } = require('./signature-verifier');
const { findIntegrationByRealmId } = require('./lookup');

/**
 * Normalize Intuit webhook bodies into [{ realmId, entity }] rows.
 * Supports:
 *   - Legacy: { eventNotifications: [{ realmId, dataChangeEvent: { entities } }] }
 *   - CloudEvents batch: [{ specversion, type, intuitentityid, intuitaccountid, ... }]
 */
function extractNotifications(body) {
    if (!body) return [];

    // CloudEvents: top-level array of envelopes
    if (Array.isArray(body)) {
        return body
            .map((evt) => {
                const realmId = evt?.intuitaccountid || evt?.intuitAccountId;
                if (realmId === undefined || realmId === null) return null;
                return {
                    realmId: String(realmId),
                    entity: {
                        name: evt?.type || 'unknown',
                        id: evt?.intuitentityid || evt?.intuitEntityId,
                        operation: evt?.type,
                        cloudEvent: evt,
                    },
                    format: 'cloudevents',
                };
            })
            .filter(Boolean);
    }

    // Legacy eventNotifications
    const notifications = body.eventNotifications;
    if (!Array.isArray(notifications)) return [];

    const rows = [];
    for (const note of notifications) {
        const realmId = note?.realmId;
        if (realmId === undefined || realmId === null) continue;
        const entities = note?.dataChangeEvent?.entities || [];
        if (!entities.length) {
            rows.push({
                realmId: String(realmId),
                entity: null,
                format: 'legacy',
                notification: note,
            });
            continue;
        }
        for (const entity of entities) {
            rows.push({
                realmId: String(realmId),
                entity,
                format: 'legacy',
                notification: note,
            });
        }
    }
    return rows;
}

/**
 * Receiver for POST /webhooks — DB-free. Verifies intuit-signature, then
 * enqueues one QUICKBOOKS_WEBHOOK_RESOLVE per entity (carrying realmId).
 */
async function onQuickBooksWebhookReceived({ req, res }) {
    const verification = verifyQuickBooksSignature({
        req,
        verifierToken: process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN,
    });
    if (!verification.valid) {
        console.warn(
            `[quickbooks-webhooks] rejecting webhook: ${verification.reason}`
        );
        res.status(401).json({ error: 'invalid signature' });
        return;
    }

    const rows = extractNotifications(req.body);
    const outcomes = await Promise.all(
        rows.map(async (row, i) => {
            if (!row.realmId) {
                console.warn(
                    `[quickbooks-webhooks] event[${i}] missing realmId; skipping`
                );
                return 'skipped';
            }
            await this.queueWebhook({
                event: 'QUICKBOOKS_WEBHOOK_RESOLVE',
                body: row,
            });
            return 'queued';
        })
    );

    const queued = outcomes.filter((o) => o === 'queued').length;
    res.status(200).json({
        received: rows.length,
        queued,
        skipped: rows.length - queued,
    });
}

/**
 * QUICKBOOKS_WEBHOOK_RESOLVE — worker hop with DB. Looks up realmId → integration,
 * then re-enqueues QUICKBOOKS_WEBHOOK bound to that id.
 */
async function onQuickBooksWebhookResolve({ data }) {
    const body = data && data.body;
    const realmId = body && body.realmId;
    if (realmId === undefined || realmId === null) {
        console.warn(
            '[quickbooks-webhooks] resolve: event missing realmId; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByRealmId(this, realmId);
    if (!integrationId) {
        console.warn(
            `[quickbooks-webhooks] resolve: no integration for realmId=${realmId}; skipping`
        );
        return;
    }

    await this.queueWebhook({
        event: 'QUICKBOOKS_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * QUICKBOOKS_WEBHOOK — default no-op; override via binding.handlers.
 */
async function onQuickBooksWebhook({ data }) {
    // no-op — override via binding.handlers.QUICKBOOKS_WEBHOOK
}

module.exports = {
    onQuickBooksWebhookReceived,
    onQuickBooksWebhookResolve,
    onQuickBooksWebhook,
    extractNotifications,
};
