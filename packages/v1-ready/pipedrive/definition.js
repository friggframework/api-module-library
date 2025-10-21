require('dotenv').config();
const {Api} = require('./api');
const {get} = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Pipedrive',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            try {
                const userProfile = await api.getUser();

                if (!userProfile || !userProfile.data) {
                    throw new Error(
                        'Pipedrive /v1/users/me failed to return valid user info. ' +
                        'Response: ' + JSON.stringify(userProfile)
                    );
                }

                return {
                    identifiers: {
                        externalId: String(userProfile.data.company_id),
                        user: userId
                    },
                    details: {
                        name: userProfile.data.company_name || 'Unknown Company'
                    },
                };
            } catch (error) {
                throw new Error(`Failed to get Pipedrive entity details: ${error.message}`);
            }
        },
        apiPropertiesToPersist: {
            credential: [
                'access_token',
                'refresh_token',
                'companyDomain'
            ],
            entity: [],
        },
        getCredentialDetails: async (api, userId) => {
            try {
                const userProfile = await api.getUser();

                if (!userProfile || !userProfile.data) {
                    throw new Error(
                        'Pipedrive /v1/users/me failed to return valid user info. ' +
                        'Response: ' + JSON.stringify(userProfile)
                    );
                }

                return {
                    identifiers: {
                        externalId: String(userProfile.data.id),
                        user: userId
                    },
                    details: {}
                };
            } catch (error) {
                throw new Error(`Failed to get Pipedrive credential details: ${error.message}`);
            }
        },
        testAuthRequest: async (api) => api.getUser(),
    },
    env: {
        client_id: process.env.PIPEDRIVE_CLIENT_ID,
        client_secret: process.env.PIPEDRIVE_CLIENT_SECRET,
        scope: process.env.PIPEDRIVE_SCOPE,
        redirect_uri: `${process.env.REDIRECT_URI}/pipedrive`,
    }
};

module.exports = {Definition};
