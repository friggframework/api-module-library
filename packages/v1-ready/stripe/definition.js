require('dotenv').config();
const { Api } = require('./api.js');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Stripe',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async function (api, userId) {
            const accountDetails = await api.getAccountDetails();
            return {
                identifiers: { externalId: accountDetails.id, user: userId },
                details: {
                    name: accountDetails.business_profile?.name,
                    email: accountDetails.email,
                },
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },

        getCredentialDetails: async function (api, userId) {
            const accountDetails = await api.getAccountDetails();
            return {
                identifiers: { externalId: accountDetails.id, user: userId },
                details: {},
            };
        },

        testAuthRequest: function (api) {
            return api.getAccountDetails();
        },
    },
    env: {
        stripeApiSecretKey: process.env.STRIPE_API_SECRET_KEY,
        stripeClientId: process.env.STRIPE_CLIENT_ID,
        redirect_uri: `${process.env.REDIRECT_URI}/stripe`,
    },
};

module.exports = { Definition };
