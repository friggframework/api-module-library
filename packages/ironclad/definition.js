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
    modelName: 'Ironclad',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },

        getEntityDetails: async function (api, userId) {
            const userDetails = await api.getConnectionInformation();
            return {
                identifiers: { externalId: userDetails.sub, user: userId },
                details: { name: userDetails.name, email: userDetails.email },
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },

        getCredentialDetails: async function (api, userId) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: { externalId: userDetails.portalId, user: userId },
                details: {},
            };
        },

        testAuthRequest: async function (api) {
            return api.getUserDetails();
        },
    },
    env: {
        client_id: process.env.IRONCLAD_CLIENT_ID,
        client_secret: process.env.IRONCLAD_CLIENT_SECRET,
        scope: process.env.IRONCLAD_SCOPE,
        subdomain: process.env.IRONCLAD_SUBDOMAIN,
        redirect_uri: `${process.env.REDIRECT_URI}/ironclad`,
    },
};

module.exports = { Definition };
