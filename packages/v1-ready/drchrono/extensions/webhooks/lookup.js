const { Definition } = require('../../definition');

/**
 * Resolve a Frigg integration id from a DrChrono practice / doctor identifier.
 *
 * Entity externalId is set from GET /api/users/current → practice_group
 * (fallback: user id) in getEntityDetails. Webhook object payloads typically
 * carry `doctor` (and sometimes practice-related fields); we try practice_group
 * first, then doctor.
 *
 * @param {Object} integration - IntegrationBase instance with commands wired
 * @param {string} externalId - practice_group or doctor id string
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
