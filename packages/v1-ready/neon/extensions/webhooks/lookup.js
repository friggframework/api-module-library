/**
 * Resolve a Neon organizationId (webhook `organizationId`, or entity.externalId
 * set in Definition.getEntityDetails from Org ID) to the owning Frigg
 * integration id.
 *
 * @param {Object} ctx - Extension / worker `this`
 * @param {string} organizationId - Neon Org ID
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
                (entity.type === 'neon' ||
                    entity.module === 'neon' ||
                    !entity.type)
            ) {
                return integration.id || integration._id || null;
            }
        }
        if (
            String(integration?.externalId) === want ||
            String(integration?.config?.orgId) === want ||
            String(integration?.config?.organizationId) === want
        ) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

module.exports = {
    findIntegrationByOrganizationId,
};
