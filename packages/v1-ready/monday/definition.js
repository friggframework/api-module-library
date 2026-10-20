require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * monday.com is OAuth 2.0 for marketplace / connected apps. Entity identity is
 * the account id from `me.account` (or the root `account` query); credential
 * identity uses the same account id so one install maps to one monday account.
 *
 * Legacy OAuth access tokens do not expire until the app is uninstalled and
 * there is no refresh_token in the classic flow. OAuth 2.1 (expiring tokens +
 * refresh) is available from monday — tracked as an open question.
 */
async function resolveAccountIdentity(api) {
    // Prefer me { account } so one round-trip covers user + account.
    // Entity identity is the monday *account* (not the user) so installs are
    // stable per workspace. Fall back to the root account query, then me.id.
    let me = null;
    try {
        me = await api.getMe();
        if (me?.account?.id != null) {
            return {
                externalId: String(me.account.id),
                name: me.account.name || me.account.slug || me.name || 'monday',
            };
        }
    } catch (_e) {
        // fall through to account query
    }

    try {
        const account = await api.getAccount();
        if (account?.id != null) {
            return {
                externalId: String(account.id),
                name: account.name || account.slug || 'monday',
            };
        }
    } catch (_e) {
        // fall through to me.id
    }

    if (me?.id != null) {
        return {
            externalId: String(me.id),
            name: me.name || me.email || 'monday',
        };
    }

    throw new Error(
        'monday: cannot derive a stable account identity — me/account queries returned no id.'
    );
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Monday',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) => ({
            url: api.authorizationUri,
            type: 'oauth2',
        }),

        getToken: async (api, params) => {
            const data = get(params, 'data', params) || {};
            const code = get(data, 'code', null) || get(params, 'code', null);
            if (!code) {
                throw new Error('monday OAuth callback missing authorization code');
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
            // Classic monday OAuth has no refresh_token; persist access_token only.
            credential: ['access_token'],
            entity: [],
        },

        testAuthRequest: async (api) => api.getMe(),
    },
    env: {
        client_id: process.env.MONDAY_CLIENT_ID,
        client_secret: process.env.MONDAY_CLIENT_SECRET,
        scope: process.env.MONDAY_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/monday`,
    },
};

module.exports = { Definition };
