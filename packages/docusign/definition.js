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
    modelName: 'DocuSign',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userInfo = await api.getUserInfo();
            const accounts = userInfo.accounts || [];
            const defaultAccount = accounts.find(acc => acc.is_default) || accounts[0];
            
            return {
                identifiers: { externalId: userInfo.sub, user: userId },
                details: { 
                    name: userInfo.name,
                    email: userInfo.email,
                    account_id: defaultAccount?.account_id,
                    account_name: defaultAccount?.account_name
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
                identifiers: { externalId: userInfo.sub, user: userId },
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getUserInfo();
        },
    },
    env: {
        client_id: process.env.DOCUSIGN_CLIENT_ID,
        client_secret: process.env.DOCUSIGN_CLIENT_SECRET,
        scope: process.env.DOCUSIGN_SCOPE || 'signature impersonation',
        redirect_uri: `${process.env.REDIRECT_URI}/docusign`,
        sandbox: process.env.DOCUSIGN_SANDBOX === 'true',
    }
};

module.exports = { Definition };