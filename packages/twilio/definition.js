require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Twilio',
    requiredAuthMethods: {
        getAuthorizationRequirements: async function (params) {
            return {
                type: 'basic_auth',
                url: 'https://console.twilio.com/account/keys-credentials/api-keys',
                description: 'Generate an API Key and Secret from your Twilio Console. You will also need your Account SID.'
            };
        },
        getCredentialDetails: async function (api, userId) {
            const accountDetails = await api.getAccount();
            return {
                identifiers: { externalId: accountDetails.sid, user: userId },
                details: {}
            };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const accountDetails = await api.getAccount();
            return {
                identifiers: { externalId: accountDetails.sid, user: userId },
                details: {
                    name: accountDetails.friendly_name || accountDetails.sid,
                    type: accountDetails.type
                }
            };
        },
        testAuthRequest: async function (api) {
            return api.getAccount();
        },
        apiPropertiesToPersist: {
            credential: ['account_sid', 'api_key', 'api_secret'],
            entity: []
        }
    },
    env: {
        account_sid: process.env.TWILIO_ACCOUNT_SID,
        api_key: process.env.TWILIO_API_KEY,
        api_secret: process.env.TWILIO_API_SECRET
    }
};

module.exports = { Definition };