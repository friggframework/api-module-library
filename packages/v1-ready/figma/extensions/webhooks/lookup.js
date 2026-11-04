const { Definition } = require('../../definition');

/**
 * Figma-vocabulary wrapper around `findIntegrationByEntityExternalId`.
 * Webhook payloads identify the delivering webhook (`webhook_id`) and often
 * a `file_key`, but the owning Frigg entity is the authorizing Figma user
 * (`/v1/me`.id). Callers that persist a mapping from webhook_id → user
 * externalId should resolve that before calling this helper, or pass the
 * user id directly when known.
 *
 * @param {Object} integration - IntegrationBase instance with `commands`
 * @param {string|number} externalId - Figma user id (entity.externalId)
 * @returns {Promise<string|null>}
 */
async function findIntegrationByFigmaUserId(integration, externalId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByFigmaUserId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        externalId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByFigmaUserId,
};
