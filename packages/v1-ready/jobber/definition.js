require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Jobber OAuth2 module definition.
 *
 * After token exchange, Jobber docs recommend querying `account { id name }` to
 * associate tokens with a Jobber account — that id is our externalId.
 */
const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Jobber',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code = get(params.data, 'code') || get(params, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const account = await api.getAccount();
            if (!account || !account.id) {
                throw new Error(
                    'Jobber account query failed to return a valid account id. ' +
                        'Response: ' +
                        JSON.stringify(account)
                );
            }
            return {
                identifiers: { externalId: account.id, userId },
                details: { name: account.name },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const account = await api.getAccount();
            if (!account || !account.id) {
                throw new Error(
                    'Jobber account query failed to return a valid account id. ' +
                        'Response: ' +
                        JSON.stringify(account)
                );
            }
            return {
                identifiers: { externalId: account.id, userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getAccount();
        },
    },
    env: {
        client_id: process.env.JOBBER_CLIENT_ID,
        client_secret: process.env.JOBBER_CLIENT_SECRET,
        redirect_uri: `${process.env.REDIRECT_URI}/jobber`,
        scope: process.env.JOBBER_SCOPE || '',
    },
};

module.exports = { Definition };
