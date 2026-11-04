const { Definition } = require('../../definition');

/**
 * Reverse-look up the Frigg integration that owns a GitHub account/org id.
 *
 * GitHub repository webhook payloads include `repository.owner.id`. For OAuth
 * App connections the entity `externalId` is the authenticated user's id
 * (from GET /user). That matches user-owned repositories. Org-owned repos
 * require the entity to be keyed by the org id (or a GitHub App installation
 * id) — see open questions in the PR.
 *
 * @param {Object} integration - IntegrationBase instance with `commands`
 * @param {string|number} ownerId - GitHub account/org numeric id
 * @returns {Promise<string|null>}
 */
async function findIntegrationByOwnerId(integration, ownerId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByOwnerId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        ownerId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByOwnerId,
};
