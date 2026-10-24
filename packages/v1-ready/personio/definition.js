require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Apply client credentials / company_id from auth params onto the api.
 * Shared by setAuthParams and getToken.
 */
function applyAuthParams(api, params) {
    const data = (params && params.data) || {};
    const clientId =
        get(params, 'client_id', null) ||
        get(params, 'clientId', null) ||
        get(data, 'client_id', null) ||
        get(data, 'clientId', null);
    const clientSecret =
        get(params, 'client_secret', null) ||
        get(params, 'clientSecret', null) ||
        get(data, 'client_secret', null) ||
        get(data, 'clientSecret', null);
    const companyId =
        get(params, 'company_id', null) ||
        get(params, 'companyId', null) ||
        get(data, 'company_id', null) ||
        get(data, 'companyId', null);
    const scope =
        get(params, 'scope', null) || get(data, 'scope', null);

    if (clientId) api.client_id = clientId;
    if (clientSecret) api.client_secret = clientSecret;
    if (companyId) api.company_id = String(companyId);
    if (scope) api.scope = scope;
    return api;
}

/**
 * Personio uses OAuth 2.0 client credentials (no browser redirect). There is no
 * public "/me" identity endpoint on the Personnel Data API, so the Frigg entity
 * externalId is the Personio `company_id` supplied at auth time — the same id
 * that webhook payloads carry for tenant identification.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Personio',
    requiredAuthMethods: {
        getAuthorizationRequirements: async (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => applyAuthParams(api, params),

        // Client credentials: no code exchange. Apply the submitted credentials,
        // then mint a Bearer token via POST /v2/auth/token (api.getTokenFromClientCredentials).
        getToken: async (api, params) => {
            applyAuthParams(api, params);
            return api.getTokenFromClientCredentials();
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const companyId = api.company_id;
            if (!companyId) {
                throw new Error(
                    'Personio: company_id is required to derive a stable account identity for entity routing.'
                );
            }
            return {
                identifiers: { externalId: String(companyId), userId },
                details: { name: `Personio ${companyId}` },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const companyId = api.company_id;
            if (!companyId) {
                throw new Error(
                    'Personio: company_id is required to derive a stable credential identity.'
                );
            }
            return {
                identifiers: { externalId: String(companyId), userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'client_id',
                'client_secret',
                'access_token',
                'accessTokenExpire',
                'company_id',
                'scope',
            ],
            entity: ['company_id'],
        },

        testAuthRequest: async (api) => {
            return api.testAuth();
        },
    },
    env: {
        client_id: process.env.PERSONIO_CLIENT_ID,
        client_secret: process.env.PERSONIO_CLIENT_SECRET,
        scope: process.env.PERSONIO_SCOPE,
        company_id: process.env.PERSONIO_COMPANY_ID,
    },
    encryption: {
        credentialFields: ['client_secret', 'access_token'],
    },
};

module.exports = { Definition };
