/**
 * Resolve owning integration from an inbound Segment event.
 *
 * Segment analytics payloads do not always include workspaceId. We try, in
 * order:
 *   1. Explicit header X-Segment-Workspace-Id (Destination Function can set it)
 *   2. body.workspaceId / body.context.workspaceId
 *   3. body.writeKey matched against entity.details.writeKeys (if persisted)
 *
 * Open question: confirm the most reliable tenant key for Webhooks (Actions)
 * deliveries in production workspaces.
 */
async function findIntegrationBySegmentTenant(ctx, { workspaceId, writeKey }) {
    const Integration =
        ctx.Integration ||
        (ctx.integrationManager && ctx.integrationManager.Integration) ||
        null;

    if (!Integration || typeof Integration.find !== 'function') {
        return null;
    }

    if (workspaceId) {
        const byWorkspace = await Integration.find({
            'entities.externalId': String(workspaceId),
        });
        if (Array.isArray(byWorkspace) && byWorkspace.length === 1) {
            return byWorkspace[0].id || byWorkspace[0]._id;
        }
        if (Array.isArray(byWorkspace) && byWorkspace.length > 1) {
            throw new Error(
                `Ambiguous Segment workspaceId=${workspaceId}: ${byWorkspace.length} integrations`
            );
        }
    }

    if (writeKey) {
        const byWriteKey = await Integration.find({
            'entities.details.writeKeys': String(writeKey),
        });
        if (Array.isArray(byWriteKey) && byWriteKey.length === 1) {
            return byWriteKey[0].id || byWriteKey[0]._id;
        }
        if (Array.isArray(byWriteKey) && byWriteKey.length > 1) {
            throw new Error(
                `Ambiguous Segment writeKey: ${byWriteKey.length} integrations`
            );
        }
    }

    return null;
}

module.exports = { findIntegrationBySegmentTenant };
