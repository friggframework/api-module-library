/**
 * Reverse-look up the Frigg integration that owns a Box user.
 *
 * Box V2 webhook payloads include `created_by.id` (the acting user).
 * Entity identity for this module is the Box user id from GET /users/me
 * (see definition.js).
 *
 * @param {Object} ctx - Integration / worker context with entity access
 * @param {string} userId - Box user id
 * @returns {Promise<string|null>} integration id, or null when not found
 */
async function findIntegrationByBoxUserId(ctx, userId) {
    if (!userId) return null;

    const entities =
        typeof ctx.getEntitiesForModule === 'function'
            ? await ctx.getEntitiesForModule('box')
            : typeof ctx.findEntitiesByExternalId === 'function'
              ? await ctx.findEntitiesByExternalId('box', String(userId))
              : null;

    if (!entities) {
        throw new Error(
            'box-webhooks: host does not expose entity lookup helpers'
        );
    }

    const list = Array.isArray(entities) ? entities : [entities];
    const matches = list.filter(
        (e) =>
            e &&
            (e.externalId === String(userId) ||
                e.identifiers?.externalId === String(userId))
    );

    if (matches.length === 0) return null;
    if (matches.length > 1) {
        throw new Error(
            `box-webhooks: ambiguous user id=${userId} matched ${matches.length} entities`
        );
    }

    return (
        matches[0].integrationId ||
        matches[0].integration_id ||
        matches[0].id ||
        null
    );
}

module.exports = { findIntegrationByBoxUserId };
