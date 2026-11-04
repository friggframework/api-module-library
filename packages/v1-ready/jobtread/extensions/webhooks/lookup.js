/**
 * Reverse-lookup: JobTread organization id → Frigg integration id.
 *
 * Entity.externalId is set to organization.id (or grant.id / grant-key
 * fingerprint) in definition.js getEntityDetails.
 *
 * @param {object} ctx - worker/integration context with `get` / models
 * @param {string} organizationId
 * @returns {Promise<string|null>} integration id
 */
async function findIntegrationByOrganizationId(ctx, organizationId) {
    if (!organizationId) return null;

    // Prefer an explicit helper when the host app provides one.
    if (typeof ctx.findIntegrationByExternalId === 'function') {
        return ctx.findIntegrationByExternalId({
            moduleName: 'jobtread',
            externalId: String(organizationId),
        });
    }

    // Fallback: scan hydrated integrations for a matching entity externalId.
    const integrations =
        (typeof ctx.listIntegrations === 'function'
            ? await ctx.listIntegrations()
            : ctx.integrations) || [];

    for (const integration of integrations) {
        const entities = integration?.entities || [];
        for (const entity of entities) {
            if (
                entity?.externalId === String(organizationId) ||
                entity?.identifiers?.externalId === String(organizationId)
            ) {
                return integration.id || integration._id || null;
            }
        }
    }
    return null;
}

module.exports = { findIntegrationByOrganizationId };
