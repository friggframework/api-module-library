/**
 * Reverse-look up the Frigg integration that owns a OneDrive / Graph notification.
 *
 * Entity identity for this module is the signed-in user id from GET /me
 * (see definition.js). Graph notifications for `/me/drive/root` do not always
 * carry that user id; they may include `tenantId` and `resource`.
 *
 * Resolution order:
 *   1. Parse `/users/{userId}/` from `resource` when present
 *   2. Match entity externalId to `tenantId` (work/school single-tenant installs)
 *   3. If the host has exactly one microsoft-onedrive entity, use it
 *      (typical personal / single-connection installs)
 *
 * For multi-user tenants, consumers should persist subscriptionId → entity
 * mapping when calling createSubscription.
 *
 * Docs: https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks
 *
 * @param {Object} ctx - Integration / worker context with entity access
 * @param {Object} notification - Single Graph notification object
 * @returns {Promise<string|null>} integration id, or null when not found
 */
async function findIntegrationForNotification(ctx, notification) {
    const entities =
        typeof ctx.getEntitiesForModule === 'function'
            ? await ctx.getEntitiesForModule('microsoft-onedrive')
            : null;

    if (!entities) {
        throw new Error(
            'microsoft-onedrive-webhooks: host does not expose getEntitiesForModule'
        );
    }

    const list = (Array.isArray(entities) ? entities : [entities]).filter(
        Boolean
    );

    const resource = notification && notification.resource;
    const userFromResource = extractUserIdFromResource(resource);
    if (userFromResource) {
        const match = findByExternalId(list, userFromResource);
        if (match) return integrationIdOf(match);
    }

    const tenantId = notification && notification.tenantId;
    if (tenantId) {
        const match = findByExternalId(list, String(tenantId));
        if (match) return integrationIdOf(match);
    }

    if (list.length === 1) {
        return integrationIdOf(list[0]);
    }

    return null;
}

function extractUserIdFromResource(resource) {
    if (!resource || typeof resource !== 'string') return null;
    const m = resource.match(/\/users\/([^/]+)\//i);
    return m ? decodeURIComponent(m[1]) : null;
}

function findByExternalId(list, externalId) {
    return (
        list.find(
            (e) =>
                e.externalId === externalId ||
                e.identifiers?.externalId === externalId
        ) || null
    );
}

function integrationIdOf(entity) {
    return (
        entity.integrationId ||
        entity.integration_id ||
        entity.id ||
        null
    );
}

module.exports = {
    findIntegrationForNotification,
    extractUserIdFromResource,
};
