require('dotenv').config();
const { Api } = require('./api.js');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'Zendesk',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            if (params.data.code) {
                // OAuth2 flow
                const code = get(params.data, 'code');
                return api.getTokenFromCode(code);
            } else {
                // API token flow
                return {
                    email: params.data.email,
                    apiToken: params.data.apiToken,
                    subdomain: params.data.subdomain,
                };
            }
        },

        getEntityDetails: async function (api, userId) {
            const userResponse = await api.getCurrentUser();
            const user = userResponse.user;
            
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: user.id.toString(), 
                    user: userId 
                },
                details: {
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    organizationId: user.organization_id,
                    timeZone: user.time_zone,
                    locale: user.locale,
                    subdomain: api.subdomain,
                },
            };
        },

        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token', 'email', 'apiToken', 'subdomain'],
            entity: ['role', 'organization_id', 'subdomain'],
        },

        getCredentialDetails: async function (api, userId) {
            const userResponse = await api.getCurrentUser();
            const user = userResponse.user;
            
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: user.id.toString(), 
                    user: userId 
                },
                details: {
                    createdAt: user.created_at,
                    updatedAt: user.updated_at,
                    verified: user.verified,
                    active: user.active,
                },
            };
        },

        testAuthRequest: function (api) {
            return api.getCurrentUser();
        },
    },
    env: {
        // OAuth2 configuration
        clientId: process.env.ZENDESK_CLIENT_ID,
        clientSecret: process.env.ZENDESK_CLIENT_SECRET,
        redirectUri: `${process.env.REDIRECT_URI}/zendesk`,
        subdomain: process.env.ZENDESK_SUBDOMAIN,
        // API token configuration
        email: process.env.ZENDESK_EMAIL,
        apiToken: process.env.ZENDESK_API_TOKEN,
    },
};

module.exports = { Definition };