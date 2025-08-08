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
    modelName: 'Intercom',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const meInfo = await api.getMe();
            return {
                identifiers: { externalId: meInfo.id, user: userId },
                details: { 
                    name: meInfo.name,
                    email: meInfo.email,
                    app_name: meInfo.app?.name
                }
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const meInfo = await api.getMe();
            return {
                identifiers: { externalId: meInfo.id, user: userId },
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getMe();
        },
    },
    env: {
        client_id: process.env.INTERCOM_CLIENT_ID,
        client_secret: process.env.INTERCOM_CLIENT_SECRET,
        scope: process.env.INTERCOM_SCOPE || 'read_contacts write_contacts read_conversations write_conversations',
        redirect_uri: `${process.env.REDIRECT_URI}/intercom`,
    }
};

module.exports = { Definition };