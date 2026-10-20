const { Definition } = require('../../definition');

/**
 * Resolve a Frigg integration id from the Shopify shop domain on a webhook
 * delivery (`X-Shopify-Shop-Domain`). Entity externalId is the myshopify
 * domain (see definition.getEntityDetails).
 *
 * @param {Object} integration - IntegrationBase with createFriggCommands
 * @param {string} shopDomain - e.g. acme.myshopify.com
 * @returns {Promise<string|null>}
 */
async function findIntegrationByShopDomain(integration, shopDomain) {
    if (
        !integration ||
        !integration.commands ||
        typeof integration.commands.findIntegrationByEntityExternalId !==
            'function'
    ) {
        throw new Error(
            'findIntegrationByShopDomain: integration instance must expose commands.findIntegrationByEntityExternalId()'
        );
    }
    return integration.commands.findIntegrationByEntityExternalId(
        shopDomain,
        Definition.moduleName
    );
}

module.exports = {
    findIntegrationByShopDomain,
};
