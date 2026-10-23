require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Resolve which FreshBooks business/account this connection binds to.
 * Reconciled with lefthookhq/freshbooks-integrations Definition.chosenBusiness:
 * require an explicit account_id when the identity has multiple businesses.
 */
function chosenBusiness(user, accountId) {
    const businesses = (user.business_memberships ?? [])
        .map((membership) => membership?.business)
        .filter((business) => business?.account_id);

    if (accountId) {
        const business = businesses.find(
            (candidate) => String(candidate.account_id) === String(accountId)
        );
        if (!business) {
            throw new Error(
                `FreshBooks business not available to this user: ${accountId}`
            );
        }
        return business;
    }

    if (businesses.length === 0) {
        throw new Error(
            `FreshBooks user ${user.id} has no FreshBooks business to connect`
        );
    }

    if (businesses.length > 1) {
        const choices = businesses
            .map((business) => `${business.name} (${business.account_id})`)
            .join(', ');
        throw new Error(
            `FreshBooks user ${user.id} belongs to multiple FreshBooks businesses; ` +
                `retry with account_id set to one of: ${choices}`
        );
    }

    return businesses[0];
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'FreshBooks',
    requiredAuthMethods: {
        getAuthorizationRequirements: (api) => ({
            url: api.getAuthorizationUri(),
            type: 'oauth2',
        }),
        getToken: async (api, params) => {
            const code =
                get(params, 'code', null) || get(params?.data || {}, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const data =
                (callbackParams && callbackParams.data) || callbackParams || {};
            const requested =
                get(data, 'account_id', null) ||
                get(data, 'accountId', null) ||
                get(callbackParams, 'account_id', null);

            const user = await api.getUserDetails();
            const business = chosenBusiness(user, requested);
            api.setAccountId(business.account_id);
            if (business.id) api.setBusinessId(business.id);

            return {
                identifiers: {
                    externalId: String(business.account_id),
                    userId,
                },
                details: { name: business.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const externalId =
                api.freshbooksUserId ?? (await api.getUserDetails()).id;
            return {
                identifiers: {
                    externalId: String(externalId),
                    userId,
                },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'freshbooksUserId',
            ],
            // account_id lives on entity.identifiers.externalId (chosenBusiness);
            // callers pass accountId into Api methods or rely on setAccountId.
            entity: [],
        },
        testAuthRequest: async (api) => api.getUserDetails(),
    },
    env: {
        client_id: process.env.FRESHBOOKS_CLIENT_ID,
        client_secret: process.env.FRESHBOOKS_CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI
            ? `${process.env.REDIRECT_URI}/${config.name}`
            : undefined,
    },
};

module.exports = { Definition, chosenBusiness };
