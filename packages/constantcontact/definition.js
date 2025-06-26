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
    modelName: 'ConstantContact',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: {externalId: userDetails.account_id, user: userId},
                details: {name: userDetails.organization_name, email: userDetails.email},
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
                identifiers: {externalId: userDetails.account_id, user: userId},
                details: {name: userDetails.organization_name}
            };
        },
        testAuthRequest: async function (api) {
            return api.getUserDetails()
        },
    },
    env: {
        client_id: process.env.CONSTANT_CONTACT_CLIENT_ID,
        client_secret: process.env.CONSTANT_CONTACT_CLIENT_SECRET,
        scope: process.env.CONSTANT_CONTACT_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/constantcontact`,
    }
};

module.exports = {Definition};
