require('dotenv').config();
const {Api} = require('./api');
const {get} = require("@friggframework/core");
const config = require('./defaultConfig.json')

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Attio',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code = get(params, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const tokenInfo = await api.getUserDetails(); // Returns /v2/self response with workspace info

            if (!tokenInfo || !tokenInfo.workspace_id) {
                throw new Error(
                    'Attio /v2/self failed to return valid workspace info. ' +
                    'Response: ' + JSON.stringify(tokenInfo)
                );
            }

            return {
                identifiers: {externalId: tokenInfo.workspace_id, user: userId},
                details: {name: tokenInfo.workspace_name || tokenInfo.workspace_slug},
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token'
            ],
            entity: [],
        },
        getCredentialDetails: async (api, userId) => {
            const tokenInfo = await api.getUserDetails(); // Returns /v2/self response with workspace info

            if (!tokenInfo || !tokenInfo.workspace_id) {
                throw new Error(
                    'Attio /v2/self failed to return valid workspace info. ' +
                    'Response: ' + JSON.stringify(tokenInfo)
                );
            }

            return {
                identifiers: {externalId: tokenInfo.workspace_id, user: userId},
                details: {}
            };
        },
        testAuthRequest: async (api) => api.getUserDetails(),
    },
    env: {
        client_id: process.env.ATTIO_CLIENT_ID,
        client_secret: process.env.ATTIO_CLIENT_SECRET,
        scope: process.env.ATTIO_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/attio`,
    }
};

module.exports = {Definition}; 