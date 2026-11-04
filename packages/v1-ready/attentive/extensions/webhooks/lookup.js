const { Definition } = require('../../definition');

/**
 * Attentive-vocabulary wrapper around findIntegrationByEntityExternalId.
 * companyId from /me (and webhook payloads) is the company externalId stored
 * at auth time.
 *
 * @param {Object} integration - IntegrationBase instance with commands wired
 * @param {string|number} companyId - Attentive installer company id
 * @returns {Promise<string|null>}
 */
async function findIntegrationByCompanyId(integration, companyId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByCompanyId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        companyId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByCompanyId,
};
