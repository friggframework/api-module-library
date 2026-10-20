/**
 * Reverse-look up the Frigg integration that owns a Microsoft Graph tenant.
 *
 * Graph change notifications include `tenantId` on each notification object
 * (https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks).
 * Entity identity for this module prefers the organization id from
 * GET /organization (see definition.js), which matches tenantId for work/
 * school accounts.
 *
 * @param {Object} ctx - Integration / worker context with entity access
 * @param {string} tenantId
 * @returns {Promise<string|null>} integration id, or null when not found
 */
async function findIntegrationByTenantId(ctx, tenantId) {
    if (!tenantId) return null;

    const entities =
        typeof ctx.getEntitiesForModule === 'function'
            ? await ctx.getEntitiesForModule('sharepoint')
            : typeof ctx.findEntitiesByExternalId === 'function'
              ? await ctx.findEntitiesByExternalId(
                    'sharepoint',
                    String(tenantId)
                )
              : null;

    if (!entities) {
        throw new Error(
            'sharepoint-webhooks: host does not expose entity lookup helpers'
        );
    }

    const list = Array.isArray(entities) ? entities : [entities];
    const matches = list.filter(
        (e) =>
            e &&
            (e.externalId === String(tenantId) ||
                e.identifiers?.externalId === String(tenantId))
    );

    if (matches.length === 0) return null;
    if (matches.length > 1) {
        throw new Error(
            `sharepoint-webhooks: ambiguous tenantId=${tenantId} matched ${matches.length} entities`
        );
    }

    return (
        matches[0].integrationId ||
        matches[0].integration_id ||
        matches[0].id ||
        null
    );
}

module.exports = { findIntegrationByTenantId };
