/**
 * Resolve a Frigg integration id from a ClickUp Workspace (team) id.
 *
 * Entity externalId is the authorized team id (see definition.js). Adopters
 * may override this lookup when wiring the extension.
 *
 * Mirrors hubspot's findIntegrationByPortalId shape.
 */
async function findIntegrationByTeamId(ctx, teamId) {
    if (teamId === undefined || teamId === null) return null;
    const id = String(teamId);

    if (typeof ctx.findIntegrationByExternalId === 'function') {
        return ctx.findIntegrationByExternalId(id);
    }
    if (typeof ctx.findIntegrationByTeamId === 'function') {
        return ctx.findIntegrationByTeamId(id);
    }
    return null;
}

module.exports = { findIntegrationByTeamId };
