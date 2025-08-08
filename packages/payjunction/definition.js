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
    modelName: 'PayJunction',
    requiredAuthMethods: {
        getAuthorizationRequirements: async function (params) {
            return {
                type: 'api_key',
                url: 'https://developer.payjunction.com/hc/en-us/articles/210216408-API-Authentication',
                description: 'Generate an API key from your PayJunction account settings.'
            };
        },
        getCredentialDetails: async function (api, userId) {
            // PayJunction does not have a current user endpoint, so just return the userId
            return {
                identifiers: { user: userId },
                details: {}
            };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            // No entity details for API key auth
            return {
                identifiers: { user: userId },
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            // Implement a simple test, e.g., list transactions or similar
            return api.testAuth();
        },
        apiPropertiesToPersist: {
            credential: ['api_key'],
            entity: []
        }
    },
    env: {
        api_key: process.env.PAYJUNCTION_API_KEY
    }
};

module.exports = { Definition }; 