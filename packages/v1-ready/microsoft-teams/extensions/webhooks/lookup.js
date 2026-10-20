/**
 * Reverse-lookup: Microsoft Entra tenant id → owning Frigg integration id.
 *
 * Teams Graph change notifications carry `tenantId` on each item. The module
 * persists `tenant_id` on the entity (see definition apiPropertiesToPersist).
 */

async function findIntegrationByTenantId(integration, tenantId) {
    if (tenantId === undefined || tenantId === null || tenantId === '') {
        return null;
    }

    const Entity =
        (integration &&
            integration.constructor &&
            integration.constructor.Model &&
            integration.constructor.Model.Entity) ||
        (integration && integration.Model && integration.Model.Entity);

    if (!Entity || typeof Entity.find !== 'function') {
        throw new Error(
            'microsoft-teams webhooks: Entity model is not available on the integration instance'
        );
    }

    const matches = await Entity.find({
        'data.tenant_id': String(tenantId),
    });

    if (!matches || matches.length === 0) {
        return null;
    }
    if (matches.length > 1) {
        throw new Error(
            `microsoft-teams webhooks: ambiguous tenant_id=${tenantId} matched ${matches.length} entities`
        );
    }

    const entity = matches[0];
    return (
        entity.integrationId ||
        entity.integration_id ||
        (entity.integration && entity.integration.id) ||
        entity.id ||
        null
    );
}

module.exports = { findIntegrationByTenantId };
