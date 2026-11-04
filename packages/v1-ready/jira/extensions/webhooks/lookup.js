/**
 * Resolve a Frigg integration id from a Jira Cloud site cloudId.
 *
 * Dynamic webhook payloads do not always include cloudId; adopters typically
 * persist cloudId on the entity/credential and override this lookup when wiring
 * the extension (or pass cloudId via the webhook URL path/query).
 *
 * Mirrors hubspot's findIntegrationByPortalId shape.
 */
async function findIntegrationByCloudId(ctx, cloudId) {
    if (cloudId === undefined || cloudId === null) return null;
    const id = String(cloudId);

    if (typeof ctx.findIntegrationByExternalId === 'function') {
        return ctx.findIntegrationByExternalId(id);
    }
    if (typeof ctx.findIntegrationByCloudId === 'function') {
        return ctx.findIntegrationByCloudId(id);
    }
    return null;
}

module.exports = { findIntegrationByCloudId };
