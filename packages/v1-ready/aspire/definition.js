require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Aspire Cloud API Definition — client-credentials auth via POST /Authorization
 * ({ ClientId, Secret } → { Token, RefreshToken }).
 *
 * There is no public "/me" identity endpoint. Entity/credential externalId is
 * the Aspire Client ID (unique per API credential set created under
 * Administration > Application > API).
 *
 * Docs:
 *   https://guide.youraspire.com/apidocs/authentication-authorization-2.md
 *   https://cloud-api.youraspire.com/swagger/v1/swagger.json
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Aspire',
    mappings: {
        business: 'extensions.mapping',
        billing: 'extensions.mapping',
    },
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) => {
            if (api && typeof api.getAuthorizationRequirements === 'function') {
                return api.getAuthorizationRequirements();
            }
            return new Api({}).getAuthorizationRequirements();
        },

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const clientId =
                get(params, 'clientId', null) ||
                get(params, 'client_id', null) ||
                get(data, 'clientId', null) ||
                get(data, 'client_id', null);
            const secret =
                get(params, 'secret', null) ||
                get(params, 'clientSecret', null) ||
                get(params, 'client_secret', null) ||
                get(data, 'secret', null) ||
                get(data, 'clientSecret', null) ||
                get(data, 'client_secret', null);
            const baseUrl =
                get(params, 'baseUrl', null) ||
                get(params, 'base_url', null) ||
                get(data, 'baseUrl', null) ||
                get(data, 'base_url', null);

            if (clientId) api.client_id = clientId;
            if (secret) api.client_secret = secret;
            if (baseUrl) api.baseUrl = baseUrl;
            return api;
        },

        getToken: async (api, params) => {
            if (params) {
                await Definition.requiredAuthMethods.setAuthParams(api, params);
            }
            const result = await api.getTokenFromClientCredentials();
            return {
                access_token: result.Token,
                refresh_token: result.RefreshToken,
                client_id: api.client_id,
                client_secret: api.client_secret,
            };
        },

        getEntityDetails: async (api, _callbackParams, _tokenResponse, userId) => {
            if (!api.client_id) {
                throw new Error(
                    'Aspire: client_id is required to derive a stable account identity.'
                );
            }
            return {
                identifiers: { externalId: String(api.client_id), userId },
                details: { name: 'Aspire API' },
            };
        },

        getCredentialDetails: async (api, userId) => {
            if (!api.client_id) {
                throw new Error(
                    'Aspire: client_id is required to derive a stable credential identity.'
                );
            }
            return {
                identifiers: { externalId: String(api.client_id), userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'client_id',
                'client_secret',
            ],
            entity: [],
        },

        testAuthRequest: async (api) => {
            return api.getCompanies({ top: 1 });
        },
    },
    env: {
        client_id: process.env.ASPIRE_CLIENT_ID,
        client_secret: process.env.ASPIRE_CLIENT_SECRET,
        base_url: process.env.ASPIRE_API_BASE_URL,
    },
    encryption: {
        credentialFields: ['client_secret'],
    },
};

module.exports = { Definition };
