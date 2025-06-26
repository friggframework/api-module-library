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
    modelName: 'Cohere',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Cohere uses API keys, not OAuth
            const apiKey = get(params.data, 'apiKey');
            if (!apiKey) {
                throw new Error('API Key is required for Cohere authentication');
            }
            return { apiKey };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            // Cohere doesn't have user accounts via API, so we use a generic identifier
            return {
                identifiers: {externalId: 'cohere-user', user: userId},
                details: {name: 'Cohere API User', apiKey: tokenResponse.apiKey},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'apiKey'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            // Test the API key by listing models
            const models = await api.listModels();
            return {
                identifiers: {externalId: 'cohere-api', user: userId},
                details: { modelsAvailable: models.models ? models.models.length : 0 }
            };
        },
        testAuthRequest: async function (api) {
            return api.testAuth()
        },
    },
    env: {
        apiKey: process.env.COHERE_API_KEY,
    }
};

module.exports = {Definition};