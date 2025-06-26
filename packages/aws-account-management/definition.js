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
    modelName: 'AWSAccountManagement',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const accountDetails = await api.getAccountInfo();
            return {
                identifiers: {externalId: accountDetails.accountId, user: userId},
                details: {name: accountDetails.accountName, email: accountDetails.email},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const accountDetails = await api.getAccountInfo();
            return {
                identifiers: {externalId: accountDetails.accountId, user: userId},
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getAccountInfo()
        },
    },
    env: {
        client_id: process.env.AWS_ACCOUNT_MANAGEMENT_CLIENT_ID,
        client_secret: process.env.AWS_ACCOUNT_MANAGEMENT_CLIENT_SECRET,
        scope: process.env.AWS_ACCOUNT_MANAGEMENT_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/aws-account-management`,
    }
};

module.exports = {Definition};