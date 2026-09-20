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
    modelName: 'GoogleSheets',
    requiredAuthMethods: {
        getAuthorizationRequirements: function () {
            return {
                url: this.api.getAuthorizationUri(),
                type: 'oauth2',
            };
        },
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (
            api,
            callbackParams,
            tokenResponse,
            userId
        ) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: { externalId: userDetails.id, userId },
                details: { name: userDetails.email },
            };
        },
        apiPropertiesToPersist: {
            // `refresh_token` is only returned on the FIRST consent, which is
            // why getAuthorizationUri sends prompt=consent. OAuth2Requester
            // preserves the stored one when a refresh response omits it.
            credential: [
                'access_token',
                'refresh_token',
                'expires_in',
                'scope',
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: { externalId: userDetails.id, userId },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.getUserDetails();
        },
    },
    env: {
        client_id: process.env.GOOGLE_SHEETS_CLIENT_ID,
        client_secret: process.env.GOOGLE_SHEETS_CLIENT_SECRET,
        redirect_uri: `${process.env.REDIRECT_URI}/google-sheets`,
        scope: process.env.GOOGLE_SHEETS_SCOPE,
    },
};

module.exports = { Definition };
