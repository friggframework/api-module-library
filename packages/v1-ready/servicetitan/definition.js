require('dotenv').config();
const { Api } = require('./api');
const { get } = require('@friggframework/core');
const config = require('./defaultConfig.json');
const AuthFields = require('./authFields');

// ServiceTitan uses the OAuth2 client_credentials grant, so there is no
// redirect: the tenant admin pastes four values and we verify them directly.
const Definition = {
    API: Api,
    getName: function () {
        return config.name;
    },
    moduleName: config.name,
    modelName: 'ServiceTitan',
    requiredAuthMethods: {
        getAuthorizationRequirements: function () {
            return {
                url: null,
                data: AuthFields,
                type: Api.requesterType,
            };
        },
        setAuthParams: async function (api, params) {
            api.environment = get(params, 'environment', 'production');
            api.tenant_id = get(params, 'tenant_id');
            api.app_key = get(params, 'app_key');
            api.client_id = get(params, 'client_id');
            api.client_secret = get(params, 'client_secret');
            api.setup();
        },
        getEntityDetails: async function (api, callbackParams, tokenResponse, userId) {
            const tenant = await api.getTenantDetails();
            return {
                // Scope the external ID by environment so a sandbox tenant and
                // a production tenant that share an ID cannot collide.
                identifiers: {
                    externalId: `${api.environment}:${tenant.tenantId}`,
                    userId,
                },
                details: { name: tenant.name },
            };
        },
        apiPropertiesToPersist: {
            // access_token is cached deliberately: ServiceTitan recommends
            // reusing a token for its full 15-minute life rather than minting
            // one per invocation.
            credential: [
                'environment',
                'tenant_id',
                'app_key',
                'client_id',
                'client_secret',
                'access_token',
                'accessTokenExpire',
            ],
            entity: ['environment', 'tenant_id'],
        },
        getCredentialDetails: async function (api, userId) {
            const tenant = await api.getTenantDetails();
            return {
                identifiers: {
                    externalId: `${api.environment}:${tenant.tenantId}`,
                    userId,
                },
                details: {},
            };
        },
        testAuthRequest: async function (api) {
            return api.getTenantDetails();
        },
    },
    env: {
        client_id: process.env.SERVICETITAN_CLIENT_ID,
        client_secret: process.env.SERVICETITAN_CLIENT_SECRET,
        app_key: process.env.SERVICETITAN_APP_KEY,
        tenant_id: process.env.SERVICETITAN_TENANT_ID,
        environment: process.env.SERVICETITAN_ENVIRONMENT || 'production',
    },
};

module.exports = { Definition };
