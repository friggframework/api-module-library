const { Definition } = require('../../definition');

/**
 * Mercury-vocabulary wrapper around
 * `commands.findIntegrationByEntityExternalId`.
 *
 * Mercury webhook event payloads do not include an organization id. Register
 * webhook URLs with `?externalId=<entityExternalId>` (the account id or token
 * fingerprint persisted by definition.js) so RECEIVED → RESOLVE can bind the
 * delivery to the owning integration.
 *
 * @param {Object} integration
 * @param {string} externalId - Entity externalId for this Mercury install
 * @returns {Promise<string|null>}
 */
async function findIntegrationByExternalId(integration, externalId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByExternalId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        externalId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByExternalId,
};
