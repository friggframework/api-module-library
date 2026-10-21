const { Definition } = require('../../definition');

/**
 * Resolve a Frigg integration id from a Housecall Pro webhook `company_id`.
 *
 * Public API webhook payloads carry `company_id` (location/company that owns
 * the affected record). That value is stored as the entity externalId when
 * the module runs getEntityDetails after OAuth (from GET /company → id).
 *
 * Note: for multi-location orgs, webhook `company_id` may be a location id
 * while GET /company returns the parent company id — see open questions.
 *
 * @param {Object} integration - IntegrationBase instance with commands wired
 * @param {string} companyId - Housecall Pro company_id from the webhook
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
