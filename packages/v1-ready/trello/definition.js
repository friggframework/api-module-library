require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve the authenticated Trello member as a stable account identity.
 * GET /members/me returns `id` (TrelloID) plus `fullName` / `username`.
 * There is deliberately no shared constant fallback — two customers must
 * never map to the same entity/credential.
 */
async function resolveMemberIdentity(api) {
    const me = await api.getMember('me');
    if (!me?.id) {
        throw new Error(
            'Trello: GET /members/me did not return a member id — cannot derive a stable account identity.'
        );
    }
    return {
        externalId: String(me.id),
        name: me.fullName || me.username || String(me.id),
        username: me.username || null,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Trello',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        setAuthParams: async (api, params) => {
            const data = (params && params.data) || {};
            const apiKey =
                get(params, 'api_key', null) ||
                get(data, 'api_key', null) ||
                get(params, 'key', null);
            const token =
                get(params, 'token', null) ||
                get(data, 'token', null) ||
                get(params, 'access_token', null);

            if (apiKey) api.setApiKey(apiKey);
            if (token) api.setToken(token);
            return api;
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveMemberIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    username: identity.username,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveMemberIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: ['api_key', 'token'],
            entity: [],
        },

        testAuthRequest: async (api) => api.getMember('me'),
    },
    env: {
        api_key: process.env.TRELLO_API_KEY,
        token: process.env.TRELLO_TOKEN,
        api_secret: process.env.TRELLO_API_SECRET,
    },
};

module.exports = { Definition };
