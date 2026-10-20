const { Definition } = require('../../definition');

/**
 * Typeform-vocabulary wrapper around `findIntegrationByEntityExternalId`.
 *
 * Entity `externalId` is the account email from GET /me. Typeform webhook
 * payloads do not include that email — they carry `form_response.form_id`.
 * Callers that have mapped a form to an integration (or that store email on
 * a related record) can still use this helper with the email; form_id-based
 * reverse lookup is an open question until a form→integration index exists.
 *
 * @param {Object} integration - IntegrationBase instance with `commands`
 * @param {string} externalId - Typeform account email (entity externalId)
 * @returns {Promise<string|null>}
 */
async function findIntegrationByTypeformExternalId(integration, externalId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByTypeformExternalId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        externalId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByTypeformExternalId,
};
