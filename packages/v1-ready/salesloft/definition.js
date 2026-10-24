require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Salesloft is OAuth2 Authorization-Code authenticated (partners).
 * Team identity comes from GET /v2/team (`data.id` / `data.name`), matching
 * the prior v1 manager. User identity is available via GET /v2/me when needed.
 *
 * Docs:
 *   https://developers.salesloft.com/docs/platform/api-basics/oauth-authentication/
 *   https://developers.salesloft.com/docs/api/team-index/
 *   https://developers.salesloft.com/docs/api/me-index/
 */
async function resolveTeamIdentity(api) {
    const team = await api.getTeam();
    const data = team?.data || team;
    if (!data?.id) {
        throw new Error(
            'Salesloft: GET /v2/team did not return a team id. ' +
                'Response: ' +
                JSON.stringify(team)
        );
    }
    return {
        externalId: String(data.id),
        name: data.name || String(data.id),
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Salesloft',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) => ({
            url: api.getAuthorizationUri
                ? api.getAuthorizationUri()
                : api.authorizationUri,
            type: 'oauth2',
        }),
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) ||
                get(params?.data || {}, 'code', null);
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveTeamIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await resolveTeamIdentity(api);
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
            return api.getMe();
        },
    },
    env: {
        client_id: process.env.SALESLOFT_CLIENT_ID,
        client_secret: process.env.SALESLOFT_CLIENT_SECRET,
        // Omit when unset so schema validation does not see the string "undefined/salesloft".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/salesloft`
            : undefined,
    },
};

module.exports = { Definition };
