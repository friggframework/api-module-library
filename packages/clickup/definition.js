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
    modelName: 'ClickUp',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const userDetails = await api.getUserDetails();
            const teams = await api.getAuthorizedTeams();
            return {
                identifiers: { externalId: userDetails.user.id, user: userId },
                details: { 
                    name: userDetails.user.username, 
                    email: userDetails.user.email,
                    teams: teams.teams.map(t => ({ id: t.id, name: t.name }))
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token'],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: { externalId: userDetails.user.id, user: userId },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.getUserDetails();
        },
    },
    env: {
        client_id: process.env.CLICKUP_CLIENT_ID,
        client_secret: process.env.CLICKUP_CLIENT_SECRET,
        redirect_uri: `${process.env.REDIRECT_URI}/clickup`,
    },
};

module.exports = { Definition };