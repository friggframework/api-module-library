require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * ActiveCampaign is API-key authenticated (`Api-Token` header) against an
 * account-specific base URL. Identity comes from GET /users/me.
 *
 * Credential fields: api_key + api_url (Developer tab values).
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'ActiveCampaign',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'ActiveCampaign Authentication',
                    type: 'object',
                    required: ['api_url', 'api_key'],
                    properties: {
                        api_url: {
                            type: 'string',
                            title: 'API Access URL',
                            description:
                                'From Settings → Developer. Example: https://youraccountname.api-us1.com',
                        },
                        api_key: {
                            type: 'string',
                            title: 'API Access Key',
                        },
                    },
                },
                uiSchema: {
                    api_url: {
                        'ui:help':
                            'Your API URL is on Settings → Developer. Always paste the full URL from that tab — do not invent a host from an account slug.',
                        'ui:placeholder':
                            'https://youraccountname.api-us1.com',
                    },
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Your API key is on Settings → Developer. Each user has their own key. Sent as the Api-Token header.',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'apiKey', null) ||
                get(params, 'access_token', null);
            const apiUrl =
                get(params, 'api_url', null) ||
                get(params, 'apiUrl', null);
            if (apiUrl) {
                api.setApiUrl(apiUrl);
            }
            api.setApiKey(apiKey);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const res = await api.getUser();
            const user = res?.user || {};
            const name =
                [user.firstName, user.lastName].filter(Boolean).join(' ') ||
                user.username ||
                user.email ||
                'ActiveCampaign';
            return {
                identifiers: {
                    externalId: String(user.id),
                    userId,
                },
                details: {
                    name,
                    email: user.email,
                    username: user.username,
                    api_url: api.api_url,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const res = await api.getUser();
            const user = res?.user || {};
            return {
                identifiers: {
                    externalId: String(user.id),
                    userId,
                },
                details: {
                    api_url: api.api_url,
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key', 'api_url'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getUser();
        },
    },
    env: {
        api_key: process.env.ACTIVECAMPAIGN_API_KEY,
        base_url: process.env.ACTIVECAMPAIGN_API_URL,
    },
};

module.exports = { Definition };
