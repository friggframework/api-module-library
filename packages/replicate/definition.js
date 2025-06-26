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
    modelName: 'Replicate',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Replicate uses API tokens, not OAuth
            const apiKey = get(params.data, 'apiToken') || get(params.data, 'apiKey');
            if (!apiKey) {
                throw new Error('API Token is required for Replicate authentication');
            }
            return { apiKey };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            // Get account info from Replicate
            const account = await api.getAccount();
            return {
                identifiers: {externalId: account.username || 'replicate-user', user: userId},
                details: {
                    username: account.username,
                    type: account.type,
                    githubUrl: account.github_url
                },
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'apiKey'
            ],
            entity: ['username', 'type'],
        },
        getCredentialDetails: async function (api, userId) {
            // Get account details
            const account = await api.getAccount();
            return {
                identifiers: {externalId: account.username || 'replicate-api', user: userId},
                details: { 
                    username: account.username,
                    accountType: account.type
                }
            };
        },
        testAuthRequest: async function (api) {
            return api.testAuth()
        },
    },
    env: {
        apiKey: process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY,
    }
};

module.exports = {Definition};