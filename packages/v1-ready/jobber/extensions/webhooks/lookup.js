const { Definition } = require('../../definition');

/**
 * Resolve a Frigg integration id from a Jobber webhook `accountId`.
 *
 * Jobber webhook payloads carry `data.webHookEvent.accountId` (EncodedId of
 * the Jobber account). That value is stored as the entity externalId when the
 * module runs getEntityDetails after OAuth (from `account { id }`).
 *
 * @param {Object} integration - IntegrationBase instance with commands wired
 * @param {string} accountId - Jobber account EncodedId from the webhook
 * @returns {Promise<string|null>}
 */
async function findIntegrationByAccountId(integration, accountId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByAccountId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        accountId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByAccountId,
};
