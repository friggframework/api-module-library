const { Definition } = require('../../definition');

/**
 * Chargebee-vocabulary wrapper around
 * `commands.findIntegrationByEntityExternalId`. The entity externalId for this
 * module is the Chargebee site subdomain (see definition.js).
 *
 * Register webhook URLs with `?site=<subdomain>` (or pass `site` in the JSON
 * body) so RECEIVED → RESOLVE can bind the delivery to the owning integration.
 * Chargebee event payloads expose `site_id` (opaque), not the subdomain, so the
 * query/body site is required for reverse lookup.
 *
 * @param {Object} integration
 * @param {string} site - Chargebee site subdomain
 * @returns {Promise<string|null>}
 */
async function findIntegrationBySite(integration, site) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationBySite: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        site,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationBySite,
};
