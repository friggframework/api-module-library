const { Definition } = require('../../definition');

/**
 * Salesloft-vocabulary wrapper around findIntegrationByEntityExternalId.
 * Entity externalId is the Salesloft team id (GET /v2/team → data.id).
 * Webhook deliveries may carry `tenant_id`; whether that equals team id is
 * an open question documented in the PR — callers should only pass values
 * known to match the entity's externalId.
 *
 * @param {Object} integration
 * @param {string|number} teamId
 * @returns {Promise<string|null>}
 */
async function findIntegrationByTeamId(integration, teamId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByTeamId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        teamId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByTeamId,
};
