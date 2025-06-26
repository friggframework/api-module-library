require('dotenv').config();
const {Api} = require('./api');
const {get} = require("@friggframework/core");
const config = require('./defaultConfig.json')

const Definition = {
    API: Api,
    getName: function () {
        return config.name
    },
    moduleName: config.name,
    modelName: 'ConvertKit',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // ConvertKit uses API key and secret authentication
            return {
                access_token: params.api_key,
                api_secret: params.api_secret
            };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const accountDetails = await api.getAccount();
            return {
                identifiers: {externalId: accountDetails.account_id, user: userId},
                details: {name: accountDetails.name, email: accountDetails.primary_email_address},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'api_key', 'api_secret'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const accountDetails = await api.getAccount();
            return {
                identifiers: {externalId: accountDetails.account_id, user: userId},
                details: {name: accountDetails.name}
            };
        },
        testAuthRequest: async function (api) {
            return api.getAccount()
        },
    },
    env: {
        api_key: process.env.CONVERTKIT_API_KEY,
        api_secret: process.env.CONVERTKIT_API_SECRET,
    }
};

module.exports = {Definition};
