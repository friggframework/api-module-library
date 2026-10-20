require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve the connected Box user for entity/credential identity.
 * Prefer GET /users/me; fall back to nothing — two customers must never
 * collide on a shared constant.
 */
async function resolveUserIdentity(api) {
    const user = await api.getCurrentUser();
    if (user?.id) {
        return {
            externalId: String(user.id),
            name: user.name || user.login || String(user.id),
        };
    }
    throw new Error(
        'Box: cannot derive a stable user identity — GET /users/me returned no id.'
    );
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Box',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params.data || {}, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveUserIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveUserIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getCurrentUser();
        },
    },
    env: {
        client_id: process.env.BOX_CLIENT_ID,
        client_secret: process.env.BOX_CLIENT_SECRET,
        scope: process.env.BOX_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/box`,
    },
};

module.exports = { Definition };
