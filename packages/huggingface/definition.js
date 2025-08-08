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
    modelName: 'HuggingFace',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Hugging Face uses API tokens, not OAuth
            const apiKey = get(params.data, 'apiToken') || get(params.data, 'apiKey');
            if (!apiKey) {
                throw new Error('API Token is required for Hugging Face authentication');
            }
            return { apiKey };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            // Get user info from Hugging Face
            const userInfo = await api.whoami();
            return {
                identifiers: {externalId: userInfo.name || 'huggingface-user', user: userId},
                details: {
                    name: userInfo.fullname || userInfo.name || 'Hugging Face User',
                    email: userInfo.email,
                    organizations: userInfo.orgs || []
                },
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'apiKey'
            ],
            entity: ['organizations'],
        },
        getCredentialDetails: async function (api, userId) {
            // Get user details and available models
            const userInfo = await api.whoami();
            return {
                identifiers: {externalId: userInfo.name || 'huggingface-api', user: userId},
                details: { 
                    username: userInfo.name,
                    isPro: userInfo.isPro || false,
                    canPay: userInfo.canPay || false
                }
            };
        },
        testAuthRequest: async function (api) {
            return api.testAuth()
        },
    },
    env: {
        apiKey: process.env.HUGGINGFACE_API_TOKEN || process.env.HUGGINGFACE_API_KEY,
    }
};

module.exports = {Definition};