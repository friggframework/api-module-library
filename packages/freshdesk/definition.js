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
    modelName: 'Freshdesk',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Freshdesk uses API key authentication
            return {
                apiKey: params.data.apiKey,
                subdomain: params.data.subdomain,
            };
        },

        getEntityDetails: async function (api, userId) {
            const agent = await api.getCurrentAgent();
            
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: agent.id.toString(), 
                    user: userId 
                },
                details: {
                    name: agent.contact.name,
                    email: agent.contact.email,
                    role: agent.role,
                    type: agent.type,
                    available: agent.available,
                    language: agent.language,
                    timeZone: agent.time_zone,
                    subdomain: api.subdomain,
                },
            };
        },

        apiPropertiesToPersist: {
            credential: ['apiKey', 'subdomain'],
            entity: ['role', 'type', 'subdomain'],
        },

        getCredentialDetails: async function (api, userId) {
            const agent = await api.getCurrentAgent();
            
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: agent.id.toString(), 
                    user: userId 
                },
                details: {
                    createdAt: agent.created_at,
                    updatedAt: agent.updated_at,
                    lastActiveAt: agent.last_active_at,
                    available: agent.available,
                },
            };
        },

        testAuthRequest: function (api) {
            return api.getCurrentAgent();
        },
    },
    env: {
        apiKey: process.env.FRESHDESK_API_KEY,
        subdomain: process.env.FRESHDESK_SUBDOMAIN,
    },
};

module.exports = { Definition };