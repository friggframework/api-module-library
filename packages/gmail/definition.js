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
    modelName: 'Gmail',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: {externalId: userDetails.emailAddress, user: userId},
                details: {name: userDetails.emailAddress, email: userDetails.emailAddress},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: {externalId: userDetails.emailAddress, user: userId},
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getUserDetails()
        },
    },
    env: {
        client_id: process.env.GMAIL_CLIENT_ID,
        client_secret: process.env.GMAIL_CLIENT_SECRET,
        scope: process.env.GMAIL_SCOPE || 'https://www.googleapis.com/auth/gmail.modify',
        redirect_uri: `${process.env.REDIRECT_URI}/gmail`,
    }
};

module.exports = {Definition};