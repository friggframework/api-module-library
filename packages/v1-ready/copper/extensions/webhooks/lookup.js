/**
 * Resolve a Copper account id (from GET /account → entity.externalId) to the
 * owning Frigg integration id.
 *
 * Copper webhook notifications do not include the account id — only
 * `subscription_id`, `type`, `event`, and `ids[]`. Hosts that persist the
 * Copper account id as `entity.externalId` (see Definition.getEntityDetails)
 * can resolve via that. When the payload carries no account hint, callers may
 * pass the known account id from subscription metadata they stored.
 *
 * @param {Object} ctx - Extension / worker `this`
 * @param {string|number} accountId - Copper account id
 * @returns {Promise<string|null>}
 */
async function findIntegrationByAccountId(ctx, accountId) {
    if (accountId === undefined || accountId === null) return null;
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
                (entity.type === 'copper' ||
                    entity.module === 'copper' ||
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

/**
 * Resolve by Copper webhook `subscription_id` when hosts persist subscription
 * ids on the integration config (e.g. config.webhookSubscriptionIds).
 *
 * @param {Object} ctx
 * @param {string|number} subscriptionId
 * @returns {Promise<string|null>}
 */
async function findIntegrationBySubscriptionId(ctx, subscriptionId) {
    if (subscriptionId === undefined || subscriptionId === null) return null;
    const want = String(subscriptionId);

    const mo = ctx && ctx.integrationMO;
    if (!mo || typeof mo.list !== 'function') {
        return null;
    }

    const integrations = await mo.list({});
    const list = Array.isArray(integrations)
        ? integrations
        : integrations?.integrations || [];

    for (const integration of list) {
        const ids =
            integration?.config?.webhookSubscriptionIds ||
            integration?.config?.copperWebhookIds ||
            [];
        const asStrings = (Array.isArray(ids) ? ids : []).map(String);
        if (asStrings.includes(want)) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

module.exports = {
    findIntegrationByAccountId,
    findIntegrationBySubscriptionId,
};
