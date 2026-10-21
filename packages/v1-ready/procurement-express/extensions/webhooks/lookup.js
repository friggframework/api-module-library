/**
 * Resolve a ProcurementExpress company id (from webhook payload.company_id
 * or entity.externalId set in Definition.getEntityDetails) to the owning
 * Frigg integration id.
 *
 * Entity externalIds use the `company:<id>` form from definition.js.
 *
 * @param {Object} ctx - Extension / worker `this`
 * @param {string|number} companyId - PE company / employer id
 * @returns {Promise<string|null>}
 */
async function findIntegrationByCompanyId(ctx, companyId) {
    if (companyId === undefined || companyId === null) return null;
    const want = String(companyId);
    const wantPrefixed = `company:${want}`;

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
            if (!entity) continue;
            const ext = String(entity.externalId);
            const moduleMatch =
                entity.type === 'procurement-express' ||
                entity.module === 'procurement-express' ||
                !entity.type;
            if (
                moduleMatch &&
                (ext === want ||
                    ext === wantPrefixed ||
                    String(entity.companyId) === want)
            ) {
                return integration.id || integration._id || null;
            }
        }
        if (
            String(integration?.externalId) === want ||
            String(integration?.externalId) === wantPrefixed ||
            String(integration?.config?.companyId) === want
        ) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

/**
 * Resolve by PE webhook subscription id when hosts persist webhook ids on
 * the integration config (e.g. config.webhookIds).
 *
 * @param {Object} ctx
 * @param {string|number} webhookId
 * @returns {Promise<string|null>}
 */
async function findIntegrationByWebhookId(ctx, webhookId) {
    if (webhookId === undefined || webhookId === null) return null;
    const want = String(webhookId);

    const mo = ctx && ctx.integrationMO;
    if (!mo || typeof mo.list !== 'function') {
        return null;
    }

    const integrations = await mo.list({});
    const list = Array.isArray(integrations)
        ? integrations
        : integrations?.integrations || [];

    for (const integration of list) {
        const ids =
            integration?.config?.webhookIds ||
            integration?.config?.procurementExpressWebhookIds ||
            [];
        const asStrings = (Array.isArray(ids) ? ids : []).map(String);
        if (asStrings.includes(want)) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

module.exports = {
    findIntegrationByCompanyId,
    findIntegrationByWebhookId,
};
