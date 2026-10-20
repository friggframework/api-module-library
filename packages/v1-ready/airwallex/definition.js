require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Airwallex authenticates with an API key + client id that mint a short-lived
 * bearer token (POST /api/v1/authentication/login). There is no OAuth
 * authorization-code redirect for the Client API key flow documented here.
 *
 * Identity comes from GET /api/v1/account (`id`, `nickname` / status).
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Airwallex',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Airwallex Authentication',
                    type: 'object',
                    required: ['client_id', 'api_key'],
                    properties: {
                        client_id: {
                            type: 'string',
                            title: 'Client ID',
                        },
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                        base_url: {
                            type: 'string',
                            title: 'Base URL',
                            default: 'https://api.airwallex.com',
                        },
                        login_as: {
                            type: 'string',
                            title: 'Login As (account id)',
                        },
                    },
                },
                uiSchema: {
                    client_id: {
                        'ui:help':
                            'Airwallex client unique identifier (x-client-id). Find it with your API key under Account → Developer → API keys.',
                    },
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Airwallex API key (x-api-key). Exchanged for a bearer token via POST /api/v1/authentication/login.',
                    },
                    base_url: {
                        'ui:help':
                            'Production https://api.airwallex.com or sandbox https://api.sandbox.airwallex.com',
                    },
                    login_as: {
                        'ui:help':
                            'Optional. Account id for x-login-as when the scoped key is linked to multiple accounts.',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const apiKey =
                get(params, 'api_key', null) || get(data, 'api_key', null);
            const clientId =
                get(params, 'client_id', null) || get(data, 'client_id', null);
            const baseUrl =
                get(params, 'base_url', null) || get(data, 'base_url', null);
            const loginAs =
                get(params, 'login_as', null) || get(data, 'login_as', null);

            if (apiKey) api.api_key = apiKey;
            if (clientId) api.client_id = clientId;
            if (baseUrl) {
                api.baseUrl = baseUrl;
                api.base_url = baseUrl;
            }
            if (loginAs) api.login_as = loginAs;

            // Mint the bearer token so subsequent calls (and testAuthRequest) work.
            await api.login();
            return api;
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const account = await api.getAccount();
            return {
                identifiers: {
                    externalId: String(account.id),
                    userId,
                },
                details: {
                    name:
                        account.nickname ||
                        account.identifier?.legal_entity_id ||
                        account.id,
                    status: account.status,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const account = await api.getAccount();
            return {
                identifiers: {
                    externalId: String(account.id),
                    userId,
                },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'api_key',
                'client_id',
                'access_token',
                'expires_at',
                'login_as',
                'base_url',
            ],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getAccount();
        },
    },
    env: {
        client_id: process.env.AIRWALLEX_CLIENT_ID,
        api_key: process.env.AIRWALLEX_API_KEY,
        // Always a URI so definition schema `format: uri` stays valid when unset.
        base_url:
            process.env.AIRWALLEX_BASE_URL || 'https://api.airwallex.com',
    },
    encryption: {
        credentialFields: ['api_key'],
    },
};

module.exports = { Definition };
