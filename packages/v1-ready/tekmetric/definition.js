require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve a stable shop identity for the connected Tekmetric credential.
 *
 * Prefer GET /shops (array of authorized shops). Fall back to the first shop
 * id from the OAuth token `scope` via GET /shops/{id}. The source module called
 * a non-existent GET /shop — that path is not on the official docs nav.
 */
async function resolveShopIdentity(api) {
    let shops = await api.listShops();
    if (!Array.isArray(shops) && Array.isArray(shops?.content)) {
        shops = shops.content;
    }
    if (Array.isArray(shops) && shops.length > 0 && shops[0]?.id != null) {
        const shop = shops[0];
        return {
            externalId: String(shop.id),
            name: shop.name || shop.nickname || String(shop.id),
            shop,
        };
    }

    const scopeShopId = Array.isArray(api.shopIds) ? api.shopIds[0] : null;
    if (scopeShopId) {
        const shop = await api.getShop(scopeShopId);
        if (shop?.id != null) {
            return {
                externalId: String(shop.id),
                name: shop.name || shop.nickname || String(shop.id),
                shop,
            };
        }
    }

    throw new Error(
        'Tekmetric: cannot derive a stable shop identity — GET /shops returned no shops and token scope had no shop id.'
    );
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Tekmetric',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) => {
            if (api && typeof api.getAuthorizationRequirements === 'function') {
                return api.getAuthorizationRequirements();
            }
            return new Api({}).getAuthorizationRequirements();
        },
        /**
         * Exchange client_credentials for an access_token, or accept a
         * pre-issued bearer (TEKMETRIC_API_KEY / access_token).
         */
        getToken: async (api, params = {}) => {
            const data = params.data || params || {};
            const clientId =
                get(data, 'client_id', null) ||
                get(params, 'client_id', null) ||
                api.client_id;
            const clientSecret =
                get(data, 'client_secret', null) ||
                get(params, 'client_secret', null) ||
                api.client_secret;
            const accessToken =
                get(data, 'access_token', null) ||
                get(data, 'api_key', null) ||
                get(params, 'access_token', null) ||
                get(params, 'api_key', null);

            if (clientId) api.client_id = clientId;
            if (clientSecret) api.client_secret = clientSecret;

            if (accessToken) {
                api.access_token = String(accessToken)
                    .replace(/^Bearer\s+/i, '')
                    .trim();
                return { access_token: api.access_token };
            }

            return api.getAccessToken();
        },
        setAuthParams: async (api, params = {}) => {
            const clientId = get(params, 'client_id', null);
            const clientSecret = get(params, 'client_secret', null);
            const accessToken =
                get(params, 'access_token', null) ||
                get(params, 'api_key', null);

            if (clientId) api.client_id = clientId;
            if (clientSecret) api.client_secret = clientSecret;
            if (accessToken) {
                api.access_token = String(accessToken)
                    .replace(/^Bearer\s+/i, '')
                    .trim();
            }
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveShopIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    address: identity.shop?.address,
                    phone: identity.shop?.phone,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveShopIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'client_id', 'client_secret'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.listShops();
        },
    },
    env: {
        client_id: process.env.TEKMETRIC_CLIENT_ID,
        client_secret: process.env.TEKMETRIC_CLIENT_SECRET,
        api_key: process.env.TEKMETRIC_API_KEY,
        // Optional override; Api also reads TEKMETRIC_BASE_URL directly.
        // Schema key is base_url (uri). Default sandbox when unset.
        base_url:
            process.env.TEKMETRIC_BASE_URL ||
            'https://sandbox.tekmetric.com/api/v1',
    },
};

module.exports = { Definition, resolveShopIdentity };
