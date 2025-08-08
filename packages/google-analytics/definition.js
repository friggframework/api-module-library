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
    modelName: 'GoogleAnalytics',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const accounts = await api.listAccounts();
            const firstAccount = accounts.items?.[0];
            return {
                identifiers: {externalId: firstAccount?.id || 'ga-account', user: userId},
                details: {name: firstAccount?.name || 'Google Analytics Account', accountCount: accounts.items?.length || 0},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const accounts = await api.listAccounts();
            return {
                identifiers: {externalId: 'ga-account', user: userId},
                details: {accountCount: accounts.items?.length || 0}
            };
        },
        testAuthRequest: async function (api) {
            return api.listAccounts()
        },
    },
    env: {
        client_id: process.env.GOOGLE_ANALYTICS_CLIENT_ID,
        client_secret: process.env.GOOGLE_ANALYTICS_CLIENT_SECRET,
        scope: process.env.GOOGLE_ANALYTICS_SCOPE || 'https://www.googleapis.com/auth/analytics.readonly',
        redirect_uri: `${process.env.REDIRECT_URI}/google-analytics`,
    }
};

module.exports = {Definition};