require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve the connected Dropbox account for entity/credential identity.
 *
 * Prefer OpenID userinfo `sub` (v1 lefthookhq/dropbox--frigg getTokenIdentity),
 * which Stone documents as the Dropbox account_id. Fall back to
 * users/get_current_account.account_id. Never use a shared constant.
 */
async function resolveAccountIdentity(api) {
    try {
        const userInfo = await api.getUserDetails();
        if (userInfo?.sub) {
            const parts = [userInfo.given_name, userInfo.family_name]
                .filter(Boolean)
                .join(' ')
                .trim();
            return {
                externalId: String(userInfo.sub),
                name: parts || userInfo.email || String(userInfo.sub),
            };
        }
    } catch (e) {
        // Fall through to get_current_account (e.g. token without openid scope).
    }

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
        'Dropbox: cannot derive a stable account identity — openid/userinfo and get_current_account returned no id.'
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
        // access_token + refresh_token match v1 Credential schema fields used
        // for auth. v1 also stored expires_at on the Mongoose model; v2 relies
        // on OAuth2Requester.accessTokenExpire (set from expires_in) rather
        // than duplicating a custom expires_at field here.
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            // v1 Manager.testAuth used getUserDetails (OpenID userinfo).
            return api.getUserDetails();
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
