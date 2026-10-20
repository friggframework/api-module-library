require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve a stable SharePoint / Graph identity for entity + credential.
 *
 * Prefer the tenant organization id (matches `tenantId` on Graph change
 * notifications) when available. Personal Microsoft accounts have no org —
 * Graph returns an error — so fall back to the signed-in user id.
 *
 * Sources:
 *   GET /organization — https://learn.microsoft.com/en-us/graph/api/organization-get
 *   GET /me — https://learn.microsoft.com/en-us/graph/api/user-get
 */
async function resolveAccountIdentity(api) {
    try {
        const org = await api.getOrganization();
        if (org?.id) {
            return {
                externalId: org.id,
                name: org.displayName || org.id,
            };
        }
    } catch (e) {
        // Personal accounts / missing Organization.Read.All — fall through.
    }

    const user = await api.getUser();
    if (!user?.id) {
        throw new Error(
            'SharePoint: cannot derive a stable account identity — /organization and /me both failed to yield an id.'
        );
    }
    const name = user.displayName
        ? `${user.displayName}${
              user.userPrincipalName ? ` (${user.userPrincipalName})` : ''
          }`
        : user.userPrincipalName || user.id;
    return { externalId: user.id, name };
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'SharePoint',
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
            return api.listSites({ search: '*' });
        },
    },
    env: {
        client_id: process.env.SHAREPOINT_CLIENT_ID,
        client_secret: process.env.SHAREPOINT_CLIENT_SECRET,
        scope: process.env.SHAREPOINT_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/sharepoint`,
    },
};

module.exports = { Definition };
