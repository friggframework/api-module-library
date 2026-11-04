/**
 * Resolve a Frigg integration id from a Paychex companyId.
 *
 * Paychex webhook notifications carry `companyId`. The module may persist
 * that value as entity.company_id / identifiers.externalId.
 *
 * @param {Object} ctx - Extension handler `this` (has DB / Entity access)
 * @param {string} companyId
 * @returns {Promise<string|null>} integration id, or null if not found
 */
async function findIntegrationByCompanyId(ctx, companyId) {
    if (!companyId) return null;

    const Entity =
        ctx.Entity ||
        ctx.entityModel ||
        (ctx.moduleManager && ctx.moduleManager.Entity);
    if (!Entity || typeof Entity.find !== 'function') {
        return null;
    }

    const entities = await Entity.find({
        'identifiers.externalId': String(companyId),
    });
    if (!entities || entities.length === 0) {
        // Also try persisted company_id on entity details / fields.
        const byField = await Entity.find({ company_id: String(companyId) });
        if (!byField || byField.length === 0) return null;
        if (byField.length > 1) {
            throw new Error(
                `Paychex webhooks: ambiguous company_id=${companyId} ` +
                    `(${byField.length} entities)`
            );
        }
        const entity = byField[0];
        return (
            entity.integrationId ||
            entity.integration_id ||
            (entity.integration && entity.integration.id) ||
            null
        );
    }
    if (entities.length > 1) {
        throw new Error(
            `Paychex webhooks: ambiguous companyId=${companyId} ` +
                `(${entities.length} entities)`
        );
    }

    const entity = entities[0];
    return (
        entity.integrationId ||
        entity.integration_id ||
        (entity.integration && entity.integration.id) ||
        null
    );
}

module.exports = { findIntegrationByCompanyId };
