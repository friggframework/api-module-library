/**
 * Resolve a GoHighLevel locationId to the owning Frigg integration.
 *
 * GHL webhooks are application-level: one URL serves every connected sub-account, so the
 * integration must be derived from the payload's locationId. On connect we persist an Entity
 * with externalId = locationId (see the module's getEntityDetails), so the platform-neutral
 * command resolves locationId → Entity → Integration. moduleName 'gohighlevel' disambiguates
 * from other modules' entities. Throws if the (locationId, moduleName) tuple maps to more than
 * one entity, or the entity is owned by more than one integration (cross-tenant guard).
 */
async function findIntegrationByLocationId(integration, locationId) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByLocationId: integration instance must expose commands.findIntegrationByEntityExternalId() — wire up createFriggCommands in the integration constructor.'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        locationId,
        'gohighlevel'
    );
}

module.exports = { findIntegrationByLocationId };
