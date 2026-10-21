/**
 * Resolve a Kit account id (`GET /account` → `account.id`) to the owning
 * Frigg integration id.
 *
 * Kit webhook deliveries do not include account id in the envelope
 * (https://developers.kit.com/webhooks/delivery-format). Multi-tenant hosts
 * should register endpoint URLs that embed the account id
 * (e.g. `/webhooks/:accountId`) so the receiver can route.
 *
 * Implementations vary by host app — this default walks `this.integrationMO`
 * when present and matches `entity.externalId`.
 *
 * @param {Object} ctx - Extension / worker `this`
 * @param {string} accountId - Kit account id
 * @returns {Promise<string|null>}
 */
async function findIntegrationByAccountId(ctx, accountId) {
    if (!accountId) return null;
    const want = String(accountId);

    const mo = ctx && ctx.integrationMO;
    if (!mo || typeof mo.list !== 'function') {
        return null;
    }

    const integrations = await mo.list({});
    const list = Array.isArray(integrations)
        ? integrations
        : integrations?.integrations || [];

    for (const integration of list) {
        const entities = integration?.entities || [];
        for (const entity of entities) {
            if (
                entity &&
                String(entity.externalId) === want &&
                (entity.type === 'kit' ||
                    entity.module === 'kit' ||
                    !entity.type)
            ) {
                return integration.id || integration._id || null;
            }
        }
        if (
            String(integration?.externalId) === want ||
            String(integration?.config?.accountId) === want
        ) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

module.exports = { findIntegrationByAccountId };
