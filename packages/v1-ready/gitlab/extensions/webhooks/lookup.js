/**
 * Resolve a Frigg integration id from a GitLab project id.
 *
 * Project webhook payloads include `project.id` (and often `project_id`). That
 * numeric id is the stable routing key for a project-scoped hook. Adopters
 * persist project ids on the entity/config and override this lookup when wiring
 * the extension.
 *
 * Mirrors hubspot's findIntegrationByPortalId / monday's findIntegrationByBoardId.
 */
async function findIntegrationByProjectId(ctx, projectId) {
    if (projectId === undefined || projectId === null) return null;
    const id = String(projectId);

    if (typeof ctx.findIntegrationByExternalId === 'function') {
        return ctx.findIntegrationByExternalId(id);
    }
    if (typeof ctx.findIntegrationByProjectId === 'function') {
        return ctx.findIntegrationByProjectId(id);
    }
    return null;
}

module.exports = { findIntegrationByProjectId };
