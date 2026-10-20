require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve the connected Dropbox account for entity/credential identity.
 * Prefer POST /users/get_current_account; never fall back to a shared constant.
 */
async function resolveAccountIdentity(api) {
    const account = await api.getCurrentAccount();
    if (account?.account_id) {
        const displayName =
            (account.name && account.name.display_name) ||
            account.email ||
            account.account_id;
        return {
            externalId: String(account.account_id),
            name: displayName,
        };
    }
    throw new Error(
        'Dropbox: cannot derive a stable account identity — get_current_account returned no account_id.'
    );
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Dropbox',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params.data || {}, 'code');
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
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getCurrentAccount();
        },
    },
    env: {
        client_id: process.env.DROPBOX_CLIENT_ID,
        client_secret: process.env.DROPBOX_CLIENT_SECRET,
        scope: process.env.DROPBOX_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/dropbox`,
    },
};

module.exports = { Definition };
