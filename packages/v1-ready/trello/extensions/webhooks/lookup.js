/**
 * Resolve a Trello member id to the owning Frigg integration id.
 *
 * Prefer putting `?memberId=<externalId>` on the webhook callbackURL when
 * creating subscriptions (Trello docs recommend app-specific callback query
 * params). Falls back to matching `entity.externalId` against idModel when
 * the webhook watches the member themselves.
 *
 * @param {Object} ctx - Extension / worker `this`
 * @param {string} memberId - Trello member id
 * @returns {Promise<string|null>}
 */
async function findIntegrationByMemberId(ctx, memberId) {
    if (!memberId) return null;
    const want = String(memberId);

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
                (entity.type === 'trello' ||
                    entity.module === 'trello' ||
                    !entity.type)
            ) {
                return integration.id || integration._id || null;
            }
        }
        if (
            String(integration?.externalId) === want ||
            String(integration?.config?.memberId) === want
        ) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

/**
 * Extract a member id from a Trello webhook payload.
 * Prefer `memberId` / `externalId` query params on callbackURL; else use
 * idModel when it looks like the watched model is the member.
 */
function extractMemberId(body) {
    if (!body || typeof body !== 'object') return null;

    const callbackURL = body.webhook && body.webhook.callbackURL;
    if (callbackURL && typeof callbackURL === 'string') {
        try {
            const u = new URL(callbackURL);
            const fromQuery =
                u.searchParams.get('memberId') ||
                u.searchParams.get('externalId') ||
                u.searchParams.get('memberID');
            if (fromQuery) return fromQuery;
        } catch (_e) {
            // ignore malformed callbackURL
        }
    }

    // When the webhook watches the member model, idModel is the member id.
    if (body.webhook && body.webhook.idModel) {
        return String(body.webhook.idModel);
    }
    return null;
}

module.exports = {
    findIntegrationByMemberId,
    extractMemberId,
};
