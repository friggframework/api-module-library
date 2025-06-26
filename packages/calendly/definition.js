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
    modelName: 'Calendly',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userInfo = await api.getCurrentUser();
            return {
                identifiers: { externalId: userInfo.resource.uri, user: userId },
                details: { 
                    name: userInfo.resource.name,
                    email: userInfo.resource.email
                }
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const userInfo = await api.getCurrentUser();
            return {
                identifiers: { externalId: userInfo.resource.uri, user: userId },
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getCurrentUser();
        },
    },
    env: {
        client_id: process.env.CALENDLY_CLIENT_ID,
        client_secret: process.env.CALENDLY_CLIENT_SECRET,
        scope: process.env.CALENDLY_SCOPE || 'default',
        redirect_uri: `${process.env.REDIRECT_URI}/calendly`,
    }
};

module.exports = { Definition };