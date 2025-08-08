require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');

const Definition = {
    API: Api,
    getName: () => config.name,
    moduleName: config.name,
    modelName: 'Xero',
    requiredAuthMethods: {
        getToken: async (api, params) => {
            const code = get(params.data, 'code');
            return api.getTokenFromCode(code);
        },
        getEntityDetails: async (api, callbackParams, tokenResponse, userId) => {
            const tenants = await api.getTenants();
            if (tenants.length > 0) {
                api.tenantId = tenants[0].tenantId;
            }
            const orgDetails = await api.getOrganisation();
            const org = orgDetails.Organisations[0];
            return {
                identifiers: { externalId: org.OrganisationID, user: userId },
                details: { name: org.Name, tenantId: api.tenantId },
            };
        },
        apiPropertiesToPersist: {
            credential: ['access_token', 'refresh_token'],
            entity: ['tenantId'],
        },
        getCredentialDetails: async (api, userId) => {
            const orgDetails = await api.getOrganisation();
            const org = orgDetails.Organisations[0];
            return {
                identifiers: { externalId: org.OrganisationID, user: userId },
                details: {},
            };
        },
        testAuthRequest: async (api) => api.getOrganisation(),
    },
    env: {
        client_id: process.env.XERO_CLIENT_ID,
        client_secret: process.env.XERO_CLIENT_SECRET,
        scope: process.env.XERO_SCOPE || 'openid profile email accounting.transactions accounting.contacts',
        redirect_uri: `${process.env.REDIRECT_URI}/xero`,
    },
};

module.exports = { Definition };
