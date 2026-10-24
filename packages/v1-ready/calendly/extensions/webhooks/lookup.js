const { Definition } = require('../../definition');

/**
 * Calendly-vocabulary wrapper around the platform-neutral friggCommand
 * `findIntegrationByEntityExternalId`. Calendly entities use the authenticated
 * user's URI (`GET /users/me` → `resource.uri`) as externalId. Webhook
 * envelopes carry that same URI in `created_by` (the user who created the
 * webhook subscription).
 *
 * @param {Object} integration - An IntegrationBase instance with `commands`
 *     wired (see `createFriggCommands` in @friggframework/core).
 * @param {string} userUri - The Calendly user URI from the webhook envelope.
 * @returns {Promise<string|null>} The Frigg integration id, or null if none.
 */
async function findIntegrationByUserUri(integration, userUri) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByUserUri: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        userUri,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByUserUri,
};
