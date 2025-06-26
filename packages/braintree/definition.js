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
    modelName: 'Braintree',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Braintree uses API keys, not OAuth
            return {
                access_token: 'braintree_api_access',
                merchant_id: params.merchant_id,
                public_key: params.public_key,
                private_key: params.private_key,
                environment: params.environment
            };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            // For Braintree, we can use merchant ID as the identifier
            return {
                identifiers: {externalId: api.merchantId, user: userId},
                details: {
                    merchantId: api.merchantId,
                    environment: api.environment
                },
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'merchant_id', 'public_key', 'private_key', 'environment'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            return {
                identifiers: {externalId: api.merchantId, user: userId},
                details: {
                    merchantId: api.merchantId,
                    environment: api.environment
                }
            };
        },
        testAuthRequest: async function (api) {
            // Test by trying to list customers (should work with valid credentials)
            return api.listCustomers({ limit: 1 })
        },
    },
    env: {
        merchant_id: process.env.BRAINTREE_MERCHANT_ID,
        public_key: process.env.BRAINTREE_PUBLIC_KEY,
        private_key: process.env.BRAINTREE_PRIVATE_KEY,
        environment: process.env.BRAINTREE_ENVIRONMENT,
    }
};

module.exports = {Definition};
