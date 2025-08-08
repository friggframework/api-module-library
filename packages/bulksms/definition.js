require('dotenv').config();
const {Api} = require('./api');
const {get} = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'BulkSMS',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userDetails = await api.getCurrentUser();
            return {
                identifiers: {externalId: userDetails.id, user: userId},
                details: {name: userDetails.name || userDetails.email},
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const userDetails = await api.getCurrentUser();
            return {
                identifiers: {externalId: userDetails.id, user: userId},
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getCurrentUser();
        },
    },
    env: {
        client_id: process.env.BULKSMS_CLIENT_ID,
        client_secret: process.env.BULKSMS_CLIENT_SECRET,
        scope: process.env.BULKSMS_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/bulksms`,
    }
};

module.exports = {Definition};
