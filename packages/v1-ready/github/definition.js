require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * GitHub OAuth App module definition.
 *
 * Identity comes from GET /user (`users/get-authenticated`): `id` is the
 * durable externalId; `login` / `name` are display details.
 *
 * Register an OAuth App at https://github.com/settings/developers (or an org
 * settings page). Set GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / GITHUB_SCOPE
 * and REDIRECT_URI (callback path ends with /github).
 *
 * Recommended scopes for the surfaces this module covers (space-delimited in
 * GITHUB_SCOPE), from https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps:
 *   read:user user:email repo admin:repo_hook read:org
 * Trim to least privilege for your integration. `offline_access` opts into
 * expiring tokens + refresh_token at runtime.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'GitHub',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) ||
                get(params.data || {}, 'code', null);
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const user = await api.getAuthenticatedUser();
            if (!user || user.id === undefined || user.id === null) {
                throw new Error(
                    'GitHub: GET /user did not return an id. Response: ' +
                        JSON.stringify(user)
                );
            }
            return {
                identifiers: {
                    externalId: String(user.id),
                    userId,
                },
                details: {
                    name: user.name || user.login,
                    login: user.login,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const user = await api.getAuthenticatedUser();
            if (!user || user.id === undefined || user.id === null) {
                throw new Error(
                    'GitHub: GET /user did not return an id. Response: ' +
                        JSON.stringify(user)
                );
            }
            return {
                identifiers: {
                    externalId: String(user.id),
                    userId,
                },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
            ],
            entity: [],
        },

        testAuthRequest: async (api) => {
            return api.getAuthenticatedUser();
        },
    },
    env: {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        scope: process.env.GITHUB_SCOPE,
        // Only materialize when REDIRECT_URI is set — template literals turn
        // a missing env into the string "undefined/github", which fails the
        // api-module-definition schema's uri format check.
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/github`
            : undefined,
    },
};

module.exports = { Definition };
