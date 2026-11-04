require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Marketo uses OAuth 2.0 client credentials (Custom Service + API-Only user).
 * There is no browser redirect. Identity is the Munchkin ID (stable per
 * instance); the token response `scope` is the API-Only user email and is
 * kept as a display name when available.
 *
 * Built on the prior v1 module under packages/needs-updating/marketo
 * (client_credentials + leads/list membership), rewritten to the v2
 * Definition shape (legacy ORM models and manager removed).
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Marketo',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const munchkinId =
                get(params, 'munchkin_id', null) ||
                get(data, 'munchkin_id', null);
            const clientId =
                get(params, 'client_id', null) || get(data, 'client_id', null);
            const clientSecret =
                get(params, 'client_secret', null) ||
                get(data, 'client_secret', null);

            if (munchkinId) api.setMunchkinId(munchkinId);
            if (clientId) api.client_id = clientId;
            if (clientSecret) api.client_secret = clientSecret;
            return api;
        },

        getToken: async (api, params) => {
            // Form params may arrive here on first connect; wire them first.
            if (params) {
                await Definition.requiredAuthMethods.setAuthParams(api, params);
            }
            return api.getTokenFromClientCredentials();
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const externalId = api.munchkin_id;
            const name =
                tokenResponse?.scope ||
                api.token_scope ||
                `Marketo ${api.munchkin_id}`;
            return {
                identifiers: { externalId, userId },
                details: { name, munchkin_id: api.munchkin_id },
            };
        },

        getCredentialDetails: async (api, userId) => {
            return {
                identifiers: {
                    externalId: api.munchkin_id,
                    userId,
                },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'accessTokenExpire',
                'client_id',
                'client_secret',
            ],
            entity: ['munchkin_id'],
        },

        testAuthRequest: async (api) => {
            // Lightweight authenticated metadata call (Describe Lead2).
            return api.describeLeads();
        },
    },
    env: {
        client_id: process.env.MARKETO_CLIENT_ID,
        client_secret: process.env.MARKETO_CLIENT_SECRET,
        base_url: process.env.MARKETO_BASE_URL,
    },
    encryption: {
        // client_secret is custom beyond the core OAuth token fields.
        credentialFields: ['client_secret'],
    },
};

module.exports = { Definition };
