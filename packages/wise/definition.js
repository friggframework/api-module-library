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
    modelName: 'Wise',
    requiredAuthMethods: {
        getToken: async function (api, params) {
            // Wise uses API tokens, not OAuth
            // This would typically be handled during initial setup
            const apiToken = get(params.data, 'apiToken');
            return {
                apiToken: apiToken,
            };
        },

        getEntityDetails: async function (api, userId) {
            const profiles = await api.getProfiles();
            const personalProfile = profiles.find(p => p.type === 'PERSONAL') || profiles[0];
            
            if (personalProfile) {
                api.setProfile(personalProfile.id);
            }
            
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: personalProfile ? personalProfile.id : 'unknown', 
                    user: userId 
                },
                details: {
                    profiles: profiles.map(p => ({
                        id: p.id,
                        type: p.type,
                        fullName: p.details.firstName + ' ' + p.details.lastName,
                    })),
                    primaryProfileId: personalProfile?.id,
                },
            };
        },

        apiPropertiesToPersist: {
            credential: ['apiToken'],
            entity: ['profileId', 'profiles'],
        },

        getCredentialDetails: async function (api, userId) {
            const profiles = await api.getProfiles();
            const profileId = profiles[0]?.id;
            
            if (userId.userId) userId = userId.userId;
            return {
                identifiers: { 
                    externalId: profileId || 'unknown', 
                    user: userId 
                },
                details: {
                    profileCount: profiles.length,
                    isSandbox: api.sandbox,
                },
            };
        },

        testAuthRequest: function (api) {
            return api.getProfiles();
        },
    },
    env: {
        apiToken: process.env.WISE_API_TOKEN,
        sandbox: process.env.WISE_SANDBOX === 'true',
    },
};

module.exports = { Definition };