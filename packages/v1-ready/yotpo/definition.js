require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Yotpo Core API uses store_id (app key) + API secret to mint an access token
 * (`X-Yotpo-Token`). There is no OAuth dance and no dedicated "/me" identity
 * endpoint on Core API — the store_id itself is the stable account identifier.
 *
 * Auth form collects store_id + secret; setAuthParams exchanges them for a
 * token via generateAccessToken() so testAuthRequest and subsequent calls are
 * authenticated.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Yotpo',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const storeId =
                get(params, 'store_id', null) ||
                get(data, 'store_id', null) ||
                get(params, 'app_key', null) ||
                get(data, 'app_key', null);
            const secret =
                get(params, 'secret', null) ||
                get(data, 'secret', null) ||
                get(params, 'api_secret', null) ||
                get(data, 'api_secret', null);
            const existingToken =
                get(params, 'access_token', null) ||
                get(data, 'access_token', null) ||
                get(params, 'api_key', null) ||
                get(data, 'api_key', null);

            if (storeId) api.store_id = storeId;
            if (secret) api.secret = secret;
            if (existingToken) {
                api.setApiKey(existingToken);
            } else if (api.store_id && api.secret) {
                await api.generateAccessToken();
            }
            return api;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            if (!api.store_id) {
                throw new Error(
                    'Yotpo: cannot derive account identity — store_id is required.'
                );
            }
            return {
                identifiers: { externalId: String(api.store_id), userId },
                details: { name: `Yotpo store ${api.store_id}` },
            };
        },

        getCredentialDetails: async (api, userId) => {
            if (!api.store_id) {
                throw new Error(
                    'Yotpo: cannot derive credential identity — store_id is required.'
                );
            }
            return {
                identifiers: { externalId: String(api.store_id), userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: ['store_id', 'secret', 'access_token'],
            entity: [],
        },

        testAuthRequest: async (api) => {
            // Any authenticated Core API call proves the token works.
            return api.listProducts({ limit: 1 });
        },
    },
    encryption: {
        // access_token is in the core encryption schema; secret is module-specific.
        credentialFields: ['secret'],
    },
    env: {},
};

module.exports = { Definition };
