require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve the connected Google account for entity/credential identity.
 * Drive/Calendar have no dedicated /me; identity comes from Google OAuth2
 * userinfo (https://www.googleapis.com/oauth2/v2/userinfo), which requires
 * the userinfo.email / userinfo.profile (or openid) scopes alongside
 * Drive/Calendar scopes.
 */
async function resolveUserIdentity(api) {
    const user = await api.getUserDetails();
    if (user?.id) {
        return {
            externalId: String(user.id),
            name: user.name || user.email || String(user.id),
        };
    }
    throw new Error(
        'Google Workspace: cannot derive a stable user identity — OAuth2 userinfo returned no id.'
    );
}

function resolveRedirectUri() {
    if (process.env.GOOGLE_WORKSPACE_REDIRECT_URI) {
        return process.env.GOOGLE_WORKSPACE_REDIRECT_URI;
    }
    if (process.env.REDIRECT_URI) {
        return `${process.env.REDIRECT_URI}/google-workspace`;
    }
    return undefined;
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'GoogleWorkspace',
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
            return api.getUserDetails();
        },
    },
    env: {
        client_id: process.env.GOOGLE_WORKSPACE_CLIENT_ID,
        client_secret: process.env.GOOGLE_WORKSPACE_CLIENT_SECRET,
        scope: process.env.GOOGLE_WORKSPACE_SCOPE,
        // Prefer GOOGLE_WORKSPACE_REDIRECT_URI; else ${REDIRECT_URI}/google-workspace.
        // Omit when unset so schema validation does not see "undefined/…".
        redirect_uri: resolveRedirectUri(),
    },
};

module.exports = { Definition };
