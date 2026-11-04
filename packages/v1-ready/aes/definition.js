require('dotenv').config();
const crypto = require('crypto');
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * AES ConductorLink is API-key authenticated (`AES_API_KEY` header). There is
 * no OAuth flow and no dedicated identity endpoint. Organization identity is
 * the MD5 fingerprint of the API key (stable per credential). When events are
 * available, the first event's title is used as a friendly display name.
 */
function hashApiKey(apiKey) {
    return crypto.createHash('md5').update(String(apiKey)).digest('hex');
}

async function resolveOrganizationIdentity(api) {
    const apiKey = api?.api_key;
    if (!apiKey) {
        throw new Error(
            'AES: cannot derive a stable organization identity — no API key to fingerprint.'
        );
    }

    const externalId = hashApiKey(apiKey);
    let name = 'AES Organization';
    try {
        const events = await api.getOrganizationEvents();
        if (Array.isArray(events) && events.length > 0 && events[0].event_title) {
            name = events[0].event_title;
        }
    } catch (e) {
        // fall through — fingerprint identity is always available
    }
    return { externalId, name };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'AES',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'AES Authentication',
                    type: 'object',
                    required: ['api_key'],
                    properties: {
                        api_key: {
                            type: 'string',
                            title: 'AES API Key',
                        },
                    },
                },
                uiSchema: {
                    api_key: {
                        'ui:widget': 'password',
                        'ui:help':
                            "Your organization's AES ConductorLink API key. Email contactus@aesauctions.com to obtain it. Sent as the AES_API_KEY header.",
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
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveOrganizationIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveOrganizationIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['api_key'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getOrganizationEvents();
        },
    },
    env: {
        api_key: process.env.AES_API_KEY,
        base_url: process.env.AES_BASE_URL,
    },
};

module.exports = { Definition };
