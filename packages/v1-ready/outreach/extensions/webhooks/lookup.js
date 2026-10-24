/**
 * Resolve an Outreach install externalId → Frigg integration id.
 *
 * Official webhook payloads do not include an organization id (see
 * https://developers.outreach.io/api/webhooks). Multi-tenant routing therefore
 * relies on a per-install webhook URL path param (`:externalId`) that matches
 * the entity externalId persisted at auth time.
 *
 * @param {Object} ctx - Integration / worker context with DB helpers
 * @param {string} externalId
 * @returns {Promise<string|null>}
 */
async function findIntegrationByExternalId(ctx, externalId) {
    if (externalId === undefined || externalId === null || externalId === '') {
        return null;
    }
    const id = String(externalId);

    // Prefer an explicit helper when the host provides one.
    if (typeof ctx.findIntegrationByModuleExternalId === 'function') {
        return ctx.findIntegrationByModuleExternalId('outreach', id);
    }

    // Fallback: scan loaded integrations for an Outreach entity match.
    const integrations =
        (typeof ctx.listIntegrations === 'function'
            ? await ctx.listIntegrations()
            : ctx.integrations) || [];

    const matches = [];
    for (const integration of integrations) {
        const entities = integration?.entities || [];
        for (const entity of entities) {
            const type = entity?.type || entity?.moduleName || entity?.name;
            if (String(type).toLowerCase() !== 'outreach') continue;
            if (String(entity.externalId) === id) {
                matches.push(integration.id || integration._id);
            }
        }
    }
    if (matches.length === 1) return String(matches[0]);
    if (matches.length > 1) {
        throw new Error(
            `Ambiguous Outreach externalId=${id}: ${matches.length} integrations`
        );
    }
    return null;
}

module.exports = { findIntegrationByExternalId };
