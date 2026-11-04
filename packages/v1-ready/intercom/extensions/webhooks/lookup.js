/**
 * Resolve an Intercom workspace / app id (`app_id` on webhook payloads, or
 * `/me.app.id_code`) to the owning Frigg integration id.
 *
 * Implementations vary by host app — this default walks
 * `this.integrationMO` when present and matches `entity.externalId`.
 *
 * @param {Object} ctx - Extension / worker `this`
 * @param {string} workspaceId - Intercom workspace id_code / app_id
 * @returns {Promise<string|null>}
 */
async function findIntegrationByWorkspaceId(ctx, workspaceId) {
    if (!workspaceId) return null;
    const want = String(workspaceId);

    const mo = ctx && ctx.integrationMO;
    if (!mo || typeof mo.list !== 'function') {
        return null;
    }

    const integrations = await mo.list({});
    const list = Array.isArray(integrations)
        ? integrations
        : integrations?.integrations || [];

    for (const integration of list) {
        const entities = integration?.entities || [];
        for (const entity of entities) {
            if (
                entity &&
                String(entity.externalId) === want &&
                (entity.type === 'intercom' ||
                    entity.module === 'intercom' ||
                    !entity.type)
            ) {
                return integration.id || integration._id || null;
            }
        }
        if (
            String(integration?.externalId) === want ||
            String(integration?.config?.workspaceId) === want ||
            String(integration?.config?.appId) === want
        ) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

module.exports = { findIntegrationByWorkspaceId };
