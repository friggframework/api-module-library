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
    modelName: 'Anthropic',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Anthropic uses API keys, not OAuth
            const apiKey = get(params.data, 'apiKey');
            if (!apiKey) {
                throw new Error('API Key is required for Anthropic authentication');
            }
            return { apiKey };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            // Anthropic doesn't have user accounts via API, so we use a generic identifier
            return {
                identifiers: {externalId: 'anthropic-user', user: userId},
                details: {name: 'Anthropic API User', apiKey: tokenResponse.apiKey},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'apiKey', 'anthropicVersion'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            // Test the API key by making a simple request
            const isValid = await api.testAuth();
            return {
                identifiers: {externalId: 'anthropic-api', user: userId},
                details: { apiKeyValid: isValid }
            };
        },
        testAuthRequest: async function (api) {
            return api.testAuth()
        },
    },
    env: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        anthropicVersion: process.env.ANTHROPIC_VERSION || '2023-06-01',
    }
};

module.exports = {Definition};