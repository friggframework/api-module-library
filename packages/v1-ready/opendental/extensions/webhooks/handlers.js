const { verifyOpenDentalEvent, getHeader } = require('./signature-verifier');
const { findIntegrationByCustomerKey } = require('./lookup');

/**
 * Open Dental API Event envelope: body is either a single object (UI events)
 * or an array of changed rows (database WatchTable events). Headers carry
 * Authorization (CustomerKey), Workstation, and Event-Type.
 *
 * Docs: https://www.opendental.com/site/apievents.html
 */
function extractEventMeta(req) {
    const headers = (req && req.headers) || {};
    const authorization = getHeader(headers, 'authorization');
    let customerKey = authorization ? String(authorization).trim() : null;
    const odfhir = customerKey && /^ODFHIR\s+[^/]+\/(.+)$/i.exec(customerKey);
    if (odfhir) customerKey = odfhir[1];

    return {
        customerKey,
        eventType: getHeader(headers, 'event-type') || null,
        workstation: getHeader(headers, 'workstation') || null,
        body: req && req.body,
    };
}

/**
 * Receiver for `POST /webhooks` — DB-free.
 *
 * When `OPENDENTAL_CUSTOMER_KEY` is set (single-tenant / local smoke), the
 * Authorization header must match that key. In multi-tenant Frigg apps that
 * env is usually unset — require a non-empty Authorization (CustomerKey) and
 * resolve the owning integration in the worker by hashing the key.
 */
async function onOpenDentalWebhookReceived({ req, res }) {
    const expectedKey = process.env.OPENDENTAL_CUSTOMER_KEY;
    if (expectedKey) {
        const verification = verifyOpenDentalEvent({
            req,
            customerKey: expectedKey,
        });
        if (!verification.valid) {
            console.warn(
                `[opendental-webhooks] rejecting event: ${verification.reason}`
            );
            res.status(401).json({ error: 'invalid authorization' });
            return;
        }
    }

    const meta = extractEventMeta(req);
    if (!meta.customerKey) {
        console.warn(
            '[opendental-webhooks] payload missing customer key; rejecting'
        );
        res.status(401).json({ error: 'missing authorization' });
        return;
    }

    await this.queueWebhook({
        event: 'OPENDENTAL_WEBHOOK_RESOLVE',
        body: meta,
    });

    res.status(200).json({ received: true, queued: true });
}

/**
 * OPENDENTAL_WEBHOOK_RESOLVE — worker (DB available). Maps customerKey →
 * integration, then re-enqueues OPENDENTAL_WEBHOOK bound to that integration.
 */
async function onOpenDentalWebhookResolve({ data }) {
    const body = data && data.body;
    const customerKey = body && body.customerKey;
    if (!customerKey) {
        console.warn(
            '[opendental-webhooks] resolve: event missing customerKey; skipping'
        );
        return;
    }

    const integrationId = await findIntegrationByCustomerKey(
        this,
        customerKey
    );
    if (!integrationId) {
        console.warn(
            '[opendental-webhooks] resolve: no integration for customer key; skipping'
        );
        return;
    }

    await this.queueWebhook({
        event: 'OPENDENTAL_WEBHOOK',
        integrationId,
        body,
    });
}

/**
 * OPENDENTAL_WEBHOOK — worker with owning integration hydrated.
 * Default no-op; consumers override via binding.handlers.OPENDENTAL_WEBHOOK.
 */
async function onOpenDentalWebhook({ data }) {
    // no-op — override via binding.handlers.OPENDENTAL_WEBHOOK
}

module.exports = {
    onOpenDentalWebhookReceived,
    onOpenDentalWebhookResolve,
    onOpenDentalWebhook,
    extractEventMeta,
};
