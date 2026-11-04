const { Definition } = require('../../definition');

/**
 * Notion-vocabulary wrapper around findIntegrationByEntityExternalId.
 * Notion webhook events carry `workspace_id`, which we persist as the entity
 * externalId at OAuth time.
 *
 * @param {Object} integration - IntegrationBase with `commands` wired.
 * @param {string} workspaceId - Notion workspace id from the webhook event.
 * @returns {Promise<string|null>}
 */
async function findIntegrationByWorkspaceId(integration, workspaceId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByWorkspaceId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        workspaceId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByWorkspaceId,
};
