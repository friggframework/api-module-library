require('dotenv').config();
const { Api } = require('./api');
const { get } = require("@friggframework/core");
const config = require('./defaultConfig.json')

const Definition = {
    API: Api,
    getName: function () {
        return config.name
    },
    moduleName: config.name,
    modelName: 'Salesforce',
    requiredAuthMethods: {
        getAuthorizationRequirements: function (params) {
            return {
                url: this.api.getAuthorizationUri(),
                type: 'oauth2',
            };
        },
        getToken: async function (api, params) {
            const code = get(params, 'code');
            const state = get(params, 'state', null);
            if (state) api.restoreVerifierFromState(state);
            let tokenResponse;
            try {
                tokenResponse = await api.getAccessToken(code);
            } catch (e) {
                // If that fails, re-set API class as sandbox
                // Then try again
                console.log(e);
                api.resetToSandbox();
                if (state) api.restoreVerifierFromState(state);
                tokenResponse = await api.getAccessToken(code);
            }
            return tokenResponse;
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const orgResponse = await api.find('Organization');
            const orgDetails = orgResponse[0];
            const { Username: connectedUsername } = await api.getUserInfo();
            return {
                identifiers: { externalId: orgDetails.Id, userId },
                details: { name: orgDetails.Name, connectedUsername },
            };
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token', 'refresh_token', 'isSandbox', 'instanceUrl'
            ],
            entity: [],
        },
        getCredentialDetails: async function (api, userId) {
            return {
                identifiers: { externalId: api.instanceUrl, userId },
                details: {}
            };
        },
        testAuthRequest: async function (api) {
            return api.find('Organization')
        },
    },
    env: {
        client_id: process.env.SALESFORCE_CONSUMER_KEY,
        client_secret: process.env.SALESFORCE_CONSUMER_SECRET,
        scope: process.env.SALESFORCE_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/salesforce`,
    }
};

module.exports = { Definition };
