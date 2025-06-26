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
    modelName: 'Chargebee',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Chargebee uses API key authentication
            return {
                access_token: params.api_key,
                site_name: params.site_name
            };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const customers = await api.listCustomers({ limit: 1 });
            return {
                identifiers: {externalId: api.siteName, user: userId},
                details: {siteName: api.siteName, hasCustomers: customers?.list?.length > 0},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'api_key', 'site_name'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            return {
                identifiers: {externalId: api.siteName, user: userId},
                details: {siteName: api.siteName}
            };
        },
        testAuthRequest: async function (api) {
            return api.listCustomers({ limit: 1 })
        },
    },
    env: {
        api_key: process.env.CHARGEBEE_API_KEY,
        site_name: process.env.CHARGEBEE_SITE_NAME,
    }
};

module.exports = {Definition};
