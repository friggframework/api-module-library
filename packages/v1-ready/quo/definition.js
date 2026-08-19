require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Quo',
    requiredAuthMethods: {
        // API-key module: render an interactive form (CLI + hosted UI)
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Quo API Authorization',
                    type: 'object',
                    required: ['api_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Your Quo (OpenPhone) API key from Settings → API. Sent raw in the Authorization header (no Bearer prefix).',
                        'ui:placeholder': 'API Key',
                    },
                },
            },
        }),

        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'access_token', null);
            if (apiKey) {
                api.setApiKey(apiKey);
            }
        },

        // Any authenticated call verifies the key. listPhoneNumbers is cheap
        // and always available on a valid workspace token.
        testAuthRequest: async (api) => api.listPhoneNumbers(),

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const phoneNumbers = await api.listPhoneNumbers();
            const first = get(phoneNumbers, 'data', [])[0] || {};
            const externalId = first.id || 'quo-workspace';
            return {
                identifiers: { externalId, user: userId },
                details: {
                    name: first.name || first.number || 'Quo Workspace',
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const phoneNumbers = await api.listPhoneNumbers();
            const first = get(phoneNumbers, 'data', [])[0] || {};
            const externalId = first.id || 'quo-workspace';
            return {
                identifiers: { externalId, user: userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            // ApiKeyRequester stores the key; persist it as access_token so the
            // Api constructor rehydrates it on the next instantiation.
            credential: ['access_token', 'api_key'],
            entity: [],
        },
    },
    env: {
        api_key: process.env.QUO_API_KEY,
        base_url: process.env.QUO_BASE_URL,
    },
};

module.exports = { Definition };
