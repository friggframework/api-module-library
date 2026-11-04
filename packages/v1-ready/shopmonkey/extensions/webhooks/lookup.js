const { Definition } = require('../../definition');

/**
 * Reverse-lookup: Shopmonkey company id (or user id used as entity externalId)
 * → Frigg integration id.
 *
 * Entity.externalId is set to the authenticated user's id from GET /user/me
 * in definition.js. Inbound webhook payloads include company-scoped objects;
 * prefer `companyId` when present, else fall back to paths that may carry the
 * creating user id.
 *
 * @param {object} integration - Integration instance with frigg commands
 * @param {string} externalId
 * @returns {Promise<string|null>}
 */
async function findIntegrationByShopmonkeyExternalId(integration, externalId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByShopmonkeyExternalId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        externalId,
        Definition.moduleName
    );
}

module.exports = { findIntegrationByShopmonkeyExternalId };
