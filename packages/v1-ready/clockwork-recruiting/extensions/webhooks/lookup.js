const { Definition } = require('../../definition');

/**
 * Reverse-lookup firm_subdomain → owning Frigg integration id.
 *
 * Wraps `findIntegrationByEntityExternalId` so webhook code reads in Clockwork
 * terms. Entity externalId is the firm subdomain (see definition.js).
 *
 * @param {Object} integration - IntegrationBase with `commands` wired.
 * @param {string} firmSubdomain
 * @returns {Promise<string|null>}
 */
async function findIntegrationByFirmSubdomain(integration, firmSubdomain) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByFirmSubdomain: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        firmSubdomain,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByFirmSubdomain,
};
