require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * ClickUp is OAuth 2.0 for marketplace / connected apps (authorization code).
 * Personal API tokens (`pk_…`) also work when supplied as `access_token`.
 *
 * Entity identity prefers the first authorized Workspace (team) id from
 * Get Authorized Teams — webhooks and hierarchy are workspace-scoped. Falls
 * back to the authorized user id when no teams are returned.
 *
 * OAuth access tokens currently do not expire and ClickUp does not return a
 * refresh_token (subject to change per ClickUp docs).
 */
async function resolveAccountIdentity(api) {
    try {
        const teamsRes = await api.getAuthorizedTeams();
        const teams = Array.isArray(teamsRes?.teams) ? teamsRes.teams : [];
        const first = teams[0];
        if (first?.id != null) {
            return {
                externalId: String(first.id),
                name: first.name || 'ClickUp',
            };
        }
    } catch (_e) {
        // fall through to authorized user
    }

    const userRes = await api.getAuthorizedUser();
    const user = userRes?.user;
    if (user?.id != null) {
        return {
            externalId: String(user.id),
            name: user.username || user.email || 'ClickUp',
        };
    }

    throw new Error(
        'ClickUp: cannot derive a stable account identity — Get Authorized Teams / User returned no id.'
    );
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'ClickUp',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) =>
            api.getAuthorizationRequirements(),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error(
                    'ClickUp OAuth callback missing authorization code'
                );
            }
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await resolveAccountIdentity(api);
            return {
                identifiers: { externalId: identity.externalId, userId },
                details: { name: identity.name },
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
            // ClickUp OAuth currently has no refresh_token.
            credential: ['access_token'],
            entity: [],
        },

        testAuthRequest: async (api) => api.getAuthorizedUser(),
    },
    env: {
        client_id: process.env.CLICKUP_CLIENT_ID,
        client_secret: process.env.CLICKUP_CLIENT_SECRET,
        scope: process.env.CLICKUP_SCOPE,
        // Omit when unset so schema validation does not see the string "undefined/clickup".
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/clickup`
            : undefined,
    },
};

module.exports = { Definition };
