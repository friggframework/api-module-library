const { Definition } = require('../../definition');

/**
 * RingCentral-vocabulary wrapper around findIntegrationByEntityExternalId.
 * Routes webhook deliveries by accountId (entity.externalId from
 * readAccountInfo).
 *
 * @param {Object} integration - IntegrationBase instance with commands wired
 * @param {string|number} accountId - RingCentral account id from the event body
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
