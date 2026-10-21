require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

/**
 * Housecall Pro OAuth2 module definition.
 *
 * After token exchange, identify the connected company via GET /company.
 * The company `id` is our externalId (stable per Pro account / location root).
 *
 * Docs: https://docs.housecallpro.com/docs/housecall-public-api/24a5d891a80a8-get-company
 */
async function resolveCompany(api) {
    const company = await api.getCompany();
    if (!company || !company.id) {
        throw new Error(
            'Housecall Pro company query failed to return a valid company id. ' +
                'Response: ' +
                JSON.stringify(company)
        );
    }
    return company;
}

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'HousecallPro',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code = get(params.data, 'code') || get(params, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const company = await resolveCompany(api);
            return {
                identifiers: { externalId: String(company.id), userId },
                details: { name: company.name || company.id },
            };
        },
        getCredentialDetails: async (api, userId) => {
            const company = await resolveCompany(api);
            return {
                identifiers: { externalId: String(company.id), userId },
                details: {},
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: [],
        },
        testAuthRequest: async (api) => {
            return api.getCompany();
        },
    },
    env: {
        client_id: process.env.HOUSECALLPRO_CLIENT_ID,
        client_secret: process.env.HOUSECALLPRO_CLIENT_SECRET,
        redirect_uri: `${process.env.REDIRECT_URI}/housecallpro`,
        scope: process.env.HOUSECALLPRO_SCOPE || 'public',
    },
};

module.exports = { Definition };
