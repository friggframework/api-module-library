const { Definition } = require('../../definition');

/**
 * Reverse-look up the Frigg integration that was granted access to an Airtable
 * base. Notification pings only carry `base.id` (and `webhook.id`); at OAuth
 * time we snapshot granted base ids onto entity.details.baseIds.
 *
 * @param {Object} integration - IntegrationBase with `commands` wired.
 * @param {string} baseId - Airtable base id from the webhook notification.
 * @returns {Promise<string|null>}
 */
async function findIntegrationByBaseId(integration, baseId) {
    if (!baseId) return null;

    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.getEntitiesForModule !== 'function'
    ) {
        // Fall back to externalId-style helper when hosts only expose that.
        if (
            integration &&
            integration.commands &&
            typeof integration.commands.findIntegrationByEntityExternalId ===
                'function'
        ) {
            // Not a user id — callers that persisted baseId as externalId can use this.
            return integration.commands.findIntegrationByEntityExternalId(
                baseId,
                Definition.moduleName
            );
        }
        throw new Error(
            'findIntegrationByBaseId: integration instance must expose commands.getEntitiesForModule() or findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }

    const entities = await integration.commands.getEntitiesForModule(
        Definition.moduleName
    );
    const list = Array.isArray(entities) ? entities : entities ? [entities] : [];
    const matches = list.filter((e) => {
        if (!e) return false;
        const details = e.details || {};
        const baseIds = details.baseIds || details.bases || [];
        if (Array.isArray(baseIds) && baseIds.map(String).includes(String(baseId))) {
            return true;
        }
        return (
            details.primaryBaseId === baseId ||
            details.baseId === baseId ||
            e.externalId === String(baseId)
        );
    });

    if (matches.length === 0) return null;
    if (matches.length > 1) {
        throw new Error(
            `airtable-webhooks: ambiguous base id=${baseId} matched ${matches.length} entities`
        );
    }

    return (
        matches[0].integrationId ||
        matches[0].integration_id ||
        matches[0].id ||
        null
    );
}

module.exports = { findIntegrationByBaseId };
