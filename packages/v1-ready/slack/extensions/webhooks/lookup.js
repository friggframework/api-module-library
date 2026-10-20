const { Definition } = require('../../definition');

/**
 * Slack-vocabulary wrapper around findIntegrationByEntityExternalId.
 * team_id from Events API payloads is the workspace externalId stored at auth.
 *
 * @param {Object} integration - IntegrationBase instance with commands wired
 * @param {string} teamId - Slack team_id from the event envelope
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
