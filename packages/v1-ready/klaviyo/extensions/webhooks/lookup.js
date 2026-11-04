const { Definition } = require('../../definition');

/**
 * Klaviyo-vocabulary wrapper around
 * `commands.findIntegrationByEntityExternalId`.
 *
 * System webhook payloads carry `meta.klaviyo_account_id`, which matches the
 * account `id` returned by GET /api/accounts/ (and persisted as the entity
 * externalId by definition.js).
 *
 * @param {Object} integration - IntegrationBase instance with `commands` wired.
 * @param {string} accountId - Klaviyo public account / site ID.
 * @returns {Promise<string|null>}
 */
async function findIntegrationByAccountId(integration, accountId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByAccountId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        accountId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByAccountId,
};
