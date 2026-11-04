const { Definition } = require('../../definition');

/**
 * QuickBooks-vocabulary wrapper around findIntegrationByEntityExternalId.
 * realmId (legacy) / intuitaccountid (CloudEvents) is the company externalId
 * stored at auth time.
 *
 * @param {Object} integration - IntegrationBase instance with commands wired
 * @param {string|number} realmId - QuickBooks company id from the webhook
 * @returns {Promise<string|null>}
 */
async function findIntegrationByRealmId(integration, realmId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByRealmId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        realmId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByRealmId,
};
