require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * Miro is OAuth 2.0 for marketplace / connected apps. Entity identity is the
 * Miro user id from GET /v1/oauth-token (`user.id`), with team id available in
 * details for display. Credential identity uses the same user id so one
 * install maps to one Miro user authorization.
 *
 * Token response also includes `team_id` / `user_id` at exchange time; we prefer
 * the live token-info endpoint so identity stays current after refresh.
 */
async function resolveAccountIdentity(api) {
    const info = await api.getTokenInfo();
    const userId = info?.user?.id;
    if (userId == null) {
        throw new Error(
            'Miro: cannot derive a stable account identity — /v1/oauth-token returned no user.id.'
        );
    }
    const teamName = info?.team?.name;
    const userName = info?.user?.name;
    return {
        externalId: String(userId),
        name: teamName || userName || 'Miro',
        teamId: info?.team?.id != null ? String(info.team.id) : undefined,
        organizationId:
            info?.organization?.id != null
                ? String(info.organization.id)
                : undefined,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Miro',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) => ({
            url: api.authorizationUri,
            type: 'oauth2',
        }),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error('Miro OAuth callback missing authorization code');
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    teamId: identity.teamId,
                    organizationId: identity.organizationId,
                },
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
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },

        testAuthRequest: async (api) => api.getTokenInfo(),
    },
    env: {
        client_id: process.env.MIRO_CLIENT_ID,
        client_secret: process.env.MIRO_CLIENT_SECRET,
        scope: process.env.MIRO_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/miro".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/miro`
            : undefined,
    },
};

module.exports = { Definition };
