const { Definition } = require('../../definition');

/**
 * HubSpot-vocabulary wrapper around the platform-neutral friggCommand
 * `findIntegrationByEntityExternalId`. The command is the canonical access
 * point for cross-cutting reverse lookups; this wrapper exists so the
 * api-module's webhook code reads in HubSpot terms ("portalId") rather than
 * the generic "externalId / moduleName" pair.
 *
 * Lives inside the api-module per the Tier 3 contract: "portalId" is HubSpot
 * vocabulary and does not belong in core. The wrapper takes the integration
 * instance explicitly so it can be called from extension default handlers
 * (where `this` is the integration) or from worker code that holds a handle
 * to an instance.
 *
 * The module name is sourced from `definition.js` so a rename of the api
 * module flows through automatically.
 *
 * Intentionally does not catch ambiguous-resolution errors — those signal a
 * cross-tenant routing risk that callers should not paper over.
 *
 * @param {Object} integration - An IntegrationBase instance with `commands`
 *     wired (see `createFriggCommands` in @friggframework/core).
 * @param {string|number} portalId - The HubSpot portal/hub ID from the
 *     webhook event.
 * @returns {Promise<string|null>} The Frigg integration id, or null if no
 *     matching integration exists for that portal.
 */
async function findIntegrationByPortalId(integration, portalId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByPortalId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in your integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        portalId,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByPortalId,
};
