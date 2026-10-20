require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

async function resolveWorkspaceIdentity(api) {
    const info = await api.authTest();
    const teamId = info.team_id || api.team_id;
    if (!teamId) {
        throw new Error(
            'Slack: auth.test did not return team_id — cannot derive a stable workspace externalId'
        );
    }
    return {
        externalId: String(teamId),
        name: info.team || api.team_name || String(teamId),
        team_id: String(teamId),
        user_id: info.user_id || null,
        bot_id: info.bot_id || null,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Slack',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error('Slack OAuth callback missing authorization code');
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            // Prefer team from the token response (available before auth.test).
            const teamFromToken =
                get(tokenResponse, 'team.id', null) ||
                get(tokenResponse, 'team_id', null) ||
                api.team_id;
            if (teamFromToken) {
                api.team_id = String(teamFromToken);
                api.team_name =
                    get(tokenResponse, 'team.name', null) || api.team_name;
            }
            const identity = await resolveWorkspaceIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {
                    name: identity.name,
                    team_id: identity.team_id,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveWorkspaceIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { team_id: identity.team_id },
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'accessTokenExpire',
                'refreshTokenExpire',
                'team_id',
                'team_name',
            ],
            entity: ['team_id'],
        },

        testAuthRequest: async (api) => api.authTest(),
    },
    env: {
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        scope: process.env.SLACK_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/slack`,
    },
};

module.exports = { Definition };
