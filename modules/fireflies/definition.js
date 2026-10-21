require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Fireflies',
    requiredAuthMethods: {
        // API-key module: renders the interactive CLI / hosted auth form.
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        // Core's process-authorization-callback calls setAuthParams(api, params)
        // for every non-oauth2 module. Without it, the real callback throws
        // `TypeError: setAuthParams is not a function`. Set the key onto the api.
        setAuthParams: async (api, params) => {
            const key =
                get(params, 'api_key', null) ||
                get(params, 'access_token', null) ||
                get(params?.data || {}, 'api_key', null) ||
                get(params?.data || {}, 'access_token', null);
            if (key) api.setApiKey(key);
        },

        // API-key exchange is a no-op — the key IS the credential. Persist it.
        getToken: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'access_token', null) ||
                get(params.data || {}, 'api_key', null);
            if (apiKey) {
                api.setApiKey(apiKey);
            }
            return { access_token: api.api_key, api_key: api.api_key };
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const user = await api.getUser();
            if (!user || !user.user_id) {
                throw new Error(
                    'Fireflies user query failed to return valid user info. ' +
                        'Response: ' +
                        JSON.stringify(user)
                );
            }
            return {
                identifiers: { externalId: user.user_id, userId },
                details: { name: user.name || user.email },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const user = await api.getUser();
            if (!user || !user.user_id) {
                throw new Error(
                    'Fireflies user query failed to return valid user info. ' +
                        'Response: ' +
                        JSON.stringify(user)
                );
            }
            return {
                identifiers: { externalId: user.user_id, userId },
                details: {},
            };
        },

        testAuthRequest: async (api) => {
            const user = await api.getUser();
            if (!user || !user.user_id) {
                throw new Error('Fireflies token is not valid');
            }
            return user;
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'api_key'],
            entity: [],
        },
    },
    env: {
        api_key: process.env.FIREFLIES_API_KEY,
    },
};

module.exports = { Definition };
