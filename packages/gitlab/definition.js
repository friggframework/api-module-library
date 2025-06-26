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
    modelName: 'GitLab',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: { externalId: userDetails.id, user: userId },
                details: { 
                    name: userDetails.name, 
                    email: userDetails.email,
                    username: userDetails.username 
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: { externalId: userDetails.id, user: userId },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.getUserDetails();
        },
    },
    env: {
        client_id: process.env.GITLAB_CLIENT_ID,
        client_secret: process.env.GITLAB_CLIENT_SECRET,
        scope: process.env.GITLAB_SCOPE || 'read_user read_api write_repository',
        redirect_uri: `${process.env.REDIRECT_URI}/gitlab`,
        baseUrl: process.env.GITLAB_BASE_URL || 'https://gitlab.com', // Support self-hosted instances
    },
};

module.exports = { Definition };