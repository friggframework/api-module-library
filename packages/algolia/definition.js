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
    modelName: 'Algolia',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Algolia uses API keys, not OAuth
            return {
                access_token: params.api_key,
                app_id: params.app_id
            };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const indexes = await api.listIndexes();
            return {
                identifiers: {externalId: api.appId, user: userId},
                details: {appId: api.appId, indexCount: indexes.nbHits || 0},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'app_id', 'api_key'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const indexes = await api.listIndexes();
            return {
                identifiers: {externalId: api.appId, user: userId},
                details: {appId: api.appId}
            };
        },
        testAuthRequest: async function (api) {
            return api.listIndexes()
        },
    },
    env: {
        app_id: process.env.ALGOLIA_APP_ID,
        api_key: process.env.ALGOLIA_API_KEY,
    }
};

module.exports = {Definition};
