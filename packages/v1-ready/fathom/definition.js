require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Fathom is API-key authenticated (X-Api-Key header). There is no OAuth flow
 * and no dedicated "/me" identity endpoint on the public REST API, so identity
 * is derived from the first meeting's `recorded_by` where available, falling
 * back to a stable label. testAuthRequest simply performs an authenticated
 * list call.
 */
async function resolveAccountIdentity(api) {
    try {
        const result = await api.listMeetings({});
        const first = Array.isArray(result?.items) ? result.items[0] : null;
        const recordedBy = first?.recorded_by;
        if (recordedBy?.email) {
            return {
                externalId: recordedBy.email,
                name: recordedBy.team || recordedBy.name || recordedBy.email,
            };
        }
    } catch (e) {
        // fall through to a stable default identity
    }
    return { externalId: 'fathom-account', name: 'Fathom' };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Fathom',
    requiredAuthMethods: {
        getAuthorizationRequirements: () => ({
            type: 'apiKey',
            data: {
                jsonSchema: {
                    title: 'Fathom Authentication',
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
                            'Generate an API key in Fathom under User Settings > API Access. Sent as the X-Api-Key header.',
                    },
                },
            },
        }),
        setAuthParams: async (api, params) => {
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'access_token', null);
            api.setApiKey(apiKey);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveAccountIdentity(api);
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
            // Any authenticated call proves the key works.
            return api.listMeetings({});
        },
    },
    env: {
        api_key: process.env.FATHOM_API_KEY,
    },
};

module.exports = { Definition };
