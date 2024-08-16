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
    modelName: 'qbo',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: {externalId: userDetails.portalId, user: userId},
                details: {name: userDetails.hub_domain},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            console.log(">>> Getting user detail...")
            const userDetails = await api.getUserDetails();
            console.log(">>> user detail: ", userDetails)

            return {
                identifiers: {externalId: userDetails.portalId, user: userId},
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getUserDetails()
        },
    },
    env: {
        client_id: process.env.QBO_CLIENT_ID,
        client_secret: process.env.QBO_CLIENT_SECRET,
        scope: process.env.QBO_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/qbo`,
    }
};

module.exports = {Definition};
