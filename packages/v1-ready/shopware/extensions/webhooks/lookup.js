/**
 * Resolve a Shop-Ware tenant id to a Frigg integration id.
 *
 * Expects entities persisted with `details.tenantId` (or identifiers
 * externalId equal to the tenant id string) for moduleName `shopware`.
 *
 * Returns null when no match — callers skip the event.
 */
async function findIntegrationByTenantId(ctx, tenantId) {
    if (tenantId == null || tenantId === '') return null;
    const needle = String(tenantId);

    const listEntities =
        ctx &&
        (ctx.listEntities ||
            (ctx.entityRepository &&
                ctx.entityRepository.list &&
                ctx.entityRepository.list.bind(ctx.entityRepository)));

    if (typeof listEntities !== 'function') {
        return null;
    }

    const entities = await listEntities({ moduleName: 'shopware' });
    const rows = Array.isArray(entities)
        ? entities
        : entities?.results || entities?.items || [];

    for (const entity of rows) {
        const details = entity.details || entity.data || {};
        const identifiers = entity.identifiers || {};
        const candidates = [
            details.tenantId,
            details.tenant_id,
            identifiers.externalId,
            entity.externalId,
        ]
            .filter((v) => v != null && v !== '')
            .map(String);
        if (candidates.includes(needle)) {
            return (
                entity.integrationId ||
                entity.integration_id ||
                details.integrationId ||
                null
            );
        }
    }
    return null;
}

module.exports = { findIntegrationByTenantId };
