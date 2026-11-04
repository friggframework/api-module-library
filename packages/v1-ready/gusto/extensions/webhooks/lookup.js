/**
 * Resolve a Frigg integration id from a Gusto company UUID.
 *
 * Gusto webhook events carry `resource_uuid` / `resource_type: "Company"`.
 * The module persists that UUID as entity.company_uuid / externalId.
 *
 * @param {Object} ctx - Extension handler `this` (has DB / Entity access)
 * @param {string} companyUuid
 * @returns {Promise<string|null>} integration id, or null if not found
 */
async function findIntegrationByCompanyUuid(ctx, companyUuid) {
    if (!companyUuid) return null;

    // Prefer an Entity lookup by externalId (set in getEntityDetails).
    const Entity =
        ctx.Entity ||
        ctx.entityModel ||
        (ctx.moduleManager && ctx.moduleManager.Entity);
    if (!Entity || typeof Entity.find !== 'function') {
        return null;
    }

    const entities = await Entity.find({
        'identifiers.externalId': String(companyUuid),
    });
    if (!entities || entities.length === 0) return null;
    if (entities.length > 1) {
        throw new Error(
            `Gusto webhooks: ambiguous company_uuid=${companyUuid} ` +
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

module.exports = { findIntegrationByCompanyUuid };
