require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Pick the FreshBooks account this connection should bind to.
 * Prefer an explicit account_id from the OAuth callback / UI; otherwise the
 * first business_membership that has an account_id.
 */
function resolveAccountSelection(api, callbackParams, identityResponse) {
    const data = (callbackParams && callbackParams.data) || callbackParams || {};
    const requested =
        get(data, 'account_id', null) ||
        get(data, 'accountId', null) ||
        get(data, 'appOrgId', null);

    const memberships =
        identityResponse?.response?.business_memberships || [];
    const accounts = memberships
        .map((m) => ({
            accountId: m.business?.account_id,
            businessId: m.business?.id,
            name: m.business?.name,
            role: m.role,
        }))
        .filter((a) => a.accountId);

    const selected = requested
        ? accounts.find((a) => String(a.accountId) === String(requested))
        : accounts[0];

    if (!selected) {
        throw new Error(
            'FreshBooks: no account_id available on this identity. ' +
                'Client-only FreshBooks users may lack an accounting account_id ' +
                '(see https://www.freshbooks.com/api/identity_model).'
        );
    }

    api.setAccountId(selected.accountId);
    if (selected.businessId) api.setBusinessId(selected.businessId);
    return selected;
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'FreshBooks',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) => ({
            url: api.getAuthUri(),
            type: 'oauth2',
        }),
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params?.data || {}, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const identity = await api.getUserInfo();
            const selected = resolveAccountSelection(
                api,
                callbackParams,
                identity
            );
            return {
                identifiers: {
                    externalId: String(selected.accountId),
                    userId,
                },
                details: {
                    name: selected.name,
                    businessId: selected.businessId,
                    role: selected.role,
                    email: identity?.response?.email,
                },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const identity = await api.getUserInfo();
            const identityId = identity?.response?.id;
            if (!identityId) {
                throw new Error(
                    'FreshBooks /auth/api/v1/users/me did not return an identity id'
                );
            }
            return {
                identifiers: {
                    externalId: String(identityId),
                    userId,
                },
                details: {
                    email: identity?.response?.email,
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: ['accountId', 'businessId'],
        },
        testAuthRequest: async (api) => api.getUserInfo(),
    },
    env: {
        client_id: process.env.FRESHBOOKS_CLIENT_ID,
        client_secret: process.env.FRESHBOOKS_CLIENT_SECRET,
        scope: process.env.FRESHBOOKS_SCOPE,
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/freshbooks`
            : undefined,
    },
};

module.exports = { Definition };
