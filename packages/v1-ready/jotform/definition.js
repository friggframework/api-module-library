require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Unwrap Jotform's `{ responseCode, message, content }` envelope when present.
 * Official SDKs disagree on whether callers see `content` only (Python) or the
 * full envelope (Node). We accept either so identity works against both.
 */
function unwrapContent(response) {
    if (response && typeof response === 'object' && 'content' in response) {
        return response.content;
    }
    return response;
}

/**
 * Jotform is API-key authenticated (`APIKEY` header). Identity comes from
 * GET /user → content.username (stable account handle).
 *
 * Optional `base_url` selects US / EU / HIPAA / Enterprise hosts.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Jotform',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Jotform Authentication',
                    type: 'object',
                    required: ['api_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'API Key',
                        },
                        base_url: {
                            type: 'string',
                            title: 'API Base URL (optional)',
                            description:
                                'Defaults to https://api.jotform.com. Use https://eu-api.jotform.com (EU), https://hipaa-api.jotform.com (HIPAA), or your Enterprise API host.',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            'Create a key under My Account → API. Sent as the APIKEY header. Use Full Access for write operations.',
                    },
                    base_url: {
                        'ui:help':
                            'Leave blank for the standard US host (https://api.jotform.com).',
                        'ui:placeholder': 'https://api.jotform.com',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'apiKey', null) ||
                get(params, 'access_token', null);
            const baseUrl =
                get(params, 'base_url', null) ||
                get(params, 'baseUrl', null) ||
                get(params, 'api_url', null) ||
                get(params, 'apiUrl', null);
            if (baseUrl) {
                api.setBaseUrl(baseUrl);
            }
            api.setApiKey(apiKey);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const res = await api.getUser();
            const user = unwrapContent(res) || {};
            const externalId = String(
                user.username || user.email || user.name || ''
            );
            if (!externalId) {
                throw new Error(
                    'Jotform: GET /user did not return a username/email to use as externalId.'
                );
            }
            return {
                identifiers: { externalId, userId },
                details: {
                    name: user.name || user.username || externalId,
                    email: user.email,
                    username: user.username,
                    account_type: user.account_type,
                    base_url: api.baseUrl,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const res = await api.getUser();
            const user = unwrapContent(res) || {};
            const externalId = String(
                user.username || user.email || user.name || ''
            );
            if (!externalId) {
                throw new Error(
                    'Jotform: GET /user did not return a username/email to use as externalId.'
                );
            }
            return {
                identifiers: { externalId, userId },
                details: {
                    base_url: api.baseUrl,
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key', 'base_url'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getUser();
        },
    },
    env: {
        api_key: process.env.JOTFORM_API_KEY,
        base_url: process.env.JOTFORM_BASE_URL,
    },
};

module.exports = { Definition, unwrapContent };
