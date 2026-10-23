/**
 * Resolve an Etsy shop_id (entity.externalId from Definition.getEntityDetails)
 * to the owning Frigg integration id.
 *
 * @param {Object} ctx - Extension / worker `this`
 * @param {string|number} shopId - Etsy shop id
 * @returns {Promise<string|null>}
 */
async function findIntegrationByShopId(ctx, shopId) {
    if (shopId === undefined || shopId === null) return null;
    const want = String(shopId);

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
                (entity.type === 'etsy' ||
                    entity.module === 'etsy' ||
                    !entity.type)
            ) {
                return integration.id || integration._id || null;
            }
        }
        if (
            String(integration?.externalId) === want ||
            String(integration?.config?.shopId) === want
        ) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

module.exports = {
    findIntegrationByShopId,
};
