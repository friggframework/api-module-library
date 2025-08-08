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
    modelName: 'SendGrid',
    requiredAuthMethods: {
        getAuthorizationRequirements: async function (params) {
            return {
                type: 'api_key',
                url: 'https://app.sendgrid.com/settings/api_keys',
                description: 'Generate an API key from your SendGrid account settings. Make sure to give it appropriate permissions.'
            };
        },
        getCredentialDetails: async function (api, userId) {
            const userProfile = await api.getCurrentUser();
            return {
                identifiers: { externalId: userProfile.username, user: userId },
                details: {}
            };
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userProfile = await api.getCurrentUser();
            return {
                identifiers: { externalId: userProfile.username, user: userId },
                details: {
                    name: userProfile.first_name && userProfile.last_name 
                        ? `${userProfile.first_name} ${userProfile.last_name}` 
                        : userProfile.username,
                    email: userProfile.email
                }
            };
        },
        testAuthRequest: async function (api) {
            return api.getCurrentUser();
        },
        apiPropertiesToPersist: {
            credential: ['api_key'],
            entity: []
        }
    },
    env: {
        api_key: process.env.SENDGRID_API_KEY
    }
};

module.exports = { Definition };