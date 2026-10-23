const { Definition } = require('../../definition');
const crypto = require('crypto');

/**
 * Resolve a Frigg integration id from an Open Dental Customer API Key.
 *
 * Outbound entity identity is sha256(customerKey) (see definition.js). Inbound
 * API Events send the raw CustomerKey in the Authorization header — hash it
 * the same way before lookup.
 *
 * Docs: https://www.opendental.com/site/apievents.html
 *
 * @param {Object} integration - IntegrationBase instance with commands wired
 * @param {string} customerKey - Raw Customer API Key from the event header
 * @returns {Promise<string|null>}
 */
async function findIntegrationByCustomerKey(integration, customerKey) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByCustomerKey: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    const externalId = crypto
        .createHash('sha256')
        .update(String(customerKey))
        .digest('hex');
    return integration.commands.findIntegrationByEntityExternalId(
        externalId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByCustomerKey,
};
