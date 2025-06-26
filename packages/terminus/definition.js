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
    modelName: 'Terminus',
    requiredAuthMethods: {
        getToken: async function(api, params) {
            return api.getTokenFromApiKey(params.data.apiKey);
        },
        getEntityDetails: async function(api, callbackParams, tokenResponse, userId) {
            return {
                identifiers: {externalId: params.data.apiKey || 'default', user: userId},
                details: {name: params.data.apiKey || 'Default'}
            };
        },
        getCredentialDetails: async function(api, userId) {
            return {
                identifiers: {externalId: 'default', user: userId},
                details: {}
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'apiKey'],
            entity: []
        },
        testAuthRequest: async function(api) {
            return await api.testAuth();
        }
    }
};

module.exports = {Definition};