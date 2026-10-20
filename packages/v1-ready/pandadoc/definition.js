require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * PandaDoc is OAuth 2.0 authenticated (recommended by PandaDoc for all new
 * integrations). Identity comes from GET /public/v1/members/current.
 *
 * Entity externalId is the workspace id — webhook subscriptions are
 * workspace-scoped, and that id is the stable tenant key for reverse lookup.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'PandaDoc',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code = get(params.data, 'code') || get(params, 'code');
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const member = await api.detailsCurrentMember();
            const name =
                member.workspace_name ||
                [member.first_name, member.last_name].filter(Boolean).join(' ') ||
                member.email;
            return {
                identifiers: {
                    externalId: String(member.workspace),
                    userId,
                },
                details: {
                    name,
                    email: member.email,
                    membershipId: member.membership_id,
                    userId: member.user_id,
                    role: member.role,
                },
            };
        },

        getCredentialDetails: async (api, userId) => {
            const member = await api.detailsCurrentMember();
            return {
                identifiers: {
                    externalId: String(member.workspace),
                    userId,
                },
                details: {},
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },

        testAuthRequest: async (api) => {
            return api.detailsCurrentMember();
        },
    },
    env: {
        client_id: process.env.PANDADOC_CLIENT_ID,
        client_secret: process.env.PANDADOC_CLIENT_SECRET,
        scope: process.env.PANDADOC_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/pandadoc".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/pandadoc`
            : undefined,
    },
};

module.exports = { Definition };
