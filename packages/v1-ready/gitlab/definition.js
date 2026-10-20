require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * GitLab is OAuth 2.0 for marketplace / connected apps (authorization code +
 * refresh). Entity/credential identity is the authenticated user's numeric id
 * from GET /user — stable per GitLab user on a given instance. Self-Managed
 * installs set `host` / GITLAB_HOST so the same numeric id on another instance
 * does not collide at the credential layer (host is persisted).
 *
 * Docs: https://docs.gitlab.com/api/users/#retrieve-the-current-user
 *       https://docs.gitlab.com/api/oauth2/
 */
async function resolveUserIdentity(api) {
    const user = await api.getCurrentUser();
    if (user?.id == null) {
        throw new Error(
            'GitLab: GET /user did not return an id — cannot derive a stable externalId'
        );
    }
    return {
        externalId: String(user.id),
        name: user.name || user.username || String(user.id),
        username: user.username || null,
        // read_user scope documents public_email; current-user payload may also
        // include private `email` (APIEntitiesUserPublic in openapi_v3).
        email: user.public_email || user.email || null,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'GitLab',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error(
                    'GitLab OAuth callback missing authorization code'
                );
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveUserIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    username: identity.username,
                    email: identity.email,
                    host: api.host,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveUserIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { host: api.host },
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'host',
            ],
            entity: ['host'],
        },

        testAuthRequest: async (api) => api.getCurrentUser(),
    },
    env: {
        client_id: process.env.GITLAB_CLIENT_ID,
        client_secret: process.env.GITLAB_CLIENT_SECRET,
        scope: process.env.GITLAB_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/gitlab`,
        base_url: process.env.GITLAB_HOST,
    },
};

module.exports = { Definition };
