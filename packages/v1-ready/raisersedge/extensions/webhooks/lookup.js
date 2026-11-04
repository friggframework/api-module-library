/**
 * Resolve a Blackbaud environment_id (from webhook payload or entity details)
 * to the owning Frigg integration id.
 *
 * Entity.externalId is md5(environment_id) — see definition.js — so we also
 * accept that hash form when hosts look up by externalId.
 */

const crypto = require('crypto');

function hashEnvironmentId(environmentId) {
    return crypto.createHash('md5').update(String(environmentId)).digest('hex');
}

/**
 * @param {Object} ctx - Extension / worker `this`
 * @param {string} environmentId - Blackbaud environment_id
 * @returns {Promise<string|null>}
 */
async function findIntegrationByEnvironmentId(ctx, environmentId) {
    if (environmentId === undefined || environmentId === null) return null;
    const want = String(environmentId);
    const wantHash = hashEnvironmentId(want);

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
            const isModule =
                entity.type === 'raisersedge' ||
                entity.module === 'raisersedge' ||
                !entity.type;
            if (!isModule) continue;
            if (
                String(entity.externalId) === want ||
                String(entity.externalId) === wantHash ||
                String(entity.details?.environment_id) === want
            ) {
                return integration.id || integration._id || null;
            }
        }
        if (
            String(integration?.externalId) === want ||
            String(integration?.externalId) === wantHash ||
            String(integration?.config?.environmentId) === want
        ) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

/**
 * Resolve by Blackbaud webhook subscription id when hosts persist subscription
 * ids on the integration config (e.g. config.webhookSubscriptionIds).
 *
 * @param {Object} ctx
 * @param {string} subscriptionId
 * @returns {Promise<string|null>}
 */
async function findIntegrationBySubscriptionId(ctx, subscriptionId) {
    if (subscriptionId === undefined || subscriptionId === null) return null;
    const want = String(subscriptionId);

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
            integration?.config?.webhookSubscriptionIds ||
            integration?.config?.blackbaudWebhookIds ||
            [];
        const asStrings = (Array.isArray(ids) ? ids : []).map(String);
        if (asStrings.includes(want)) {
            return integration.id || integration._id || null;
        }
    }
    return null;
}

module.exports = {
    findIntegrationByEnvironmentId,
    findIntegrationBySubscriptionId,
    hashEnvironmentId,
};
