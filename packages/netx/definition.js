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
    modelName: 'Netx',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userDetails = await api.getTokenIdentity();
            return {
                identifiers: {externalId: userDetails.companyId, user: userId},
                details: {name: userDetails.companyName},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'id_token', 'expires_in'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const userDetails = await api.getTokenIdentity();
            return {
                identifiers: {externalId: userDetails.companyId, user: userId},
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getTokenIdentity()
        },
    },
    env: {
        client_id: process.env.NETX_CLIENT_ID,
        client_secret: process.env.NETX_CLIENT_SECRET,
        scope: process.env.NETX_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/netx`,
    }
};

module.exports = {Definition};