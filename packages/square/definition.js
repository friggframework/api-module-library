require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Square',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const merchants = await api.listMerchants();
            const merchant = merchants.merchants[0];
            return {
                identifiers: { externalId: merchant.id, user: userId },
                details: { 
                    name: merchant.business_name || merchant.country,
                    status: merchant.status
                }
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const merchants = await api.listMerchants();
            const merchant = merchants.merchants[0];
            return {
                identifiers: { externalId: merchant.id, user: userId },
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.listMerchants();
        },
    },
    env: {
        client_id: process.env.SQUARE_CLIENT_ID,
        client_secret: process.env.SQUARE_CLIENT_SECRET,
        scope: process.env.SQUARE_SCOPE || 'MERCHANT_PROFILE_READ PAYMENTS_READ PAYMENTS_WRITE',
        redirect_uri: `${process.env.REDIRECT_URI}/square`,
        sandbox: process.env.SQUARE_SANDBOX === 'true',
    }
};

module.exports = { Definition };