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
    modelName: 'Jira',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            // Get accessible resources to determine cloudId
            const resources = await api.getAccessibleResources();
            if (resources && resources.length > 0) {
                api.setCloudId(resources[0].id);
            }
            
            const userDetails = await api.getUserDetails();
            return {
                identifiers: { externalId: userDetails.accountId, user: userId },
                details: { 
                    name: userDetails.displayName, 
                    email: userDetails.emailAddress,
                    cloudId: resources[0]?.id 
                },
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: ['cloudId'],
        },
        getCredentialDetails: async function (api, userId) {
            const userDetails = await api.getUserDetails();
            return {
                identifiers: { externalId: userDetails.accountId, user: userId },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.getUserDetails();
        },
    },
    env: {
        client_id: process.env.JIRA_CLIENT_ID,
        client_secret: process.env.JIRA_CLIENT_SECRET,
        scope: process.env.JIRA_SCOPE || 'read:jira-user read:jira-work write:jira-work manage:jira-project manage:jira-configuration',
        redirect_uri: `${process.env.REDIRECT_URI}/jira`,
    },
};

module.exports = { Definition };