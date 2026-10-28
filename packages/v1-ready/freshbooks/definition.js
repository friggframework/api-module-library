const { Api } = require('./api');
const config = require('./defaultConfig.json');

const chosenBusiness = (user, accountId) => {
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
            `FreshBooks user ${user.id} belongs to multiple FreshBooks businesses; retry with account_id set to one of: ${choices}`
        );
    }
    return businesses[0];
};

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'FreshBooks',
    requiredAuthMethods: {
        getToken: async (api, params) => api.getTokenFromCode(params.code),
        getEntityDetails: async (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) => {
            const business = chosenBusiness(
                await api.getUserDetails(),
                callbackParams?.account_id
            );
            return {
                identifiers: {
                    externalId: String(business.account_id),
                    user: userId,
                },
                details: { name: business.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const externalId =
                api.freshbooksUserId ?? (await api.getUserDetails()).id;
            return {
                identifiers: { externalId: String(externalId), userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token', 'freshbooksUserId'],
            entity: [],
        },
        testAuthRequest: async (api) => api.getUserDetails(),
    },
    env: {
        client_id: process.env.FRESHBOOKS_CLIENT_ID,
        client_secret: process.env.FRESHBOOKS_CLIENT_SECRET,
        redirect_uri: `${process.env.REDIRECT_URI}/${config.name}`,
    },
};

module.exports = { Definition };
