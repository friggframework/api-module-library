/**
 * Resolve a PayJunction merchant id (Pj-Merchant header / GET /merchant `id`)
 * to the owning Frigg integration id.
 *
 * @param {Object} ctx - Extension / worker `this`
 * @param {string} merchantId - PayJunction merchant UUID
 * @returns {Promise<string|null>}
 */
async function findIntegrationByMerchantId(ctx, merchantId) {
    if (merchantId === undefined || merchantId === null) return null;
    const want = String(merchantId);

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
                (entity.type === 'payjunction' ||
                    entity.module === 'payjunction' ||
                    !entity.type)
            ) {
                return integration.id || integration._id || null;
            }
        }
        if (
            String(integration?.externalId) === want ||
            String(integration?.config?.merchantId) === want ||
            String(integration?.config?.pjMerchantId) === want
        ) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

/**
 * Resolve by PayJunction webhook subscription id when hosts persist webhook
 * ids on the integration config (e.g. config.webhookIds).
 *
 * @param {Object} ctx
 * @param {string} webhookId
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
            integration?.config?.payjunctionWebhookIds ||
            [];
        const asStrings = (Array.isArray(ids) ? ids : []).map(String);
        if (asStrings.includes(want)) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

module.exports = {
    findIntegrationByMerchantId,
    findIntegrationByWebhookId,
};
