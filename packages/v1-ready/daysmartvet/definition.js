require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * DaySmart Vet uses OAuth 2.0 client credentials (no browser redirect).
 * Identity comes from GET /clinic — prefer resource.apiKey (stable clinic key)
 * and fall back to the configured api_key used in REST paths.
 *
 * Docs: https://sandbox.vettersoftware.com/docs/
 */
async function resolveClinicIdentity(api) {
    try {
        const result = await api.getClinic();
        const resource = result?.response?.resource || result?.resource || result;
        if (resource?.apiKey) {
            return {
                externalId: String(resource.apiKey),
                name: resource.name || 'DaySmart Vet',
                email: resource.email || undefined,
                phone: resource.phone || undefined,
            };
        }
        if (resource?.name) {
            return {
                externalId: String(api.api_key || resource.name),
                name: resource.name,
                email: resource.email || undefined,
                phone: resource.phone || undefined,
            };
        }
    } catch (e) {
        // fall through to configured clinic api_key
    }

    if (!api?.api_key) {
        throw new Error(
            'DaySmart Vet: cannot derive a stable account identity — clinic lookup failed and no api_key is configured.'
        );
    }
    return {
        externalId: String(api.api_key),
        name: 'DaySmart Vet',
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'DaySmartVet',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
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
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'apiKey', null) ||
                get(data, 'api_key', null) ||
                get(data, 'apiKey', null);
            const environment =
                get(params, 'environment', null) ||
                get(data, 'environment', null);
            const baseUrl =
                get(params, 'base_url', null) || get(data, 'base_url', null);
            const tokenUri =
                get(params, 'token_uri', null) || get(data, 'token_uri', null);

            if (clientId) api.client_id = clientId;
            if (clientSecret) api.client_secret = clientSecret;
            if (apiKey) api.setApiKey(apiKey);
            if (environment) api.setEnvironment(environment);
            if (baseUrl) {
                api.baseUrl = baseUrl;
                if (!tokenUri) {
                    api.tokenUri = `${String(baseUrl).replace(/\/+$/, '')}/oauth/access_token`;
                }
            }
            if (tokenUri) api.tokenUri = tokenUri;
            return api;
        },

        getToken: async (api, params) => {
            if (params) {
                await Definition.requiredAuthMethods.setAuthParams(api, params);
            }
            return api.getTokenFromClientCredentials();
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveClinicIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    email: identity.email,
                    phone: identity.phone,
                    environment: api.environment,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveClinicIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'accessTokenExpire',
                'client_id',
                'client_secret',
                'api_key',
                'scope',
                'environment',
            ],
            entity: ['api_key', 'environment'],
        },

        testAuthRequest: async (api) => {
            return api.getClinic();
        },
    },
    env: {
        client_id: process.env.DAYSMARTVET_CLIENT_ID,
        client_secret: process.env.DAYSMARTVET_CLIENT_SECRET,
        api_key: process.env.DAYSMARTVET_API_KEY,
        base_url: process.env.DAYSMARTVET_BASE_URL,
    },
};

module.exports = { Definition };
