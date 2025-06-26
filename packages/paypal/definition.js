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
    modelName: 'PayPal',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userInfo = await api.getUserInfo();
            return {
                identifiers: { externalId: userInfo.user_id, user: userId },
                details: { 
                    name: userInfo.name,
                    email: userInfo.email
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
            const userInfo = await api.getUserInfo();
            return {
                identifiers: { externalId: userInfo.user_id, user: userId },
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getUserInfo();
        },
    },
    env: {
        client_id: process.env.PAYPAL_CLIENT_ID,
        client_secret: process.env.PAYPAL_CLIENT_SECRET,
        scope: process.env.PAYPAL_SCOPE || 'openid profile email',
        redirect_uri: `${process.env.REDIRECT_URI}/paypal`,
        sandbox: process.env.PAYPAL_SANDBOX === 'true',
    }
};

module.exports = { Definition };