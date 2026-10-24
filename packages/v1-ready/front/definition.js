require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Front module Definition.
 *
 * Auth (both use Bearer against https://api2.frontapp.com):
 *   1. OAuth 2.0 authorization-code (required for public App Store apps)
 *   2. API token alternate — paste a token from Settings → Developers →
 *      API tokens via setAuthParams({ api_key }) or FRONT_API_TOKEN
 *
 * Identity: GET /me returns the company `{ id, name }` for the token
 * (https://dev.frontapp.com/reference/api-token-details). That company id
 * (`cmp_…`) is the stable externalId for entity + credential.
 *
 * Canonical mapping: `extensions.mapping` → support@1 (UNVALIDATED).
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

        /**
         * Alternate to OAuth: accept a Front API token (Bearer) directly.
         * Also accepts access_token / refresh_token for credential rehydration.
         */
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'apiKey', null) ||
                get(params, 'access_token', null);
            const refresh = get(params, 'refresh_token', null);
            if (apiKey) {
                api.setApiToken(apiKey);
            }
            if (refresh) {
                api.refresh_token = refresh;
            }
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
            // access_token holds either the OAuth access token or an API token.
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },

        testAuthRequest: async (api) => api.getMe(),
    },
    env: {
        client_id: process.env.FRONT_CLIENT_ID,
        client_secret: process.env.FRONT_CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/front`
            : undefined,
        api_key: process.env.FRONT_API_TOKEN,
    },
};

module.exports = { Definition };
