/**
 * Resolve a Front company id (`authorization.id` / /me id) to the owning
 * Frigg integration id.
 *
 * Implementations vary by host app — this default walks
 * `this.integrationMO` when present and matches `entity.externalId`.
 *
 * @param {Object} ctx - Extension / worker `this`
 * @param {string} companyId - Front company id (`cmp_…`)
 * @returns {Promise<string|null>}
 */
async function findIntegrationByCompanyId(ctx, companyId) {
    if (!companyId) return null;
    const want = String(companyId);

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
                (entity.type === 'front' ||
                    entity.module === 'front' ||
                    !entity.type)
            ) {
                return integration.id || integration._id || null;
            }
        }
        // Some hosts store the company id on the integration itself.
        if (
            String(integration?.externalId) === want ||
            String(integration?.config?.companyId) === want
        ) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

module.exports = { findIntegrationByCompanyId };
