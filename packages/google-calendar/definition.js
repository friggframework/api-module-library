require('dotenv').config();
const {get} = require("@friggframework/core");
const {Api} = require('./api');
const config = require('./defaultConfig.json')

const Definition = {
    API: Api,
    getName: function () {
        return config.name
    },
    moduleName: config.name,//maybe not required
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const entityDetails = await api.getTokenIdentity();
            return {
                identifiers: {externalId: entityDetails.identifier, user: userId},
                details: {name: entityDetails.name},
            }
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        getCredentialDetails: async function (api) {
            const userDetails = await api.getTokenIdentity();
            return {
                identifiers: {externalId: userDetails.identifier},
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return await api.getUserDetails()
        },
    },
    env: {
        client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
        client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
        redirect_uri: `${process.env.REDIRECT_URI}/google-calendar`,
        scope: process.env.GOOGLE_CALENDAR_SCOPE,
    }
};

module.exports = {Definition};
