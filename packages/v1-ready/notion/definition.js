require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve a stable workspace identity for entity/credential keys.
 * Prefer the OAuth token response fields persisted on the Api instance;
 * fall back to bot id from GET /v1/users/me when workspace_id is absent
 * (e.g. internal integration token without an OAuth exchange).
 */
async function resolveWorkspaceIdentity(api, tokenResponse = {}) {
    const workspaceId =
        get(tokenResponse, 'workspace_id', null) || api.workspace_id;
    const workspaceName =
        get(tokenResponse, 'workspace_name', null) ||
        api.workspace_name ||
        'Notion';

    if (workspaceId) {
        if (!api.workspace_id) api.workspace_id = workspaceId;
        if (workspaceName && !api.workspace_name) {
            api.workspace_name = workspaceName;
        }
        return { externalId: String(workspaceId), name: workspaceName };
    }

    const me = await api.getSelf();
    const botId = me?.id || api.bot_id;
    if (!botId) {
        throw new Error(
            'Notion: cannot derive a stable account identity — no workspace_id from OAuth and no bot user from GET /v1/users/me.'
        );
    }
    return {
        externalId: String(botId),
        name: me?.name || workspaceName,
    };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Notion',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params, 'data.code', null);
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveWorkspaceIdentity(
                api,
                tokenResponse || {}
            );
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const identity = await resolveWorkspaceIdentity(api, {});
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'workspace_id',
                'workspace_name',
                'bot_id',
            ],
            entity: ['workspace_id'],
        },

        testAuthRequest: async (api) => api.getSelf(),
    },
    env: {
        client_id: process.env.NOTION_CLIENT_ID,
        client_secret: process.env.NOTION_CLIENT_SECRET,
        scope: process.env.NOTION_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/notion`,
    },
};

module.exports = { Definition };
