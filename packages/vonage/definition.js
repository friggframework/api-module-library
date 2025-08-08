require('dotenv').config();
const { Api } = require('./api.js');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Vonage',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Vonage uses API key/secret and JWT authentication
            return {
                access_token: api.api_key,
                token_type: 'ApiKey'
            };
        },

        getEntityDetails: async function (api, userId) {
            const balance = await api.getBalance();
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: api.api_key, 
                    user: userId 
                },
                details: {
                    balance: balance.value,
                    autoReload: balance.autoReload,
                    api_key: api.api_key,
                    application_id: api.application_id
                },
            };
        },

        apiPropertiesToPersist: {
            credential: ['api_key', 'api_secret', 'private_key', 'signature_secret'],
            entity: ['application_id'],
        },

        getCredentialDetails: async function (api, userId) {
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: api.api_key, 
                    user: userId 
                },
                details: {
                    api_key: api.api_key,
                    api_secret: api.api_secret
                },
            };
        },

        testAuthRequest: function (api) {
            return api.getBalance();
        },
    },
    env: {
        api_key: process.env.VONAGE_API_KEY,
        api_secret: process.env.VONAGE_API_SECRET,
        application_id: process.env.VONAGE_APPLICATION_ID,
        private_key: process.env.VONAGE_PRIVATE_KEY,
        signature_secret: process.env.VONAGE_SIGNATURE_SECRET,
    },
};

module.exports = { Definition };