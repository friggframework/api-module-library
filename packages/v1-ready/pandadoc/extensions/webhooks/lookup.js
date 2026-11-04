const { Definition } = require('../../definition');

/**
 * PandaDoc-vocabulary wrapper around `findIntegrationByEntityExternalId`.
 * Entity externalId is the PandaDoc workspace id (see definition.js).
 *
 * Webhook document payloads do not include `workspace_id` in the documented
 * event body. Integrations should register the subscription URL with the
 * workspace id (query `workspace_id` or path param) so the receiver can
 * reverse-look up the owning Frigg integration. The create response's
 * `workspace_id` is the value to embed.
 *
 * @param {Object} integration - IntegrationBase instance with `commands`.
 * @param {string} workspaceId - PandaDoc workspace id.
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
