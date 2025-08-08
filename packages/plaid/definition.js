require('dotenv').config();
const { Api } = require('./api.js');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Plaid',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Plaid uses public token exchange instead of OAuth
            const publicToken = get(params.data, 'public_token');
            const result = await api.exchangePublicToken(publicToken);
            return {
                access_token: result.access_token,
                item_id: result.item_id,
            };
        },

        getEntityDetails: async function (api, userId) {
            const item = await api.getItem();
            const institution = await api.getInstitutionById(item.item.institution_id);
            
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: item.item.item_id, 
                    user: userId 
                },
                details: {
                    name: institution.institution.name,
                    institutionId: item.item.institution_id,
                    availableProducts: item.item.available_products,
                    billedProducts: item.item.billed_products,
                },
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'item_id'],
            entity: ['institution_id', 'available_products'],
        },

        getCredentialDetails: async function (api, userId) {
            const item = await api.getItem();
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: item.item.item_id, 
                    user: userId 
                },
                details: {
                    webhook: item.item.webhook,
                    consentExpirationTime: item.item.consent_expiration_time,
                },
            };
        },

        testAuthRequest: function (api) {
            return api.getAccounts();
        },
    },
    env: {
        clientId: process.env.PLAID_CLIENT_ID,
        secret: process.env.PLAID_SECRET,
        environment: process.env.PLAID_ENV || 'sandbox',
        redirectUri: `${process.env.REDIRECT_URI}/plaid`,
    },
};

module.exports = { Definition };