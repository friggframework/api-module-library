/**
 * Reverse-look up the Frigg integration that owns a Dropbox account.
 *
 * Dropbox webhook payloads include `list_folder.accounts` (account_id strings).
 * Entity identity for this module is the Dropbox account_id from
 * POST /users/get_current_account (see definition.js).
 *
 * @param {Object} ctx - Integration / worker context with entity access
 * @param {string} accountId - Dropbox account_id
 * @returns {Promise<string|null>} integration id, or null when not found
 */
async function findIntegrationByDropboxAccountId(ctx, accountId) {
    if (!accountId) return null;

    const entities =
        typeof ctx.getEntitiesForModule === 'function'
            ? await ctx.getEntitiesForModule('dropbox')
            : typeof ctx.findEntitiesByExternalId === 'function'
              ? await ctx.findEntitiesByExternalId('dropbox', String(accountId))
              : null;

    if (!entities) {
        throw new Error(
            'dropbox-webhooks: host does not expose entity lookup helpers'
        );
    }

    const list = Array.isArray(entities) ? entities : [entities];
    const matches = list.filter(
        (e) =>
            e &&
            (e.externalId === String(accountId) ||
                e.identifiers?.externalId === String(accountId))
    );

    if (matches.length === 0) return null;
    if (matches.length > 1) {
        throw new Error(
            `dropbox-webhooks: ambiguous account_id=${accountId} matched ${matches.length} entities`
        );
    }

    return (
        matches[0].integrationId ||
        matches[0].integration_id ||
        matches[0].id ||
        null
    );
}

module.exports = { findIntegrationByDropboxAccountId };
