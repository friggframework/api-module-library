require('dotenv').config();
const { Api } = require('./api.js');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'WhatsAppBusiness',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // WhatsApp Business uses Facebook access tokens
            return {
                access_token: api.access_token,
                token_type: 'Bearer'
            };
        },

        getEntityDetails: async function (api, userId) {
            const accountInfo = await api.getAccountInfo(['name', 'id']);
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: accountInfo.id, 
                    user: userId 
                },
                details: {
                    name: accountInfo.name,
                    phone_number_id: api.phone_number_id,
                    business_account_id: api.whatsapp_business_account_id
                },
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token'],
            entity: ['phone_number_id', 'whatsapp_business_account_id'],
        },

        getCredentialDetails: async function (api, userId) {
            const accountInfo = await api.getAccountInfo(['name', 'id']);
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: accountInfo.id, 
                    user: userId 
                },
                details: {
                    access_token: api.access_token
                },
            };
        },

        testAuthRequest: function (api) {
            return api.getAccountInfo(['id', 'name']);
        },
    },
    env: {
        access_token: process.env.WHATSAPP_ACCESS_TOKEN,
        phone_number_id: process.env.WHATSAPP_PHONE_NUMBER_ID,
        whatsapp_business_account_id: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
        api_version: process.env.WHATSAPP_API_VERSION || 'v18.0',
    },
};

module.exports = { Definition };