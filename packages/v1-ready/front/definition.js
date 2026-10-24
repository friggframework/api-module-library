require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Front OAuth module Definition.
 *
 * Identity: GET /me returns the company `{ id, name }` for the token
 * (https://dev.frontapp.com/reference/api-token-details). That company id
 * (`cmp_…`) is the stable externalId for entity + credential.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Front',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error('Front OAuth callback missing authorization code');
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const me = await api.getMe();
            if (!me?.id) {
                throw new Error(
                    'Front /me did not return a company id — cannot derive entity externalId'
                );
            }
            return {
                identifiers: { externalId: String(me.id), userId },
                details: { name: me.name || String(me.id) },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const me = await api.getMe();
            if (!me?.id) {
                throw new Error(
                    'Front /me did not return a company id — cannot derive credential externalId'
                );
            }
            return {
                identifiers: { externalId: String(me.id), userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },

        testAuthRequest: async (api) => api.getMe(),
    },
    env: {
        client_id: process.env.FRONT_CLIENT_ID,
        client_secret: process.env.FRONT_CLIENT_SECRET,
        // Omit when unset so schema validation does not see the string "undefined/front".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/front`
            : undefined,
    },
};

module.exports = { Definition };
