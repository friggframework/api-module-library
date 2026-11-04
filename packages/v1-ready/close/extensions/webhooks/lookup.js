/**
 * Resolve a Close organization id (from webhook event.organization_id or
 * entity.externalId set in Definition.getEntityDetails) to the owning Frigg
 * integration id.
 *
 * @param {Object} ctx - Extension / worker `this`
 * @param {string} organizationId - Close organization id (orga_…)
 * @returns {Promise<string|null>}
 */
async function findIntegrationByOrganizationId(ctx, organizationId) {
    if (organizationId === undefined || organizationId === null) return null;
    const want = String(organizationId);

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
                (entity.type === 'close' ||
                    entity.module === 'close' ||
                    !entity.type)
            ) {
                return integration.id || integration._id || null;
            }
        }
        if (
            String(integration?.externalId) === want ||
            String(integration?.config?.organizationId) === want
        ) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

/**
 * Resolve by Close webhook `subscription_id` when hosts persist subscription
 * ids on the integration config (e.g. config.webhookSubscriptionIds).
 *
 * @param {Object} ctx
 * @param {string} subscriptionId - whsub_…
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
            integration?.config?.closeWebhookIds ||
            [];
        const asStrings = (Array.isArray(ids) ? ids : []).map(String);
        if (asStrings.includes(want)) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

module.exports = {
    findIntegrationByOrganizationId,
    findIntegrationBySubscriptionId,
};
