const { verifyXeroWebhookSignature } = require('./signature-verifier');

/**
 * Xero fires an "Intent to receive" check when you save a webhook URL in the
 * Developer Portal. The payload still carries `events` (often empty) plus
 * `entropy`; signature verification alone is enough — respond 200 on valid
 * signature, 401 otherwise. Live deliveries use the same scheme.
 *
 * Docs: https://developer.xero.com/documentation/guides/webhooks/overview/
 */

function getWebhookKey() {
    return process.env.XERO_WEBHOOK_KEY || null;
}

/**
 * LIFE_CYCLE_EVENT: verify signature and enqueue resolve when events exist.
 * Always returns HTTP 200 on a valid signature so Xero marks the endpoint OK.
 */
async function onXeroWebhookReceived(params) {
    const { req, res } = params;
    const key = getWebhookKey();
    if (!verifyXeroWebhookSignature(req, key)) {
        if (res && !res.headersSent) {
            res.status(401).send('Unauthorized');
        }
        return { status: 401 };
    }

    if (res && !res.headersSent) {
        res.status(200).send();
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const events = Array.isArray(body.events) ? body.events : [];

    // Intent-to-receive may have zero events — signature check is the goal.
    if (events.length === 0) {
        return { status: 200, intentToReceive: true };
    }

    return {
        status: 200,
        enqueue: {
            event: 'XERO_WEBHOOK_RESOLVE',
            data: {
                events,
                lastEventSequence: body.lastEventSequence,
            },
        },
    };
}

/**
 * Worker: group events by tenantId and fan out to the consumer event.
 * Tenant → integration lookup needs the DB; keep this step separate from the
 * DB-free receiver (mirrors HubSpot's RECEIVED → RESOLVE → HANDLER pattern).
 */
async function onXeroWebhookResolve(params) {
    const { data } = params;
    const events = Array.isArray(data?.events) ? data.events : [];
    const byTenant = new Map();
    for (const event of events) {
        const tenantId = event.tenantId;
        if (!tenantId) continue;
        if (!byTenant.has(tenantId)) byTenant.set(tenantId, []);
        byTenant.get(tenantId).push(event);
    }

    const enqueue = [];
    for (const [tenantId, tenantEvents] of byTenant.entries()) {
        enqueue.push({
            event: 'XERO_WEBHOOK',
            data: { tenantId, events: tenantEvents },
        });
    }
    return { enqueue };
}

/**
 * Default no-op consumer. Integrations override via binding.handlers.
 */
async function onXeroWebhook(_params) {
    return { handled: false };
}

module.exports = {
    onXeroWebhookReceived,
    onXeroWebhookResolve,
    onXeroWebhook,
};
