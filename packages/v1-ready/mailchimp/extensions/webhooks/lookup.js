const { Definition } = require('../../definition');

/**
 * Mailchimp-vocabulary wrapper around
 * `commands.findIntegrationByEntityExternalId`.
 *
 * Entity externalId is the Mailchimp `account_id` from GET / (see
 * definition.js). Classic list webhook payloads do not include account_id;
 * recommend creating webhooks with `?account_id={account_id}` on the callback
 * URL so the receiver can pass it through to resolve.
 *
 * @param {Object} integration - IntegrationBase instance with `commands` wired.
 * @param {string} accountId - Mailchimp account_id.
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
