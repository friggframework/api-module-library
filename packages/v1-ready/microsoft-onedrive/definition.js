require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve a stable OneDrive / Graph identity for entity + credential.
 *
 * OneDrive is per-user, so prefer the signed-in user id from GET /me.
 * Sources:
 *   GET /me — https://learn.microsoft.com/en-us/graph/api/user-get
 */
async function resolveAccountIdentity(api) {
    const user = await api.getUser();
    if (!user?.id) {
        throw new Error(
            'Microsoft OneDrive: cannot derive a stable account identity — GET /me returned no id.'
        );
    }
    const name = user.displayName
        ? `${user.displayName}${
              user.userPrincipalName || user.mail
                  ? ` (${user.userPrincipalName || user.mail})`
                  : ''
          }`
        : user.userPrincipalName || user.mail || user.id;
    return { externalId: user.id, name };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'OneDrive',
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
            return api.getMyDrive();
        },
    },
    env: {
        client_id: process.env.MICROSOFT_ONEDRIVE_CLIENT_ID,
        client_secret: process.env.MICROSOFT_ONEDRIVE_CLIENT_SECRET,
        scope: process.env.MICROSOFT_ONEDRIVE_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/microsoft-onedrive`,
    },
};

module.exports = { Definition };
