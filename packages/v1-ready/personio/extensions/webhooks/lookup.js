const { Definition } = require('../../definition');

/**
 * Personio-vocabulary wrapper around findIntegrationByEntityExternalId.
 * `company_id` from the webhook payload is the entity externalId stored at
 * auth time.
 *
 * @param {Object} integration - IntegrationBase instance with commands wired
 * @param {string|number} companyId - Personio company id from the webhook
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
