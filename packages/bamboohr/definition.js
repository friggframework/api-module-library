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
    modelName: 'BambooHR',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // BambooHR uses API key authentication
            return {
                access_token: params.api_key,
                subdomain: params.subdomain
            };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const companyInfo = await api.getCompanyInfo();
            return {
                identifiers: {externalId: api.subdomain, user: userId},
                details: {subdomain: api.subdomain, companyName: companyInfo.name || api.subdomain},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'api_key', 'subdomain'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const companyInfo = await api.getCompanyInfo();
            return {
                identifiers: {externalId: api.subdomain, user: userId},
                details: {subdomain: api.subdomain}
            };
        },
        testAuthRequest: async function (api) {
            return api.getCompanyInfo()
        },
    },
    env: {
        api_key: process.env.BAMBOOHR_API_KEY,
        subdomain: process.env.BAMBOOHR_SUBDOMAIN,
    }
};

module.exports = {Definition};
