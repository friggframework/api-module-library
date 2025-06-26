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
    modelName: 'Huggg',
    requiredAuthMethods: {
        getToken: async function(api, params) {
            // Username/Password auth flow
            await api.getTokenFromClientCredentials();
            api.username = params.data.username;
            api.password = params.data.password;
            const tokenResponse = await api.getTokenFromUsernamePassword();
            return {
                ...tokenResponse,
                username: params.data.username,
                password: params.data.password
            };
        },
        getEntityDetails: async function(api, callbackParams, tokenResponse, userId) {
            return {
                identifiers: {externalId: tokenResponse.username || 'default', user: userId},
                details: {name: tokenResponse.username || 'Default'}
            };
        },
        getCredentialDetails: async function(api, userId) {
            return {
                identifiers: {externalId: api.username || 'default', user: userId},
                details: {}
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token', 'username', 'password'],
            entity: []
        },
        testAuthRequest: async function(api) {
            // Since testAuth is not implemented in manager, we'll use a basic test
            return await api.get('/test'); // This should be updated based on actual API
        }
    }
};

module.exports = {Definition};