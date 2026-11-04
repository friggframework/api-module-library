/**
 * Reverse-look up the Frigg integration that owns a Square merchant.
 *
 * Square webhook payloads include `merchant_id` on the event envelope
 * (https://developer.squareup.com/docs/webhooks/overview). Entity identity
 * for this module is the Square merchant id (see definition.js).
 *
 * @param {Object} ctx - Integration / worker context with entity access
 * @param {string} merchantId
 * @returns {Promise<string|null>} integration id, or null when not found
 */
async function findIntegrationByMerchantId(ctx, merchantId) {
    if (!merchantId) return null;

    const entities =
        typeof ctx.getEntitiesForModule === 'function'
            ? await ctx.getEntitiesForModule('square')
            : typeof ctx.findEntitiesByExternalId === 'function'
              ? await ctx.findEntitiesByExternalId('square', String(merchantId))
              : null;

    if (!entities) {
        throw new Error(
            'square-webhooks: host does not expose entity lookup helpers'
        );
    }

    const list = Array.isArray(entities) ? entities : [entities];
    const matches = list.filter(
        (e) =>
            e &&
            (e.externalId === String(merchantId) ||
                e.identifiers?.externalId === String(merchantId))
    );

    if (matches.length === 0) return null;
    if (matches.length > 1) {
        throw new Error(
            `square-webhooks: ambiguous merchant_id=${merchantId} matched ${matches.length} entities`
        );
    }

    return (
        matches[0].integrationId ||
        matches[0].integration_id ||
        matches[0].id ||
        null
    );
}

module.exports = { findIntegrationByMerchantId };
