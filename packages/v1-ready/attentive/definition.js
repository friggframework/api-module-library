require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Attentive module Definition.
 *
 * Auth (both use Bearer against https://api.attentivemobile.com/v1):
 *   1. OAuth 2.0 authorization-code (public / distributed apps)
 *   2. Private-app API key alternate — setAuthParams({ api_key }) or ATTENTIVE_API_KEY
 *
 * Identity: GET /me → companyId (stable externalId) + companyName.
 * @see https://docs.attentive.com/reference/getme
 *
 * Canonical mapping: `extensions.mapping` → business@1 Contact (UNVALIDATED).
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Attentive',
    mappings: {
        business: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error(
                    'Attentive OAuth callback missing authorization code'
                );
            }
            return api.getTokenFromCode(code);
        },

        /**
         * Alternate to OAuth: accept a private-app API key (Bearer) directly.
         * Also accepts access_token / id_token for credential rehydration.
         */
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'apiKey', null) ||
                get(params, 'access_token', null);
            const idToken = get(params, 'id_token', null);
            if (apiKey) {
                api.setApiToken(apiKey);
            }
            if (idToken) {
                api.id_token = idToken;
            }
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const me = await api.getMe();
            if (!me?.companyId) {
                throw new Error(
                    'Attentive /me did not return companyId — cannot derive entity externalId'
                );
            }
            return {
                identifiers: { externalId: String(me.companyId), userId },
                details: {
                    name: me.companyName || String(me.companyId),
                    attentiveDomainName: me.attentiveDomainName,
                    applicationName: me.applicationName,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const me = await api.getMe();
            if (!me?.companyId) {
                throw new Error(
                    'Attentive /me did not return companyId — cannot derive credential externalId'
                );
            }
            return {
                identifiers: { externalId: String(me.companyId), userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            // access_token holds either the OAuth access token or an API key.
            // id_token is returned by Attentive's token exchange.
            credential: ['access_token', 'id_token'],
            entity: [],
        },

        testAuthRequest: async (api) => api.getMe(),
    },
    env: {
        client_id: process.env.ATTENTIVE_CLIENT_ID,
        client_secret: process.env.ATTENTIVE_CLIENT_SECRET,
        scope: process.env.ATTENTIVE_SCOPES,
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/attentive`
            : undefined,
        api_key: process.env.ATTENTIVE_API_KEY,
    },
};

module.exports = { Definition };
