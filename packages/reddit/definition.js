require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Reddit',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: { externalId: userDetails.id, user: userId },
                details: { name: userDetails.name },
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        getCredentialDetails: async (api, userId) => {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: { externalId: userDetails.id, user: userId },
                details: {},
            };
        },
        testAuthRequest: async (api) => api.getUserDetails(),
    },
    env: {
        client_id: process.env.REDDIT_CLIENT_ID,
        client_secret: process.env.REDDIT_CLIENT_SECRET,
        scope: process.env.REDDIT_SCOPE || 'identity read submit',
        redirect_uri: `${process.env.REDIRECT_URI}/reddit`,
    },
};

module.exports = { Definition };
