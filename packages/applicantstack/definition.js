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
    modelName: 'ApplicantStack',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userInfo = await api.getUserInfo();
            return {
                identifiers: {externalId: userInfo.id || 'applicantstack-account', user: userId},
                details: {name: userInfo.name || 'ApplicantStack Account', email: userInfo.email},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const userInfo = await api.getUserInfo();
            return {
                identifiers: {externalId: userInfo.id || 'applicantstack-account', user: userId},
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getUserInfo()
        },
    },
    env: {
        client_id: process.env.APPLICANTSTACK_CLIENT_ID,
        client_secret: process.env.APPLICANTSTACK_CLIENT_SECRET,
        scope: process.env.APPLICANTSTACK_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/applicantstack`,
    }
};

module.exports = {Definition};