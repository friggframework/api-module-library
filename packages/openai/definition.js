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
    modelName: 'OpenAI',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // OpenAI uses API keys, not OAuth
            const apiKey = get(params.data, 'apiKey');
            if (!apiKey) {
                throw new Error('API Key is required for OpenAI authentication');
            }
            return { apiKey };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            // OpenAI doesn't have user accounts via API, so we use a generic identifier
            return {
                identifiers: {externalId: 'openai-user', user: userId},
                details: {name: 'OpenAI API User', apiKey: tokenResponse.apiKey},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'apiKey', 'organizationId'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            // Test the API key by making a simple request
            const models = await api.listModels();
            return {
                identifiers: {externalId: 'openai-api', user: userId},
                details: { modelsAvailable: models.data.length }
            };
        },
        testAuthRequest: async function (api) {
            return api.testAuth()
        },
    },
    env: {
        apiKey: process.env.OPENAI_API_KEY,
        organizationId: process.env.OPENAI_ORGANIZATION_ID,
    }
};

module.exports = {Definition};