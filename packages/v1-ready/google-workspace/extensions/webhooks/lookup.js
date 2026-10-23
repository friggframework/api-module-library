/**
 * Reverse-look up the Frigg integration that owns a Google push notification.
 *
 * Entity identity for this module is the Google user id from OAuth2 userinfo
 * (see definition.js). Push notifications do not carry that user id — they
 * carry channel / resource ids. Resolution order:
 *   1. Match entity externalId to channelId when the host stored that mapping
 *   2. Match entity externalId / metadata to resourceId
 *   3. If the host has exactly one google-workspace entity, use it
 *      (typical single-connection installs)
 *
 * For multi-user installs, consumers should persist channelId → entity
 * mapping when calling watchFile / watchChanges / watchCalendarEvents.
 *
 * Docs:
 *   https://developers.google.com/workspace/drive/api/guides/push
 *
 * @param {Object} ctx - Integration / worker context with entity access
 * @param {Object} notification - Normalized notification (headers + optional body)
 * @returns {Promise<string|null>} integration id, or null when not found
 */
async function findIntegrationForNotification(ctx, notification) {
    const entities =
        typeof ctx.getEntitiesForModule === 'function'
            ? await ctx.getEntitiesForModule('google-workspace')
            : null;

    if (!entities) {
        throw new Error(
            'google-workspace-webhooks: host does not expose getEntitiesForModule'
        );
    }

    const list = (Array.isArray(entities) ? entities : [entities]).filter(
        Boolean
    );

    const channelId = notification && notification.channelId;
    if (channelId) {
        const match = findByExternalIdOrChannel(list, String(channelId));
        if (match) return integrationIdOf(match);
    }

    const resourceId = notification && notification.resourceId;
    if (resourceId) {
        const match = findByExternalIdOrChannel(list, String(resourceId));
        if (match) return integrationIdOf(match);
    }

    if (list.length === 1) {
        return integrationIdOf(list[0]);
    }

    return null;
}

function findByExternalIdOrChannel(list, value) {
    return (
        list.find((e) => {
            if (
                e.externalId === value ||
                e.identifiers?.externalId === value
            ) {
                return true;
            }
            const channels = e.details?.channelIds || e.channelIds || [];
            return Array.isArray(channels) && channels.includes(value);
        }) || null
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
};
