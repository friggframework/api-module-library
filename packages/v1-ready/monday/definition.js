require('dotenv').config();
const { get } = require('@friggframework/core');
const { Api } = require('./api');
const config = require('./defaultConfig.json');

/**
 * monday.com OAuth 2.0 (marketplace / connected apps). Entity identity is the
 * account id from `me.account`. Classic OAuth access tokens do not expire until
 * uninstall and have no refresh_token.
 *
 * Redirect URI uses dedicated MONDAY_REDIRECT_URI (not REDIRECT_URI/monday).
 */
async function resolveAccountIdentity(api) {
    let me = null;
    try {
        me = await api.getMe();
        if (me?.account?.id != null) {
            if (me.account.slug) {
                api.accountSlug = me.account.slug;
            }
            return {
                externalId: String(me.account.id),
                name: me.account.name || me.account.slug || me.name || 'monday',
            };
        }
    } catch (_e) {
        // fall through
    }

    try {
        const account = await api.getAccount();
        if (account?.id != null) {
            if (account.slug) {
                api.accountSlug = account.slug;
            }
            return {
                externalId: String(account.id),
                name: account.name || account.slug || 'monday',
            };
        }
    } catch (_e) {
        // fall through
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
    mappings: {
        business: 'extensions.mapping',
    },
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
            credential: ['access_token'],
            entity: ['accountSlug'],
        },

        testAuthRequest: async (api) => {
            try {
                return await api.getMe();
            } catch (error) {
                const status = error?.statusCode || error?.response?.status;
                if (status === 401 || status === 403) {
                    throw new Error(
                        'monday authentication failed: token invalid or revoked. Please reconnect.'
                    );
                }
                throw error;
            }
        },
    },
    env: {
        client_id: process.env.MONDAY_CLIENT_ID,
        client_secret: process.env.MONDAY_CLIENT_SECRET,
        scope: process.env.MONDAY_SCOPE,
        redirect_uri: process.env.MONDAY_REDIRECT_URI,
        signing_secret: process.env.MONDAY_SIGNING_SECRET,
    },
};

module.exports = { Definition };
