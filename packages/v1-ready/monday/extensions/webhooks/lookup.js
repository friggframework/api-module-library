/**
 * Resolve a Frigg integration id from a monday board id.
 *
 * monday board webhooks do not carry an account id in every payload; the
 * boardId is the stable routing key. Adopters persist boardId (or accountId)
 * on the entity/config and override this lookup when wiring the extension.
 *
 * Mirrors hubspot's findIntegrationByPortalId shape.
 */
async function findIntegrationByBoardId(ctx, boardId) {
    if (boardId === undefined || boardId === null) return null;
    const id = String(boardId);

    if (typeof ctx.findIntegrationByExternalId === 'function') {
        return ctx.findIntegrationByExternalId(id);
    }
    if (typeof ctx.findIntegrationByBoardId === 'function') {
        return ctx.findIntegrationByBoardId(id);
    }
    return null;
}

module.exports = { findIntegrationByBoardId };
