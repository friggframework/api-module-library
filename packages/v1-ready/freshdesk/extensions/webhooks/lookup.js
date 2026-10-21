const { Definition } = require('../../definition');

/**
 * Freshdesk-vocabulary wrapper around the platform-neutral friggCommand
 * `findIntegrationByEntityExternalId`. Freshdesk entities use `account_id`
 * from GET /account as `externalId`; automation webhook URLs should pass
 * `?domain=` (helpdesk subdomain) so multi-tenant routing can fall back to
 * matching persisted credential `domain` when the payload lacks account_id.
 *
 * Pattern copied from packages/v1-ready/hubspot/extensions/webhooks/lookup.js.
 *
 * @param {Object} integration - IntegrationBase instance with `commands`.
 * @param {string|number} externalId - Freshdesk account_id (preferred) or
 *     another stable entity externalId.
 * @returns {Promise<string|null>}
 */
async function findIntegrationByAccountId(integration, externalId) {
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
        externalId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByAccountId,
};
