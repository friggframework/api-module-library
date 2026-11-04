/**
 * Resolve a Frigg integration id from a Factorial company_id.
 *
 * Employee (and most other) webhook payloads include `company_id` at the top
 * level of the resource body. The module persists that id as
 * entity.company_id / identifiers.externalId.
 *
 * @param {Object} ctx - Extension handler `this` (has DB / Entity access)
 * @param {string|number} companyId
 * @returns {Promise<string|null>} integration id, or null if not found
 */
async function findIntegrationByCompanyId(ctx, companyId) {
    if (companyId == null || companyId === '') return null;

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
    if (!entities || entities.length === 0) return null;
    if (entities.length > 1) {
        throw new Error(
            `Factorial webhooks: ambiguous company_id=${companyId} ` +
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
