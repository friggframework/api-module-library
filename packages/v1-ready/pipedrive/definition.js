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
    modelName: 'Pipedrive',
    requiredAuthMethods: {
        getAuthorizationRequirements: async function (params) {
            return {
                url: await this.api.getAuthUri(),
                type: 'oauth2',
            };
        },
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userDetails = await api.getUser();
            return {
                identifiers: { externalId: userDetails.data.id, user: userId },
                details: { name: userDetails.data.name || userDetails.data.email }
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token', 'companyDomain'],
            entity: []
        },
        getCredentialDetails: async function (api, userId) {
            const userDetails = await api.getUser();
            return {
                identifiers: { externalId: userDetails.data.id, user: userId },
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.getUser();
        }
    },
    env: {
        client_id: process.env.PIPEDRIVE_CLIENT_ID,
        client_secret: process.env.PIPEDRIVE_CLIENT_SECRET,
        scope: process.env.PIPEDRIVE_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/pipedrive`
    }
};

module.exports = { Definition }; 