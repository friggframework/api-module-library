/**
 * Resolve a Xero tenantId to a Frigg integration mapping.
 *
 * Ambiguous resolution (one tenant owned by multiple integrations) must throw
 * rather than risk cross-tenant routing — same rule as HubSpot's portal lookup.
 *
 * @param {object} deps
 * @param {Function} deps.findIntegrationsByExternalEntityId
 * @param {string} tenantId - Xero connection tenantId from the webhook event.
 * @returns {Promise<object>} A single integration mapping.
 */
async function resolveIntegrationForTenant(
    { findIntegrationsByExternalEntityId },
    tenantId
) {
    if (!tenantId) {
        throw new Error('Xero webhook: missing tenantId on event');
    }
    const matches = await findIntegrationsByExternalEntityId(String(tenantId));
    const list = Array.isArray(matches) ? matches : [];
    if (list.length === 0) {
        throw new Error(
            `Xero webhook: no integration mapping for tenantId ${tenantId}`
        );
    }
    if (list.length > 1) {
        throw new Error(
            `Xero webhook: ambiguous integration mapping for tenantId ${tenantId} (${list.length} matches)`
        );
    }
    return list[0];
}

module.exports = { resolveIntegrationForTenant };
