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
    modelName: 'OpenPhone',
    requiredAuthMethods: {
        getAuthorizationRequirements: async function (params) {
            return {
                type: 'api_key',
                url: 'https://app.openphone.com/settings/integrations/api',
                description: 'Generate an API key from your OpenPhone account settings.'
            };
        },
        getCredentialDetails: async function (api, userId) {
            const currentUser = await api.getCurrentUser();
            return {
                identifiers: { externalId: currentUser.id, user: userId },
                details: {}
            };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const currentUser = await api.getCurrentUser();
            return {
                identifiers: { externalId: currentUser.id, user: userId },
                details: {
                    name: `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email
                }
            };
        },
        testAuthRequest: async function (api) {
            return api.getCurrentUser();
        },
        apiPropertiesToPersist: {
            credential: ['api_key'],
            entity: []
        }
    },
    env: {
        api_key: process.env.OPENPHONE_API_KEY
    }
};

module.exports = { Definition }; 