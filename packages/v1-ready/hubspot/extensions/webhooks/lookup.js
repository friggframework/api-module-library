const HUBSPOT_MODULE_NAME = 'hubspot';

/**
 * HubSpot-vocabulary wrapper around the platform-neutral core helper
 * {@link IntegrationBase#findIntegrationByEntityExternalId}.
 *
 * Lives inside the api-module per the Tier 3 contract: "portalId" is HubSpot
 * vocabulary and does not belong in core. The wrapper takes the integration
 * instance explicitly so it can be called from extension default handlers
 * (where `this` is the integration) or from worker code that holds a handle
 * to an instance.
 *
 * Intentionally does not catch ambiguous-resolution errors — those signal a
 * cross-tenant routing risk that callers should not paper over.
 *
 * @param {Object} integration - An IntegrationBase instance (or any object exposing
 *     `findIntegrationByEntityExternalId(externalId, moduleName)`).
 * @param {string|number} portalId - The HubSpot portal/hub ID from the webhook event.
 * @returns {Promise<string|null>} The Frigg integration id, or null if no matching
 *     integration exists for that portal.
 */
async function findIntegrationByPortalId(integration, portalId) {
    if (!integration || typeof integration.findIntegrationByEntityExternalId !== 'function') {
        throw new Error(
            'findIntegrationByPortalId: integration instance must expose findIntegrationByEntityExternalId()'
        );
    }
    return integration.findIntegrationByEntityExternalId(
        portalId,
        HUBSPOT_MODULE_NAME
    );
}

module.exports = {
    findIntegrationByPortalId,
    HUBSPOT_MODULE_NAME,
};
