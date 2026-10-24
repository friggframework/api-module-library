require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Shopify is OAuth2-authenticated per shop. The merchant's `*.myshopify.com`
 * domain is collected before the authorize redirect (same pattern as Frontify's
 * domain field), then persisted on the credential so subsequent GraphQL calls
 * hit the correct shop host.
 *
 * Entity externalId is the shop's GraphQL id (stable) with myshopifyDomain as
 * the display name.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Shopify',
    requiredAuthMethods: {
        getAuthorizationRequirements: async function (api) {
            return {
                url: api.getAuthUri(),
                type: 'oauth2',
                data: {
                    jsonSchema: {
                        title: 'Shopify Authentication',
                        type: 'object',
                        required: ['shop'],
                        properties: {
                            shop: {
                                type: 'string',
                                title: 'Shop domain',
                            },
                        },
                    },
                    uiSchema: {
                        shop: {
                            'ui:help':
                                'Your Shopify store domain, e.g. acme.myshopify.com (or just acme).',
                            'ui:placeholder': 'acme.myshopify.com',
                        },
                    },
                },
            };
        },
        getToken: async function (api, params) {
            const code =
                get(params, 'code', null) || get(params.data, 'code', null);
            const shop =
                get(params, 'shop', null) ||
                get(params.data, 'shop', null) ||
                get(params, 'shop_domain', null) ||
                get(params.data, 'shop_domain', null);
            if (shop) api.setShop(shop);
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            // Callback often includes shop; ensure the API is pointed at it.
            const shopFromCallback =
                get(callbackParams, 'shop', null) ||
                get(callbackParams?.data, 'shop', null);
            if (shopFromCallback && !api.shop) api.setShop(shopFromCallback);

            const shop = await api.getShop();
            return {
                identifiers: {
                    externalId: shop.myshopifyDomain || shop.id,
                    userId,
                },
                details: {
                    name: shop.name,
                    email: shop.email,
                    myshopifyDomain: shop.myshopifyDomain,
                    currencyCode: shop.currencyCode,
                },
            };
        },
        getCredentialDetails: async function (api, userId) {
            const shop = await api.getShop();
            return {
                identifiers: {
                    externalId: shop.myshopifyDomain || shop.id,
                    userId,
                },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'shop',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: [],
        },
        testAuthRequest: async function (api) {
            return api.getShop();
        },
    },
    env: {
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        scope: process.env.SHOPIFY_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/shopify".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/shopify`
            : undefined,
    },
};

module.exports = { Definition };
