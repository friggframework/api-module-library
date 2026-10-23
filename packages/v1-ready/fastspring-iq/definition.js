require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * FastSpring IQ is API-key authenticated (`api_key` header). There is a stable
 * identity endpoint: GET /my-organization returns `{ id, name, ... }` for the
 * key's organization — that id is the entity/credential externalId.
 */
async function resolveOrganization(api) {
    const org = await api.getMyOrganization();
    if (!org?.id) {
        throw new Error(
            'FastSpring IQ: getMyOrganization did not return an organization id'
        );
    }
    return {
        externalId: String(org.id),
        name: org.name || org.pathName || String(org.id),
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'FastSpringIQ',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const apiKey =
                get(params, 'api_key', null) ||
                get(params, 'apiKey', null) ||
                get(params, 'access_token', null) ||
                get(data, 'api_key', null) ||
                get(data, 'apiKey', null);
            if (apiKey) {
                api.setApiKey(apiKey);
            }
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveOrganization(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveOrganization(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: ['api_key'],
            entity: [],
        },

        testAuthRequest: async (api) => api.getMyOrganization(),
    },
    env: {
        api_key: process.env.FASTSPRING_IQ_API_KEY,
    },
};

module.exports = { Definition };
