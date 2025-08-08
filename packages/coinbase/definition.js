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
    modelName: 'Coinbase',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async function (api, userId) {
            const user = await api.getCurrentUser();
            
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: user.id, 
                    user: userId 
                },
                details: {
                    name: user.name,
                    email: user.email,
                    nativeCurrency: user.native_currency,
                    countryCode: user.country?.code,
                    timeZone: user.time_zone,
                },
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: ['native_currency', 'country_code'],
        },

        getCredentialDetails: async function (api, userId) {
            const user = await api.getCurrentUser();
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: user.id, 
                    user: userId 
                },
                details: {
                    createdAt: user.created_at,
                },
            };
        },

        testAuthRequest: function (api) {
            return api.getCurrentUser();
        },
    },
    env: {
        clientId: process.env.COINBASE_CLIENT_ID,
        clientSecret: process.env.COINBASE_CLIENT_SECRET,
        redirectUri: `${process.env.REDIRECT_URI}/coinbase`,
        sandbox: process.env.COINBASE_SANDBOX === 'true',
        // Optional API key authentication
        apiKey: process.env.COINBASE_API_KEY,
        apiSecret: process.env.COINBASE_API_SECRET,
    },
};

module.exports = { Definition };