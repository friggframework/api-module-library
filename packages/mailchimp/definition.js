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
    modelName: 'Mailchimp',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const accountInfo = await api.getAccount();
            return {
                identifiers: { externalId: accountInfo.account_id, user: userId },
                details: { 
                    name: accountInfo.account_name,
                    email: accountInfo.email
                }
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'server_prefix'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const accountInfo = await api.getAccount();
            return {
                identifiers: { externalId: accountInfo.account_id, user: userId },
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getAccount();
        },
    },
    env: {
        client_id: process.env.MAILCHIMP_CLIENT_ID,
        client_secret: process.env.MAILCHIMP_CLIENT_SECRET,
        redirect_uri: `${process.env.REDIRECT_URI}/mailchimp`,
    }
};

module.exports = { Definition };