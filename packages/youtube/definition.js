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
    modelName: 'YouTube',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const channel = await api.getMyChannel();
            const channelData = channel.items[0];
            return {
                identifiers: { externalId: channelData.id, user: userId },
                details: { 
                    name: channelData.snippet.title, 
                    description: channelData.snippet.description
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const channel = await api.getMyChannel();
            const channelData = channel.items[0];
            return {
                identifiers: { externalId: channelData.id, user: userId },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.getMyChannel();
        },
    },
    env: {
        client_id: process.env.YOUTUBE_CLIENT_ID,
        client_secret: process.env.YOUTUBE_CLIENT_SECRET,
        scope: process.env.YOUTUBE_SCOPE || 'https://www.googleapis.com/auth/youtube',
        redirect_uri: `${process.env.REDIRECT_URI}/youtube`,
    },
};

module.exports = { Definition };