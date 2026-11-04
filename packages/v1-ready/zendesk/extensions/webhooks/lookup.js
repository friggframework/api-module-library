/**
 * Reverse-lookup: Zendesk subdomain → owning Frigg integration id.
 *
 * Expects the host to expose `this.findIntegrations` / credential search
 * consistent with the HubSpot webhook extension. Implementations vary by
 * Frigg app; this is a best-effort helper.
 *
 * @param {Object} ctx - Worker context (`this` from the event handler).
 * @param {string} subdomain
 * @returns {Promise<string|null>}
 */
async function findIntegrationBySubdomain(ctx, subdomain) {
    if (!subdomain) return null;
    const needle = String(subdomain).toLowerCase();

    if (typeof ctx.findIntegrationsByModule === 'function') {
        const rows = await ctx.findIntegrationsByModule('zendesk');
        const match = (rows || []).find((row) => {
            const entitySub =
                row?.entity?.subdomain ||
                row?.credentials?.subdomain ||
                row?.subdomain;
            return entitySub && String(entitySub).toLowerCase() === needle;
        });
        return match?.id || match?._id || null;
    }

    if (typeof ctx.listIntegrations === 'function') {
        const rows = await ctx.listIntegrations();
        const match = (rows || []).find((row) => {
            const name = row?.moduleName || row?.name;
            if (name !== 'zendesk') return false;
            const entitySub =
                row?.entity?.subdomain ||
                row?.credentials?.subdomain ||
                row?.subdomain;
            return entitySub && String(entitySub).toLowerCase() === needle;
        });
        return match?.id || match?._id || null;
    }

    console.warn(
        '[zendesk-webhooks] lookup: host does not expose findIntegrationsByModule/listIntegrations'
    );
    return null;
}

module.exports = { findIntegrationBySubdomain };
