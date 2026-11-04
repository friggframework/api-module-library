const { Definition } = require('../../definition');

/**
 * HiBob-vocabulary wrapper around findIntegrationByEntityExternalId.
 * `companyId` from the webhook payload is the entity externalId stored at
 * auth time (derived from People search or supplied as company_id).
 *
 * @param {Object} integration - IntegrationBase instance with commands wired
 * @param {string|number} companyId - Bob company id from the webhook
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
